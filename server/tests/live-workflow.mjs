import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import db from '../connection.js';

// Explicitly opt in because this acceptance test writes through the development UI.
assert.equal(process.env.CMS_LIVE_TEST, 'confirmed-development');
assert.ok(process.env.CMS_TEST_PASSWORD);
const origin = process.env.CMS_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.CMS_SCREENSHOTS;
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const failures = [];
async function sign(email) {
  const context = await browser.newContext({viewport:{width:1440,height:960}});
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(e.message));
  page.on('response', async response => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith('/api/') || path.includes('/auth/') || path === '/api/me') return;
    if (response.status() >= 400) failures.push(path+' '+response.status());
    if (response.request().method() !== 'GET')
      console.log(response.request().method(),path,response.status(),await response.text().catch(()=>'Response body unavailable after navigation'));
  });
  await page.goto(origin+'/login');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(process.env.CMS_TEST_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL('**/dashboard');
  return page;
}
async function assign(page, id) {
  await page.goto(origin+'/coordinator/requests/'+id);
  await page.getByRole('button',{name:'Approve request',exact:true}).click();
  await page.getByRole('button',{name:'Confirm approve',exact:true}).click();
  await page.getByRole('button',{name:'Assign technician',exact:true}).click();
  await page.getByLabel('Technician',{exact:true}).selectOption('12');
  await page.getByRole('button',{name:'Confirm assign',exact:true}).click();
  await page.getByRole('button',{name:'Reassign technician',exact:true}).waitFor();
  const row = await db('work_assignments').where({request_id:id}).whereNull('ended_at').first();
  assert.equal(row.technician_id,12);
  assert.equal((await db('maintenance_requests').where({id}).first()).status,'assigned');
  console.log('Persisted assignment',row.id,'request',id,'technician',row.technician_id);
  return row.id;
}
try {
  const faculty = await sign('faculty@uni.edu');
  const coord = await sign('staff@uni.edu');
  const tech = await sign('contractor@uni.edu');
  const student = await sign('student@uni.edu');
  await tech.goto(origin+'/technician/history');
  await tech.getByRole('link',{name:'ASG-2',exact:true}).waitFor();
  await coord.goto(origin+'/coordinator/verification');
  await coord.getByRole('link',{name:'ASG-2',exact:true}).waitFor();
  console.log('REQ-5 verified in technician history and coordinator verification');
  await student.goto(origin+'/member/requests/7');
  if (!(await db('request_comments').where({request_id:7,body:'Development verification: additional information from the reporter.'}).first())) {
  await student.getByLabel('Comment',{exact:true}).fill('Development verification: additional information from the reporter.');
  await student.getByRole('button',{name:'Post comment',exact:true}).click();
  await student.getByText('Comment posted.').waitFor();
  }
  await student.reload();
  await student.getByText('Development verification: additional information from the reporter.',{exact:true}).first().waitFor();
  for (const id of [6,7]) {
    if ((await db('maintenance_requests').where({id}).first()).status === 'submitted') await assign(coord,id);
  }
  await faculty.goto(origin+'/member/requests/new');
  await faculty.getByLabel(/^Building/).selectOption('5');
  await faculty.getByLabel(/^Category/).selectOption('4');
  const title = 'Development workflow verification '+Date.now();
  await faculty.getByLabel('Title',{exact:true}).fill(title);
  await faculty.getByLabel('Description',{exact:true}).fill('Projector connection requires inspection.');
  await faculty.getByRole('button',{name:'Submit request',exact:true}).click();
  await faculty.getByRole('heading',{name:title,exact:true}).waitFor();
  const id = Number(new URL(faculty.url()).pathname.split('/').at(-1));
  await faculty.getByLabel('Comment',{exact:true}).fill('The projector loses its signal.');
  await faculty.getByRole('button',{name:'Post comment',exact:true}).click();
  await faculty.getByText('Comment posted.').waitFor();
  await faculty.reload();
  await faculty.getByText('The projector loses its signal.',{exact:true}).waitFor();
  assert.equal((await db('request_comments').where({request_id:id}).first()).author_id,10);
  const job = await assign(coord,id);
  await tech.goto(origin+'/technician/assignments');
  await tech.getByRole('link',{name:'ASG-'+job,exact:true}).waitFor();
  for (const width of [375,768,823,1024,1440]) {
    await tech.setViewportSize({width,height:960});
    for (const theme of ['light','dark','system']) {
      await tech.getByLabel('Theme',{exact:true}).selectOption(theme);
      assert.ok(await tech.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const heading = tech.locator('.pagehead h1');
      assert.ok(await heading.evaluate(el=>el.getBoundingClientRect().height < 50),'Heading wrapped at '+width);
      if (output) await tech.screenshot({path:output+'/technician-'+width+'-'+theme+'.png'});
    }
  }
  await tech.getByRole('link',{name:'ASG-'+job,exact:true}).click();
  await tech.getByRole('button',{name:'Start work',exact:true}).click();
  await tech.getByLabel('Root cause',{exact:true}).selectOption('electrical_failure');
  await tech.getByLabel('Hours',{exact:true}).fill('1');
  await tech.getByLabel('Minutes',{exact:true}).fill('15');
  await tech.getByLabel('Completion note',{exact:true}).fill('Inspected and replaced the projector cable.');
  await tech.getByRole('button',{name:'Submit for verification',exact:true}).click();
  await tech.getByRole('heading',{name:'Assignment record',exact:true}).waitFor();
  await coord.goto(origin+'/coordinator/verification');
  await coord.getByRole('link',{name:title,exact:true}).click();
  await coord.getByRole('button',{name:'Close request',exact:true}).click();
  await coord.getByRole('button',{name:'Confirm close',exact:true}).click();
  await coord.getByRole('button',{name:'Reopen request',exact:true}).waitFor();
  await coord.goto(origin+'/coordinator/history');
  await coord.getByRole('link',{name:'ASG-'+job,exact:true}).waitFor();
  await tech.goto(origin+'/technician/history');
  await tech.getByRole('link',{name:'ASG-'+job,exact:true}).waitFor();
  await faculty.reload();
  await faculty.getByText('Closed',{exact:true}).first().waitFor();
  await faculty.getByText('The projector loses its signal.',{exact:true}).waitFor();
  assert.equal((await db('maintenance_requests').where({id}).first()).status,'closed');
  assert.equal((await db('work_assignments').where({id:job}).first()).end_reason,'completed');
  assert.deepEqual(failures,[]);
  console.log('PASS live workflow', {request:id,assignment:job,reporter:10,coordinator:11,technician:12});
} finally {
  await browser.close();
  await db.destroy();
}


