import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { withTestApi } from './test-api.mjs'

await withTestApi(async (base, password) => {
  process.env.CAMPUS_API_ORIGIN = new URL(base).origin
  const app = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
  const origin = 'http://127.0.0.1:' + app.httpServer.address().port
  let browser,
    checks = 0,
    layouts = 0
  const errors = []
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
    async function login(name, role) {
      const context = await browser.newContext()
      const res = await context.request.post(base + '/auth/login', {
        data: { email: name + '@example.test', password },
      })
      assert.equal(res.status(), 200)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(e.message))
      page.setDefaultTimeout(10000)
      return { context, page, role, id: (await res.json()).data.id }
    }
    async function call(user, path, method = 'GET', data, expected = 200) {
      const res = await user.context.request.fetch(base + path, {
        method,
        data,
        headers: { 'X-Campus-Role': user.role, 'X-Campus-Account': String(user.id) },
      })
      const json = await res.json()
      assert.equal(
        res.status(),
        expected,
        method + ' ' + path + ' as ' + user.role + ' ' + (json.error || '')
      )
      if (expected >= 400) assert.ok(json.error && !json.data)
      ++checks
      return json.data
    }
    async function layout(page, name, dialogButton) {
      for (const width of [375, 768, 823, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        if (width === 375 && !dialogButton) {
          await page.getByRole('button', { name: 'Open navigation' }).click()
          const nav = page.getByRole('navigation', { name: 'Mobile navigation' })
          const inventoryLink = nav.getByRole('link', { name: 'Asset directory' })
          if (/\/(admin|coordinator)\//.test(new URL(page.url()).pathname)) await inventoryLink.waitFor()
          else assert.equal(await inventoryLink.count(), 0)
          await page.getByRole('button', { name: 'Close navigation' }).click()
        }
        for (const theme of ['light', 'dark', 'system']) {
          await page.getByLabel('Theme', { exact: true }).selectOption(theme)
          await page.emulateMedia({ colorScheme: 'dark' })
          const sidebar = page.locator('aside')
          assert.equal(
            await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor),
            theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(25, 36, 49)'
          )
          if (theme === 'system') {
            await page.emulateMedia({ colorScheme: 'light' })
            assert.equal(
              await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor),
              'rgb(255, 255, 255)'
            )
          }
          if (dialogButton) {
            await page.getByRole('button', { name: dialogButton, exact: true }).click()
            await page.locator('dialog[open] button.primary').waitFor()
            await page.keyboard.press('Tab')
            assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest('dialog'))))
          }
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            name + ' overflow at ' + width
          )
          const sample =
            (width === 1440 && theme === 'light') ||
            (width === 375 && theme === 'dark') ||
            (name === 'directory' && [768, 823, 1024].includes(width) && theme === 'system')
          if (process.env.UI_SCREENSHOTS && sample && (!process.env.TEST_QR_REPORTING || name.startsWith('qr-') || name==='member-report'))
            await page.screenshot({
              path: join(process.env.UI_SCREENSHOTS, name + '-' + width + '-' + theme + '.png'),
              animations: 'disabled',
            })
          if (dialogButton) {
            await page.keyboard.press('Escape')
            await page.locator('dialog.asset-dialog').waitFor({ state: 'detached' })
          }
          ++layouts
        }
      }
      console.log('Verified', name, 'at five widths in light, dark and system modes.')
    }
    const admin = await login('admin', 'admin'),
      roles = await call(admin, '/roles')
    async function account(name, role, member_type) {
      const user = await call(
        admin,
        '/users',
        'POST',
        { email: name + '@example.test', password, full_name: name, member_type },
        201
      )
      await call(
        admin,
        '/users/' + user.id + '/roles',
        'POST',
        { role_id: roles.find((r) => r.code === role).id },
        201
      )
      return login(name, role)
    }
    const student = await account('student', 'campus_member', 'student'),
      coord = await account('coordinator', 'coordinator', 'staff')
    const a = await account('technician-a', 'technician', 'contractor'),
      b = await account('technician-b', 'technician', 'contractor')
    assert.notEqual(a.id, b.id)
    const building = await call(
      admin,
      '/buildings',
      'POST',
      { code: 'ENG', name: 'Engineering Hall' },
      201
    )
    const annex = await call(admin, '/buildings', 'POST', { code: 'ANN', name: 'Annex' }, 201)
    async function room(building_id, room_code) {
      return call(admin, '/rooms', 'POST', { building_id, room_code }, 201)
    }
    const oldRoom = await room(building.id, '101'),
      newRoom = await room(building.id, '203'),
      inactiveRoom = await room(annex.id, 'Storage')
    await call(admin, '/rooms/' + inactiveRoom.id, 'PATCH', { is_active: false })
    const [maintenance] = await call(admin, '/maintenance-categories')
    for (const tech of [a, b])
      await call(
        admin,
        '/technician-skills',
        'POST',
        { technician_id: tech.id, category_id: maintenance.id },
        201
      )
    await call(admin, '/priority-policies/normal', 'PUT', {
      response_target_minutes: 60,
      resolution_target_minutes: 300,
      response_warning_minutes: 10,
      resolution_warning_minutes: 30,
      is_active: true,
    })

    const page = admin.page
    await page.goto(origin + '/admin/asset-categories')
    await page.getByRole('button', { name: 'New category' }).click()
    await page.getByLabel('Category code').fill('PROJ')
    await page.getByLabel('Category name').fill('Projectors')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('cell', { name: 'Projectors' }).waitFor()
    await layout(page, 'categories')
    await layout(page, 'category-editor', 'Edit')
    const [cat] = (await call(admin, '/asset-categories?active=true')).rows
    await call(admin, '/asset-categories', 'POST', { code: 'proj', name: 'Duplicate' }, 409)
    await call(admin, '/asset-categories/' + cat.id, 'PATCH', {
      description: 'Classroom projection equipment',
    })
    await page.goto(origin + '/admin/assets')
    await layout(page, 'register-dialog', 'Register equipment')
    await page.getByRole('button', { name: 'Register equipment' }).click()
    await page.getByLabel('Equipment name').fill('Lecture projector')
    const registration = page.getByRole('dialog')
    await registration.getByLabel('Asset category', { exact: true }).selectOption(String(cat.id))
    await registration.getByLabel('Building', { exact: true }).selectOption(String(building.id))
    await registration.getByLabel('Room', { exact: true }).selectOption(String(oldRoom.id))
    await page.getByText('Equipment details and warranty', { exact: true }).click()
    await page.getByLabel('Manufacturer').fill('Campus Optics')
    await page.getByLabel('Model', { exact: true }).fill('P2')
    await page.getByLabel('Serial number').fill('TEST-100')
    await page.getByLabel('Warranty expiry').fill('2030-10-15')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('heading', { name: 'Lecture projector' }).waitFor()
    const id = Number(new URL(page.url()).pathname.split('/').at(-1)),
      assetPath = '/assets/' + id
    const e = await call(admin, assetPath)
    assert.equal(e.asset_code, 'AST-000001')
    assert.equal(e.warranty_expires_at, '2030-10-15')
    assert.equal(e.purchase_date, null)
    await layout(page, 'edit-equipment', 'Edit equipment')
    await layout(page, 'change-status', 'Change status')
    const register = { asset_category_id: cat.id, building_id: building.id, name: 'Portable projector' }
    const parallel = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        call(admin, '/assets', 'POST', { ...register, name: register.name + ' ' + (i + 1) }, 201)
      )
    )
    assert.equal(new Set([e, ...parallel].map((x) => x.asset_code)).size, 6)
    await call(
      admin,
      '/assets',
      'POST',
      { ...register, building_id: annex.id, room_id: oldRoom.id },
      409
    )
    await call(
      admin,
      '/assets',
      'POST',
      { ...register, building_id: annex.id, room_id: inactiveRoom.id },
      409
    )
    await call(admin, '/buildings/' + annex.id, 'PATCH', { is_active: false })
    await call(admin, '/assets', 'POST', { ...register, building_id: annex.id }, 409)
    await call(
      admin,
      assetPath + '/transfer',
      'POST',
      { building_id: annex.id, reason: 'Inactive destination' },
      409
    )
    await call(admin, assetPath, 'PATCH', { room_id: newRoom.id }, 400)
    await call(admin, assetPath, 'PATCH', { asset_code: 'AST-NEW' }, 400)
    await call(admin, assetPath, 'PATCH', { description: 'Ceiling mounted' })
    await call(admin, assetPath + '/status', 'PATCH', { operational_status: 'under_maintenance' })
    await call(admin, '/asset-categories/' + cat.id, 'PATCH', { is_active: false })
    await call(admin, '/assets', 'POST', register, 409)
    await call(admin, '/asset-categories/' + cat.id, 'PATCH', { is_active: true })
    assert.equal((await call(coord, '/assets?search=TEST-100&building_id=' + building.id)).total, 1)
    assert.equal((await call(admin, '/assets?sort=name&limit=2&offset=2')).rows.length, 2)
    await page.goto(origin + '/admin/assets')
    await page.getByRole('link', { name: e.asset_code }).waitFor()
    await layout(page, 'directory')
    const search = page.getByRole('searchbox')
    await search.fill('TEST-100')
    await search.press('Enter')
    await page.getByText('1 result · Page 1 of 1', { exact: true }).waitFor()
    assert.equal(await page.getByRole('table').locator('tbody tr').count(), 1)
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.getByText('6 results · Page 1 of 1', { exact: true }).waitFor()
    for (const u of [student, a, b])
      for (const url of [
        '/assets',
        assetPath,
        assetPath + '/history',
        assetPath + '/locations',
        '/analytics/assets',
      ])
        await call(u, url, 'GET', undefined, 403)
    for (const u of [coord, a, b, student]) {
      await call(u, '/assets', 'POST', register, 403)
      await call(u, assetPath + '/retire', 'POST', { reason: 'Restricted' }, 403)
      await call(
        u,
        assetPath + '/transfer',
        'POST',
        { building_id: annex.id, reason: 'Restricted' },
        403
      )
    }
    const options = await call(
      student,
      '/asset-lookup?building_id=' + building.id + '&room_id=' + oldRoom.id
    )
    assert.deepEqual(Object.keys(options.rows[0]).sort(), ['asset_code', 'id', 'name'])
    assert.equal(options.total, 1)
    const report = {
      building_id: building.id,
      room_id: oldRoom.id,
      asset_id: id,
      category_id: maintenance.id,
      title: 'Projection lamp failure',
      description: 'Lamp flickers during lectures',
    }
    await call(student, '/maintenance-requests', 'POST', { ...report, room_id: newRoom.id }, 409)
    const ordinary = await call(
      student,
      '/maintenance-requests',
      'POST',
      { ...report, asset_id: null, title: 'General classroom issue' },
      201
    )
    assert.equal(ordinary.asset_id, null)
    let qr
    if(process.env.TEST_QR_REPORTING){
      const {scanProjector}=await import('./qr-acceptance.mjs')
      qr=await scanProjector({origin,page,student,admin,coord,a,b,call,id,building,oldRoom,report,layout,password})
    } else {
    await student.page.goto(origin + '/member/requests/new')
    await student.page.getByLabel('Building', { exact: true }).selectOption(String(building.id))
    await student.page.getByLabel('Room (optional)').selectOption(String(oldRoom.id))
    await student.page.getByLabel('Equipment (optional)').selectOption(String(id))
    }
    await student.page.getByLabel('Category', { exact: true }).selectOption(String(maintenance.id))
    await student.page.getByLabel('Title', { exact: true }).fill(report.title)
    await student.page.getByLabel('Description', { exact: true }).fill(report.description)
    await layout(student.page, 'member-report')
    await student.page.getByRole('button', { name: 'Submit request' }).click()
    await student.page.getByRole('heading', { name: report.title }).waitFor()
    const requestId = Number(new URL(student.page.url()).pathname.split('/').at(-1)),
      path = '/maintenance-requests/' + requestId
    assert.equal((await call(student, path)).asset_id, id)
    assert.deepEqual(Object.keys((await call(student, path + '/equipment')).asset).sort(), [
      'asset_code',
      'id',
      'name',
    ])
    assert.equal((await call(coord, '/deadlines?request_id=' + requestId)).total, 1)
    assert.ok((await call(coord, path + '/recommendations')).some((t) => t.id === a.id && t.matching))
    const notice = async (u, event) =>
      (await call(u, '/notifications?event_type=' + event)).rows.filter(
        (n) => n.request_id === requestId
      )
    assert.equal((await notice(coord, 'submitted')).length, 1)
    const transfer = { building_id: building.id, room_id: newRoom.id, reason: 'Move to seminar room' }
    await call(admin, assetPath + '/transfer', 'POST', transfer, 409)
    await call(admin, assetPath + '/retire', 'POST', { reason: 'Old model' }, 409)
    await page.goto(origin + '/admin/assets/' + id)
    await page.getByRole('button', { name: 'Transfer', exact: true }).click()
    await page.getByLabel('Room', { exact: true }).selectOption(String(newRoom.id))
    await page.getByLabel('Reason', { exact: true }).fill(transfer.reason)
    await page.getByRole('button', { name: 'Confirm transfer' }).click()
    await page
      .getByRole('alert')
      .filter({ hasText: 'Resolve open maintenance requests first.' })
      .waitFor()
    await page.keyboard.press('Escape')
    for (const state of ['submitted', 'approved']) {
      if (state === 'approved') await call(coord, path + '/approve', 'PATCH', {})
      for (const u of [a, b]) {
        await call(u, path, 'GET', undefined, 404)
        await call(u, path + '/equipment', 'GET', undefined, 404)
        assert.equal((await notice(u, state)).length, 0)
      }
    }
    const job = await call(coord, path + '/assignments', 'POST', { technician_id: a.id }, 201)
    assert.equal((await notice(a, 'assigned'))[0].assignment_id, job.id)
    assert.equal((await notice(b, 'assigned')).length, 0)
    const scoped = await call(a, path + '/equipment')
    assert.equal(scoped.asset.serial_number, 'TEST-100')
    assert.equal(scoped.history.total, 0)
    await call(b, path + '/equipment', 'GET', undefined, 404)
    await a.page.goto(origin + '/technician/assignments/' + job.id)
    await a.page.getByText('TEST-100', { exact: true }).waitFor()
    await layout(a.page, 'technician-assignment')
    await a.page.getByText('Recommend a condition change', { exact: true }).click()
    await a.page.getByLabel('Recommended condition').selectOption('out_of_service')
    await a.page.getByLabel('Staff note').fill('Lamp requires replacement.')
    await a.page.getByRole('button', { name: 'Record recommendation' }).click()
    await a.page
      .getByText('Condition recommendation recorded in staff comments.', { exact: false })
      .first()
      .waitFor()
    assert.equal((await call(a, path + '/comments')).at(-1).visibility, 'staff_only')
    assert.equal((await call(student, path + '/comments')).length, 0)
    await coord.page.goto(origin + '/coordinator/requests/' + requestId)
    await coord.page.getByText('2030-10-15', { exact: true }).waitFor()
    await layout(coord.page, 'coordinator-review')
    await call(a, '/assignments/' + job.id + '/start', 'PATCH', {})
    const repair = {
      completion_note: 'Replaced projector lamp',
      root_cause: 'electrical_failure',
      materials_used: 'Lamp assembly',
      labor_minutes: 45,
    }
    await call(a, '/assignments/' + job.id + '/complete', 'PATCH', repair)
    await call(coord, path + '/close', 'PATCH', {})
    assert.equal((await notice(student, 'closed')).length, 1)
    assert.equal((await call(student, path)).status, 'closed')
    assert.equal((await call(a, '/assignments/' + job.id)).asset_code, e.asset_code)
    await call(a, path + '/equipment', 'GET', undefined, 404)
    const record = (await call(coord, assetPath + '/history')).rows[0]
    assert.equal(record.reported_room, '101')
    assert.equal(record.labor_minutes, 45)
    assert.equal(record.materials_used, 'Lamp assembly')
    assert.equal(record.decision, 'closed')
    assert.equal((await call(admin, assetPath)).operational_status, 'under_maintenance')
    const { default: db } = await import('../connection.js')
    // Exercise the rollback on this disposable database when the audit insert fails.
    await db.raw(
      "CREATE TRIGGER fixture_block_audit BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Audit fixture'"
    )
    try {
      await call(admin, assetPath + '/transfer', 'POST', transfer, 409)
      assert.equal((await call(admin, assetPath)).room_id, oldRoom.id)
      assert.equal((await call(admin, assetPath + '/locations')).total, 0)
    } finally {
      await db.raw('DROP TRIGGER fixture_block_audit')
    }
    await page.goto(origin + '/admin/assets/' + id)
    await layout(page, 'transfer-dialog', 'Transfer')
    await page.getByRole('button', { name: 'Transfer', exact: true }).click()
    await page.getByLabel('Room', { exact: true }).selectOption(String(newRoom.id))
    await page.getByLabel('Reason', { exact: true }).fill(transfer.reason)
    await page.getByRole('button', { name: 'Confirm transfer' }).click()
    await page.getByText('Projectors · Engineering Hall · 203', { exact: true }).waitFor()
    await layout(page, 'asset-details')
    if(qr){const {verifyMoved}=await import('./qr-acceptance.mjs');await verifyMoved({qr,student,admin,coord,call,newRoom,report,id})}
    const moved = await call(admin, assetPath)
    const [movement] = (await call(admin, assetPath + '/locations')).rows
    assert.equal(moved.room_id, newRoom.id)
    assert.equal(movement.previous_room_id, oldRoom.id)
    assert.equal(movement.actor_id, admin.id)
    assert.equal(movement.reason, transfer.reason)
    assert.equal((await call(student, path)).room_id, oldRoom.id)
    await assert.rejects(
      db('asset_location_history').where({ id: movement.id }).update({ reason: 'Changed' }),
      { errno: 1644 }
    )
    await assert.rejects(db('asset_location_history').where({ id: movement.id }).del(), { errno: 1644 })
    await call(coord, path + '/reopen', 'PATCH', { note: 'Second inspection' })
    const second = await call(coord, path + '/assignments', 'POST', { technician_id: a.id }, 201)
    const replacement = await call(
      coord,
      path + '/reassign',
      'POST',
      { technician_id: b.id, note: 'Shift change' },
      201
    )
    await call(a, path + '/equipment', 'GET', undefined, 404)
    assert.equal((await call(a, '/assignments/' + second.id)).end_reason, 'reassigned')
    assert.equal((await call(b, path + '/equipment')).history.rows[0].assignment_id, job.id)
    assert.equal((await call(b, path + '/equipment')).history.total, 1)
    const unrelated = await call(
      student,
      '/maintenance-requests',
      'POST',
      { ...report, asset_id: parallel[0].id, room_id: undefined },
      201
    )
    await call(b, '/maintenance-requests/' + unrelated.id + '/equipment', 'GET', undefined, 404)
    const hist = (await call(coord, assetPath + '/history')).rows
    assert.equal(hist.length, 3)
    assert.ok(hist.every((r) => r.reported_room === '101' && r.was_reopened))
    assert.equal(hist.find((r) => r.assignment_id === replacement.id).end_reason, null)
    const retiredLabel = qr && await call(admin,'/qr/asset/'+parallel[1].id,'POST',{})
    await call(admin, '/assets/' + parallel[1].id + '/retire', 'POST', {}, 400)
    await page.goto(origin + '/admin/assets/' + parallel[1].id)
    await layout(page, 'retirement-dialog', 'Retire')
    await page.getByRole('button', { name: 'Retire', exact: true }).click()
    await page.getByLabel('Reason', { exact: true }).fill('Withdrawn from service')
    await page.getByRole('button', { name: 'Confirm retirement' }).click()
    await page.getByText(/Withdrawn from service/).waitFor()
    await call(
      student,
      '/maintenance-requests',
      'POST',
      { ...report, asset_id: parallel[1].id, room_id: undefined },
      409
    )
    await call(admin, '/assets/' + parallel[1].id + '/transfer', 'POST', transfer, 409)
    if(qr) {
      await call(student,new URL(retiredLabel.url).pathname,'GET',undefined,409)
      const roomLabel = await call(admin,'/qr/room/'+newRoom.id,'POST',{})
      await call(admin,'/rooms/'+newRoom.id,'PATCH',{is_active:false})
      await call(student,new URL(roomLabel.url).pathname,'GET',undefined,409)
      await call(admin,'/rooms/'+newRoom.id,'PATCH',{is_active:true})
      await coord.page.goto(origin+'/coordinator/analytics/qr')
      await coord.page.getByRole('heading',{name:'Reports by source'}).waitFor()
      await layout(coord.page,'qr-analytics')
    }
    const stats = await call(admin, '/analytics/assets')
    const metric = (key) => stats.metrics.find((m) => m.label === key).value
    assert.equal(metric('Registered assets'), 6)
    assert.equal(metric('Retired assets'), 1)
    assert.equal(metric('Assets with open requests'), 2)
    assert.equal(metric('Repairs completed in period'), 1)
    assert.equal(metric('Recorded labor in period'), 45)
    assert.equal(
      stats.series
        .find((s) => s.title === 'Most reported in period')
        .rows.find((r) => r.label.includes(e.asset_code)).value,
      1
    )
    assert.equal(
      stats.series.find((s) => s.title === 'Repair causes in period').rows[0].label,
      repair.root_cause
    )
    const empty = await call(admin, '/analytics/assets?to=1900-01-01')
    assert.equal(empty.metrics.find((m) => m.label === 'Recorded labor in period').value, null)
    for (const action of [
      'asset_registered',
      'asset_edited',
      'asset_status_changed',
      'asset_transferred',
      'asset_retired',
      'asset_category_created',
      'asset_category_edited',
    ]) {
      const audit = await call(admin, '/audit-logs?action=' + action)
      assert.ok(audit.total > 0 && audit.rows.every((r) => r.actor_id === admin.id), action)
    }
    await page.goto(origin + '/admin/analytics/assets')
    await page.getByText('Repairs completed in period', { exact: true }).waitFor()
    await layout(page, 'asset-analytics')
    // The losing operation must observe the winner's location or unresolved report.
    const raceAsset = parallel[4].id
    const [reportRace, transferRace] = await Promise.all([
      student.context.request.post(base + '/maintenance-requests', {
        data: { ...report, asset_id: raceAsset, room_id: null },
      }),
      admin.context.request.post(base + '/assets/' + raceAsset + '/transfer', { data: transfer }),
    ])
    if (reportRace.status() === 201) assert.equal(transferRace.status(), 409)
    else {
      assert.equal(reportRace.status(), 409)
      assert.equal(transferRace.status(), 200)
    }
    const persisted = await call(admin, '/assets/' + raceAsset)
    assert.equal(persisted.room_id, reportRace.status() === 201 ? null : newRoom.id)
    assert.deepEqual(errors, [])
    console.log(
      'Asset acceptance passed:',
      checks,
      'API response checks;',
      layouts,
      'viewport/theme checks. Database, ownership, history, audit and analytics assertions passed.'
    )
  } finally {
    await browser?.close()
    await new Promise((resolve) => app.httpServer.close(resolve))
  }
})
