import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { withTestApi } from './test-api.mjs'

await withTestApi(async (base, password) => {
  process.env.CAMPUS_API_ORIGIN = new URL(base).origin
  const app = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
  const origin = 'http://127.0.0.1:' + app.httpServer.address().port
  let browser
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH,
      headless: true,
      args: ['--disable-gpu'],
    })
    const errors = []
    const failed = []
    async function sign(role, width = 1440, height = 960) {
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()
      page.on('requestfailed', req => {
        if (!req.failure()?.errorText.includes('ABORTED')) failed.push(req.url())
      })
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text())
      })
      page.on('dialog', dialog => dialog.accept())
      page.on('pageerror', (e) => errors.push(e.message))
      page.setDefaultTimeout(7000)
      await page.goto(origin + '/login')
      const theme = page.getByLabel('Theme', {exact:true})
      await theme.selectOption('dark')
      await page.reload()
      assert.equal(await theme.inputValue(), 'dark')
      await page.keyboard.press('Tab')
      assert.ok(await page.locator(':focus-visible').count())
      await page.getByLabel('Email', { exact: true }).fill(role + '@example.test')
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor()
      return page
    }
    const admin = await sign('admin')
    await admin.getByRole('heading', { name: 'Requests by status' }).waitFor()
    async function send(page, path, method = 'GET', data) {
      const res = await page.request.fetch(origin + '/api' + path, { method, data })
      assert.ok(res.ok(), method + ' ' + path + ' returned ' + res.status())
      return (await res.json()).data
    }
    const roles = await send(admin, '/roles'),
      ids = {}
    for (const role of ['campus_member', 'technician', 'coordinator']) {
      const account = await send(admin, '/users', 'POST', {
        email: role + '@example.test',
        password,
        full_name: role,
        member_type: 'staff',
      })
      ids[role] = account.id
      await send(admin, '/users/' + account.id + '/roles', 'POST', {
        role_id: roles.find((r) => r.code === role).id,
      })
    }
    await admin.getByRole('link', { name: 'Buildings', exact: true }).click()
    await admin.getByRole('button', { name: 'New building' }).click()
    await admin.getByLabel('Building code').fill('SCI')
    await admin.getByLabel('Building name').fill('Science Hall')
    await admin.getByRole('button', { name: 'Save', exact: true }).click()
    await admin.getByRole('heading', { name: 'Science Hall' }).waitFor()
    const building = Number(new URL(admin.url()).pathname.split('/').at(-1))
    await admin.getByRole('button', { name: 'New room' }).click()
    await admin.getByLabel('Room code').fill('204')
    await admin.getByRole('button', { name: 'Save', exact: true }).click()
    await admin.getByRole('button', { name: 'Edit room 204' }).waitFor()
    await admin.goto(origin + '/users')
    await admin.getByRole('heading', { name: 'User directory' }).waitFor()
    const memberRow = admin.locator('.listrow').filter({ hasText: 'campus_member@example.test' })
    await memberRow.getByRole('button', { name: 'Roles', exact: true }).click()
    await admin.getByRole('button', { name: 'Grant Technician', exact: true }).click()
    await admin.getByRole('button', { name: 'Revoke Technician', exact: true }).click()
    await admin.getByRole('button', { name: 'Grant Technician', exact: true }).waitFor()
    await admin.getByRole('button', { name: 'Technician skills', exact: true }).click()
    await admin.getByLabel('Technician ID').fill(String(ids.technician))
    await admin.getByLabel(/^Category/).selectOption({ index: 1 })
    await admin.getByRole('button', { name: 'Add skill' }).click()
    await admin.getByRole('button', { name: 'Remove skill' }).click()
    await admin.getByText('Technician skills updated.').waitFor()
    const member = await sign('campus_member'),
      coord = await sign('coordinator', 1487, 1058),
      tech = await sign('technician', 390, 844)
    for (const [page, portal] of [[admin,'admin'], [member,'member'], [coord,'coordinator'], [tech,'technician']]) {
      if (page === admin) await page.goto(origin + '/admin/dashboard')
      await page.waitForURL('**/' + portal + '/dashboard')
      for (const width of [375, 768, 1024, 1440]) {
        await page.setViewportSize({width, height: 900})
        for (const theme of ['dark','light']) {
          await page.getByLabel('Theme', {exact:true}).selectOption(theme)
          if (process.env.UI_SCREENSHOTS && width === 1024 && theme === 'dark')
            await page.screenshot({path:join(process.env.UI_SCREENSHOTS, portal + '-dark.png'), animations:'disabled'})
          assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), theme)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), portal + ' overflows at ' + width)
        }
      }
      await page.reload()
      assert.equal(await page.getByLabel('Theme', {exact:true}).inputValue(), 'light')
      await page.emulateMedia({colorScheme:'dark'})
      await page.getByLabel('Theme', {exact:true}).selectOption('system')
      assert.equal(await page.locator('aside').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(25, 36, 49)')
      await page.emulateMedia({colorScheme:'light'})
      assert.equal(await page.locator('aside').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)')
    }
    await tech.setViewportSize({width:375,height:844})
    const category = (await send(member, '/maintenance-categories'))[0].id
    for (const [i, title] of [
      'AC not cooling in study room',
      'Flickering lights in hallway',
      'Leaking faucet in restroom',
      'Broken door handle in classroom',
      'Window will not close',
      'Water leak under sink',
    ].entries()) {
      const r = await send(member, '/maintenance-requests', 'POST', {
        title,
        description: title,
        building_id: building,
        category_id: category,
      })
      if (i === 3 || i === 4)
        await send(coord, '/maintenance-requests/' + r.id + '/approve', 'PATCH', {})
    }
    await coord.reload()
    await coord.getByRole('heading', { name: 'Recent maintenance requests' }).waitFor()
    if (process.env.UI_SCREENSHOTS)
      await coord.screenshot({ path: join(process.env.UI_SCREENSHOTS, 'coordinator-dashboard.png') })
    const extra = await send(admin, '/users', 'POST', {
      email:'extra@example.test', password, full_name:'Alexandra'.repeat(16), member_type:'faculty',
    })
    const extraPage = await browser.newPage()
    await extraPage.goto(origin + '/login')
    await extraPage.getByLabel('Email', {exact:true}).fill(extra.email)
    await extraPage.getByLabel('Password', {exact:true}).fill(password)
    await extraPage.getByRole('button', {name:'Sign in'}).click()
    await extraPage.getByText(/Your account needs a portal role/).waitFor()
    for (const code of ['coordinator','campus_member']) {
      await send(admin,'/users/' + extra.id + '/roles','POST',{role_id:roles.find(r => r.code === code).id})
    }
    await extraPage.goto(origin)
    await extraPage.waitForURL('**/coordinator/dashboard')
    await extraPage.getByLabel('Switch portal').selectOption('campus_member')
    await extraPage.waitForURL('**/member/dashboard')
    await extraPage.getByText('No maintenance requests yet.').waitFor()
    await extraPage.setViewportSize({width:375,height:812})
    assert.ok(await extraPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await extraPage.goto(origin + '/admin/dashboard')
    await extraPage.getByRole('heading',{name:'This page is unavailable'}).waitFor()
    const response = await extraPage.request.get(origin + '/api/users', {headers:{'X-Campus-Role':'admin'}})
    assert.equal(response.status(),403)
    await extraPage.close()
    await member.goto(origin + '/member/requests')
    await member.route('**/api/maintenance-requests?**', route => route.fulfill({status:503,json:{error:'Maintenance service unavailable'}}))
    await member.reload()
    await member.getByRole('alert').filter({hasText:'Maintenance service unavailable'}).waitFor()
    await member.unroute('**/api/maintenance-requests?**')
    let release
    const pending = new Promise(resolve => { release = resolve })
    await member.route('**/api/maintenance-requests?**', async route => { await pending; await route.continue() })
    await member.getByRole('button',{name:'Try again'}).click()
    await member.getByText('Loading…',{exact:true}).waitFor()
    release()
    await member.getByRole('link',{name:/AC not cooling/}).waitFor()
    await member.unroute('**/api/maintenance-requests?**')
    await member.goto(origin + '/member/dashboard')
    await member.getByRole('link', { name: 'Report an issue' }).click()
    await member.waitForURL('**/requests/new')
    await member.getByLabel(/^Building/).selectOption(String(building))
    await member.getByLabel('Room (optional)').selectOption({ label: '204' })
    await member.getByLabel(/^Category/).selectOption(String(category))
    await member.getByLabel('Title', { exact: true }).fill('Repair projector connection')
    await member
      .getByLabel('Description', { exact: true })
      .fill('The projector is not connecting to the classroom computer.')
    await member.getByRole('button', { name: 'Submit request' }).click()
    await member.getByRole('heading', { name: 'Repair projector connection' }).waitFor()
    const detail = new URL(member.url()).pathname
    await coord.goto(origin + detail.replace('/member/', '/coordinator/'))
    async function action(name, confirm) {
      await coord.getByRole('button', { name, exact: true }).click()
      await coord.getByRole('button', { name: confirm, exact: true }).click()
    }
    await action('Approve request', 'Confirm approve')
    await coord.getByRole('button', { name: 'Assign technician', exact: true }).click()
    await coord.getByLabel('Technician', {exact:true}).selectOption(String(ids.technician))
    await coord.getByRole('button', { name: 'Confirm assign' }).click()
    await coord.getByRole('button', { name: 'Reassign technician' }).waitFor()
    await tech.reload()
    await tech.getByRole('link', { name: /Assignment #\d+ · Request/ }).click()
    await tech.getByRole('button', { name: 'Start work' }).click()
    await tech.getByLabel('Staff-only update').waitFor()
    await tech.getByRole('button', { name: 'Dismiss message' }).click()
    if (process.env.UI_SCREENSHOTS)
      await tech.screenshot({
        path: join(process.env.UI_SCREENSHOTS, 'technician-assignment.png'),
        fullPage: true,
      })
    assert.ok(await tech.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await tech.getByLabel('Staff-only update').fill('Checked the cable')
    await tech.getByRole('button', { name: 'Post update' }).click()
    await tech.getByText('Staff-only update posted.').waitFor()
    await tech.getByLabel('Completion note').fill('Replaced damaged cable')
    await tech.getByRole('button', { name: 'Complete assignment', exact: true }).click()
    await tech.getByRole('heading', { name: 'Assignment record' }).waitFor()
    await member.reload()
    await member.getByRole('heading', { name: 'Comments' }).waitFor()
    assert.equal(await member.getByText('Checked the cable').count(), 0)
    await coord.reload()
    await action('Close request', 'Confirm close')
    await member.reload()
    await member.getByText('Closed', { exact:true }).first().waitFor()
    await coord.getByRole('button', { name: 'Reopen request' }).click()
    await coord.getByLabel('Reason').fill('Verify replacement')
    await coord.getByRole('button', { name: 'Confirm reopen' }).click()
    await coord.getByRole('button', { name: 'Assign technician' }).waitFor()
    const submitted = (await send(coord, '/maintenance-requests?status=submitted'))[0]
    await coord.goto(origin + '/requests/' + submitted.id)
    await coord.getByRole('button', { name: 'Approve request' }).click()
    await send(coord, '/maintenance-requests/' + submitted.id + '/reject', 'PATCH', {
      note: 'Duplicate report',
    })
    await coord.getByRole('button', { name: 'Confirm approve' }).click()
    await coord.getByText('Duplicate report', { exact: true }).first().waitFor()
    assert.equal(await coord.getByRole('button', { name: 'Reopen request' }).count(), 0)
    await tech.getByRole('button', { name: 'Open navigation' }).click()
    await tech.keyboard.press('Escape')
    assert.equal(await tech.locator('dialog[open]').count(), 0)
    await coord.setViewportSize({ width: 900, height: 900 })
    await coord.goto(origin)
    await coord.getByRole('heading', { name: 'Recent maintenance requests' }).waitFor()
    assert.ok(await coord.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await member.goto(origin + '/requests?status=reopened')
    await member.getByRole('link', { name: /Repair projector connection/ }).waitFor()
    await member.getByLabel('Search reports').fill('No matching title')
    await member.getByText('No matching reports.').waitFor()
    await member.getByRole('button', { name: 'Clear filters' }).click()
    await member.getByRole('link', { name: /Repair projector connection/ }).waitFor()
    await member.goto(origin + '/requests/new')
    await member.getByRole('button', { name: 'Submit request' }).click()
    assert.ok((await member.locator('select:invalid').count()) > 0)
    await member.goto(origin + detail)
    await member.getByLabel('Comment', { exact: true }).fill('Draft after session expiry')
    await send(member, '/auth/logout', 'POST')
    await member.getByRole('button', { name: 'Post comment' }).click()
    await member.getByLabel('Email', { exact: true }).fill('campus_member@example.test')
    await member.getByLabel('Password', { exact: true }).fill(password)
    await member.getByRole('button', { name: 'Sign in' }).click()
    await member.getByLabel('Comment', { exact: true }).waitFor()
    assert.equal(
      await member.getByLabel('Comment', { exact: true }).inputValue(),
      'Draft after session expiry',
    )
    await member.goto(origin + '/users')
    await member.getByRole('heading', { name: 'This page is unavailable' }).waitFor()
    await member.goto(origin + '/profile')
    await member.getByRole('button', { name: 'Sign out' }).click()
    await member.waitForURL('**/login')
    await member.goto(origin + '/qa/results')
    await member.waitForURL('**/login?**')
    await admin.goto(origin + '/qa/results')
    await admin.getByRole('heading', {name:'API test results'}).waitFor()
    assert.equal(await admin.locator('tbody tr').count(), 96)
    assert.deepEqual(errors, [])
    assert.deepEqual(failed, [])
    console.log(
      'Passed four-role browser workflow, conflict recovery, comment privacy, mobile navigation, tablet layout, logout and QA viewer.',
    )
  } finally {
    await browser?.close()
    await new Promise((resolve) => app.httpServer.close(resolve))
  }
})
