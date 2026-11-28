import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PNG} from 'pngjs'
import jsQR from 'jsqr'

export async function scanProjector({origin,page,student,admin,coord,a,b,call,id,building,oldRoom,report,layout,password}) {
  process.env.CMS_PUBLIC_BASE_URL=origin
  const path='/qr/asset/'+id
  const generated=await Promise.all(Array.from({length:4},()=>call(admin,path,'POST',{})))
  assert.equal(new Set(generated.map(x=>x.id)).size,1)
  const label=generated[0], token=new URL(label.url).pathname.split('/').pop()
  for(const user of [a,b,student,coord]) await call(user,path,'POST',{},403)
  for(const invalid of ['','https://user:pass@example.test','https://campus.example.test/path','http://campus.example.test']) {
    process.env.CMS_PUBLIC_BASE_URL=invalid
    await call(admin,path,'POST',{},503)
  }
  process.env.CMS_PUBLIC_BASE_URL='https://campus.example.test'
  assert.equal(new URL((await call(admin,path,'POST',{})).url).pathname,new URL(label.url).pathname)
  process.env.CMS_PUBLIC_BASE_URL=origin
  await page.goto(origin+'/admin/qr-labels?type=asset&id='+id)
  const generateButton=page.getByRole('button',{name:'Generate labels'})
  process.env.CMS_PUBLIC_BASE_URL=''
  await generateButton.click()
  await page.getByRole('alert').filter({hasText:'Set CMS_PUBLIC_BASE_URL in server/.env'}).waitFor()
  await layout(page,'qr-configuration-error')
  process.env.CMS_PUBLIC_BASE_URL=origin
  await generateButton.focus()
  assert.ok(await generateButton.evaluate(el=>el===document.activeElement))
  await page.keyboard.press('Enter')
  const downloadPromise=page.waitForEvent('download')
  await page.getByRole('link',{name:'Download PNG'}).click()
  const png=PNG.sync.read(await readFile(await (await downloadPromise).path()))
  const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height)
  assert.equal(decoded.data,origin+'/scan/'+token)
  await page.emulateMedia({media:'print'})
  assert.equal(await page.locator('.qr-sheet img').isVisible(),true)
  await page.emulateMedia({media:'screen'})
  await layout(page,'qr-labels')
  await page.getByRole('checkbox').nth(1).check()
  await page.getByRole('button',{name:'Generate labels'}).click()
  await page.locator('.qr-sheet img').nth(1).waitFor()
  for(const [type,target] of [['building',building],['room',oldRoom]]) {
    const item=await call(admin,'/qr/'+type+'/'+target.id,'POST',{})
    const scan=new URL(item.url).pathname
    assert.notEqual(item.url,label.url)
    assert.equal((await call(student,scan)).id,target.id)
    await call(student,'/maintenance-requests','POST',{...report,building_id:999999,qr_token:scan.split('/').pop()},409)
    await call(student,'/maintenance-requests','POST',{...report,asset_id:null,building_id:building.id,room_id:type==='room'?oldRoom.id:null,qr_token:scan.split('/').pop()},201)
  }
  await call(student,'/scan/'+'A'.repeat(43),'GET',undefined,404)
  await student.page.goto(origin+'/scan/'+'A'.repeat(43))
  await student.page.getByText('This label is unavailable.').waitFor()
  await layout(student.page,'qr-unavailable')
  await student.page.getByRole('link',{name:'Report an issue manually'}).focus()
  await student.page.keyboard.press('Enter')
  await student.page.waitForURL(origin+'/member/requests/new')
  await student.context.clearCookies()
  await student.page.goto(origin+'/login?next='+encodeURIComponent('//other.example.test'))
  await student.page.getByLabel('Email').fill('student@example.test')
  await student.page.getByLabel('Password').fill(password)
  await student.page.getByRole('button',{name:'Sign in'}).click()
  await student.page.waitForURL(origin+'/member/dashboard')
  await student.context.clearCookies()
  await student.page.goto(decoded.data)
  await student.page.getByLabel('Email').waitFor()
  for(const width of [375,768,823,1024,1440]) {
    await student.page.setViewportSize({width,height:900})
    for(const theme of ['light','dark','system']){
      await student.page.getByLabel('Theme',{exact:true}).selectOption(theme)
      assert.ok(await student.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    }
  }
  await student.page.getByLabel('Email').fill('student@example.test')
  await student.page.getByLabel('Password').fill(password)
  await student.page.getByRole('button',{name:'Sign in'}).click()
  await student.page.getByRole('heading',{name:'Report a maintenance issue'}).waitFor()
  assert.equal(student.page.url(),decoded.data)
  assert.equal(await student.page.getByLabel('Equipment (optional)').inputValue(),String(id))
  return {token,label,path}
}
export async function verifyMoved({qr,student,admin,coord,call,newRoom,report,id}) {
  const scan='/scan/'+qr.token
  assert.equal((await call(student,scan)).room_id,newRoom.id)
  await call(student,'/maintenance-requests','POST',{...report,qr_token:qr.token,asset_id:id},409)
  const stats=await call(coord,'/analytics/qr')
  assert.equal(stats.sources.find(s=>s.reporting_source==='qr').total,3)
  assert.equal(stats.assets[0].total,1)
  assert.equal(stats.buildings[0].total,3)
  const replacement=await call(admin,qr.path,'POST',{replace_id:qr.label.id})
  assert.notEqual(replacement.url,qr.label.url)
  await call(student,scan,'GET',undefined,404)
  await call(admin,'/qr-revocations/'+replacement.id,'POST',{})
  await call(student,new URL(replacement.url).pathname,'GET',undefined,404)
  await call(student,'/maintenance-requests','POST',{...report,qr_token:qr.token,room_id:newRoom.id},404)
  const next=await call(admin,qr.path,'POST',{})
  assert.equal((await call(student,new URL(next.url).pathname)).id,id)
  for(const action of ['qr_created','qr_replaced','qr_revoked']){
    const log=await call(admin,'/audit-logs?action='+action)
    assert.ok(log.rows.length && log.rows.every(r=>r.actor_id===admin.id))
    assert.ok(!JSON.stringify(log).includes(qr.token))
  }
}
