import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import db from '../connection.js';

const title = 'TEST QR projector report — Phase 3.4 development verification';
let browser;
async function signIn(page, role) {
  const email = process.env['CMS_DEV_'+role+'_EMAIL'];
  const password = process.env['CMS_DEV_'+role+'_PASSWORD'];
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
try {
  const origin = new URL(process.env.CMS_PUBLIC_BASE_URL);
  const [[target]] = await db.raw('SELECT DATABASE() AS name');
  assert.ok(process.argv.includes('--confirm=cms_maintenance') && process.env.NODE_ENV !== 'production');
  assert.ok(['127.0.0.1','localhost'].includes(origin.hostname) && !origin.username && !origin.password);
  assert.ok(['127.0.0.1','localhost'].includes(process.env.DB_HOST) && target.name === 'cms_maintenance');
  for (const role of ['ADMIN','STUDENT']) {
    assert.ok(process.env['CMS_DEV_'+role+'_EMAIL'] && process.env['CMS_DEV_'+role+'_PASSWORD'],'Missing development login');
  }
  const student = await db('users').where({email:process.env.CMS_DEV_STUDENT_EMAIL,is_active:1,member_type:'student'}).first('id');
  assert.ok(student,'Expected an active student identity');
  const equipment = await db('assets').whereIn('serial_number',['CMS-TEST-PRJ-001','CMS-TEST-PC-001','CMS-TEST-LAP-001'])
    .where({operational_status:'operational'}).whereLike('name','TEST %').orderBy('id');
  assert.equal(equipment.length,3);
  const projector = equipment.find(row => row.serial_number === 'CMS-TEST-PRJ-001');
  const rooms = await db('rooms as r').join('buildings as b','b.id','r.building_id')
    .where({'r.is_active':1,'b.is_active':1}).orderBy(['b.code','r.room_code']).limit(2).select('r.id');
  assert.equal(rooms.length,2);
  const targets = [...equipment.map(row=>['asset',row.id]),...rooms.map(row=>['room',row.id]),['building',projector.building_id]];
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
  const adminPage = await browser.newPage();
  await adminPage.goto(origin.origin+'/login');
  await signIn(adminPage,'ADMIN');
  await adminPage.waitForURL('**/dashboard');
  let projectorUrl, projectorQr;
  for (const [type,id] of targets) {
    await adminPage.goto(origin.origin+'/admin/qr-labels?type='+type+'&id='+id);
    await adminPage.getByRole('button',{name:'Generate labels'}).click();
    const link = adminPage.getByRole('link',{name:/Download PNG/});
    await link.waitFor();
    const download = adminPage.waitForEvent('download');
    await link.click();
    const png = PNG.sync.read(await readFile(await (await download).path()));
    const decoded = jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
    const code = await db('qr_codes').where({[type+'_id']:id}).whereNull('revoked_at').first();
    assert.ok(code && decoded && decoded.data === origin.origin+'/scan/'+code.token,'Generated PNG must match persisted active label');
    if (type === 'asset' && id === projector.id) { projectorUrl=decoded.data; projectorQr=code.id; }
    console.log('Decoded',type,id,'QR record',code.id);
  }
  let request = await db('maintenance_requests').where({title,reporter_id:student.id,asset_id:projector.id,qr_code_id:projectorQr}).first();
  if (!request) {
    const page = await browser.newPage({viewport:{width:375,height:900}});
    await page.goto(projectorUrl);
    await page.waitForURL('**/login?**');
    await signIn(page,'STUDENT');
    await page.waitForURL(projectorUrl);
    assert.equal(await page.getByLabel('Equipment (optional)').inputValue(),String(projector.id));
    assert.equal(await page.getByLabel('Building',{exact:true}).inputValue(),String(projector.building_id));
    assert.equal(await page.getByLabel('Room (optional)').inputValue(),String(projector.room_id));
    const category = await db('maintenance_categories').where({is_active:1}).orderBy('id').first('id');
    await page.getByLabel('Category',{exact:true}).selectOption(String(category.id));
    await page.getByLabel('Title',{exact:true}).fill(title);
    await page.getByLabel('Description',{exact:true}).fill('Fictional test report to verify projector QR intake.');
    await page.getByRole('button',{name:'Submit request',exact:true}).click();
    await page.getByRole('heading',{name:title}).waitFor();
    request=await db('maintenance_requests').where({id:Number(new URL(page.url()).pathname.split('/').pop())}).first();
    assert.equal(request.status,'submitted');
  }
  assert.equal(request.asset_id,projector.id);
  assert.equal(request.qr_code_id,projectorQr);
  assert.equal(request.reporting_source,'qr');
  const notices=await db('notifications').where({request_id:request.id,event_type:'submitted'}).select('portal');
  assert.ok(notices.length>0 && notices.every(row=>row.portal==='coordinator'));
  console.log('Verified report',request.id,'asset',projector.id,'QR',projectorQr,'status',request.status,'coordinator notices',notices.length);
} catch (error) {
  // Browser errors can contain scan URLs and private form data.
  console.error('Development QR verification failed:',error.name);
  process.exitCode=1;
} finally {
  await browser?.close();
  await db.destroy();
}
