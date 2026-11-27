import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { withTestApi } from './test-api.mjs'

await withTestApi(async (base, password) => {
  process.env.CAMPUS_API_ORIGIN = new URL(base).origin
  const app = await preview({preview:{host:'127.0.0.1',port:0,open:false}})
  const origin = 'http://127.0.0.1:' + app.httpServer.address().port
  let browser
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true})
    async function login(name, role) {
      const context = await browser.newContext({viewport:{width:390,height:844}})
      const response = await context.request.post(base+'/auth/login',{data:{email:name+'@example.test',password}})
      assert.equal(response.status(),200)
      return {context, role, id:(await response.json()).data.id}
    }
    async function call(user,path,method='GET',data,status=200) {
      const response = await user.context.request.fetch(base+path,{
        method,data,headers:{'X-Campus-Role':user.role,'X-Campus-Account':String(user.id)}
      })
      assert.equal(response.status(),status,user.role+' '+method+' '+path)
      const json = await response.json()
      if (status >= 400) {
        assert.equal(typeof json.error,'string')
        assert.equal(json.data,undefined)
      }
      return json.data
    }
    const admin = await login('admin','admin')
    const roles = await call(admin,'/roles')
    async function account(name,role,member_type,extraRoles=[]) {
      const user = await call(admin,'/users','POST',{email:name+'@example.test',full_name:name,password,member_type},201)
      for (const code of [role,...extraRoles]) {
        await call(admin,'/users/'+user.id+'/roles','POST',{role_id:roles.find(r=>r.code===code).id},201)
      }
      return login(name,role)
    }
    const student = await account('student','campus_member','student')
    const coord = await account('coordinator','coordinator','staff')
    const a = await account('tech-a','technician','contractor')
    const b = await account('tech-b','technician','staff',['coordinator'])
    assert.notEqual(a.id,b.id)
    const bCoordinator = {...b,role:'coordinator'}
    const building = await call(admin,'/buildings','POST',{code:'LAB',name:'Teaching lab'},201)
    const [category] = await call(admin,'/maintenance-categories')
    for (const user of [a,b]) await call(admin,'/technician-skills','POST',{technician_id:user.id,category_id:category.id},201)
    await call(admin,'/priority-policies/normal','PUT',{response_target_minutes:60,resolution_target_minutes:300,
      response_warning_minutes:10,resolution_warning_minutes:30,is_active:true})
    const submit = title => call(student,'/maintenance-requests','POST',{building_id:building.id,category_id:category.id,
      title,description:'Loose classroom fixture'},201)
    const report = await submit('Classroom fixture repair')
    const path = '/maintenance-requests/'+report.id
    const notices = async (user,event) => (await call(user,'/notifications?event_type='+event)).rows.filter(n=>n.request_id===report.id)
    const jobs = async (user,scope='active') => (await call(user,'/work-records?scope='+scope)).rows
    const summary = user => call(user,'/my-job-summary')
    const pageA = await a.context.newPage(), pageB = await b.context.newPage()
    async function visit(page,route,responsePath) {
      const next = page.waitForResponse(r=>new URL(r.url()).pathname==='/api'+responsePath)
      await page.goto(origin+route)
      const response = await next
      assert.equal(response.request().headers()['x-campus-role'],'technician')
      return {status:response.status(),body:await response.json(),url:new URL(response.url()).pathname+new URL(response.url()).search}
    }
    for (const [name,page] of [['A',pageA],['B',pageB]]) {
      const result = await visit(page,'/technician/dashboard','/work-records')
      assert.deepEqual(result.body.data.rows,[])
      await page.getByText('No active assignments.',{exact:true}).waitFor()
      console.log('Submitted, technician',name,result.url,'returned 0 jobs')
      if (process.env.UI_SCREENSHOTS && name==='A') await page.screenshot({path:join(process.env.UI_SCREENSHOTS,'technician-dashboard.png')})
    }
    for (const [name,page] of [['A',pageA],['B',pageB]]) {
      const result = await visit(page,'/technician/notifications?event_type=submitted','/notifications')
      console.log('Submitted, technician',name,result.url,'returned',result.body.data.rows.map(n=>({portal:n.portal,request_id:n.request_id})))
      assert.equal(result.body.data.total,0,'Technician inbox contains a submission')
    }
    async function denied(user,record) {
      for (const suffix of ['','/history','/comments','/attachments']) await call(user,record+suffix,'GET',undefined,404)
      await call(user,record+'/comments','POST',{body:'Fixture comment'},404)
    }
    async function noOperationalAccess(user) {
      await denied(user,path)
      assert.equal((await call(user,'/maintenance-requests?search=Classroom&totals=true&limit=1&offset=0')).total,0)
      assert.equal((await call(user,'/deadlines?request_id='+report.id)).total,0)
      assert.equal((await jobs(user)).length,0)
      assert.equal((await summary(user)).active,0)
    }
    assert.equal((await call(coord,path)).status,'submitted')
    assert.equal((await notices(coord,'submitted')).length,1)
    const coordinatorNotices = await notices(bCoordinator,'submitted')
    assert.equal(coordinatorNotices.length,1)
    await call(b,'/notifications/'+coordinatorNotices[0].id+'/read','PATCH',{},404)
    assert.equal((await b.context.request.get(base+'/maintenance-requests')).status(),403)
    assert.equal((await call(bCoordinator,path)).status,'submitted')
    await pageB.goto(origin+'/technician/requests')
    await pageB.getByRole('heading',{name:'This page is unavailable'}).waitFor()
    await call(b,'/notifications/read','PATCH',{})
    assert.equal((await notices(bCoordinator,'submitted'))[0].read_at,null)
    for (const user of [a,b]) {
      await noOperationalAccess(user)
      for (const endpoint of ['/maintenance-requests/summary','/statistics','/deadline-summary','/analytics/operations'])
        await call(user,endpoint,'GET',undefined,403)
    }
    const {default:db} = await import('../connection.js')
    const {default:worker} = await import('../module/deadline.module.js')
    await db('request_deadlines').where({request_id:report.id}).update({response_due_at:db.raw('NOW() + INTERVAL 5 MINUTE'),
      response_next_alert:db.fn.now(),resolution_due_at:db.raw('NOW() - INTERVAL 1 MINUTE'),resolution_next_alert:db.fn.now()})
    await worker.process()
    await worker.process()
    for (const event of ['response_approaching','resolution_missed']) {
      assert.equal((await notices(coord,event)).length,1)
      for (const user of [a,b]) assert.equal((await notices(user,event)).length,0)
    }
    await call(student,path+'/comments','POST',{body:'Projector is offline.'},201)
    await db('request_attachments').insert({request_id:report.id,uploaded_by_id:student.id,storage_key:'fixture',
      original_filename:'fixture.png',mime_type:'image/png',file_size_bytes:120})
    assert.equal((await call(coord,path+'/approve','PATCH',{})).status,'approved')
    assert.equal((await notices(student,'approved')).length,1)
    for (const user of [a,b]) {
      await noOperationalAccess(user)
      assert.equal((await notices(user,'approved')).length,0)
      assert.equal((await notices(user,'public_comment')).length,0)
    }
    const job = await call(coord,path+'/assignments','POST',{technician_id:a.id},201)
    const assignment = '/assignments/'+job.id
    assert.equal((await notices(a,'assigned'))[0].assignment_id,job.id)
    assert.equal((await notices(student,'assigned')).length,1)
    assert.equal((await notices(b,'assigned')).length,0)
    const myJobs = await visit(pageA,'/technician/assignments','/work-records')
    assert.deepEqual(myJobs.body.data.rows.map(j=>j.id),[job.id])
    await pageA.getByText(report.title,{exact:true}).waitFor()
    assert.equal((await call(a,path)).status,'assigned')
    assert.equal((await call(a,path+'/attachments'))[0].original_filename,'fixture.png')
    assert.equal((await call(a,path+'/comments'))[0].body,'Projector is offline.')
    assert.equal((await summary(a)).waiting,1)
    assert.equal((await call(a,'/work-records?scope=active&sort=priority')).total,1)
    assert.equal((await call(a,'/deadlines?request_id='+report.id)).total,1)
    await noOperationalAccess(b)
    await call(b,assignment,'GET',undefined,404)
    await call(b,assignment+'/start','PATCH',{},404)
    assert.equal((await call(b,'/work-records?scope=all&technician_id='+a.id+'&search=Classroom&limit=1')).total,0)
    const direct = await visit(pageB,'/technician/requests/'+report.id,path)
    assert.equal(direct.status,404)
    assert.equal(direct.body.data,undefined)
    assert.equal((await visit(pageB,'/technician'+assignment,assignment)).status,404)
    assert.equal((await call(a,assignment+'/start','PATCH',{})).status,'in_progress')
    assert.equal((await summary(a)).started,1)
    const completed = await call(a,assignment+'/complete','PATCH',{completion_note:'Fixture repaired',root_cause:'unknown'})
    assert.equal(completed.status,'completed')
    assert.deepEqual((await jobs(coord,'verification')).map(j=>j.id),[job.id])
    assert.equal((await notices(coord,'completed')).length,1)
    assert.equal((await summary(a)).active,0)
    assert.equal((await summary(a)).verification,1)
    assert.equal((await call(coord,path+'/close','PATCH',{})).status,'closed')
    await noOperationalAccess(a)
    await call(a,assignment+'/progress','PATCH',{body:'Ended'},404)
    const past = await visit(pageA,'/technician/history','/work-records')
    assert.deepEqual(past.body.data.rows.map(j=>j.end_reason),['completed'])
    assert.equal(past.body.data.rows[0].resolution_state,null)
    assert.equal((await call(a,assignment)).decision,'closed')
    assert.equal((await summary(a)).completed,1)
    assert.equal((await notices(a,'closed'))[0].assignment_id,job.id)
    assert.equal((await notices(student,'closed')).length,1)
    assert.equal((await call(student,path)).status,'closed')
    const activePage = await visit(pageA,'/technician/assignments?scope=all','/work-records')
    assert.equal(activePage.body.data.total,0)
    await noOperationalAccess(b)
    await call(b,assignment,'GET',undefined,404)

    await call(coord,path+'/reopen','PATCH',{note:'Additional repair'})
    for (const user of [a,b]) await noOperationalAccess(user)
    const second = await call(coord,path+'/assignments','POST',{technician_id:a.id},201)
    const third = await call(coord,path+'/reassign','POST',{technician_id:b.id,note:'Change of shift'},201)
    await call(coord,path+'/comments','POST',{body:'For the replacement technician',visibility:'staff_only'},201)
    assert.equal((await call(a,'/assignments/'+second.id)).end_reason,'reassigned')
    assert.equal((await notices(a,'reassigned'))[0].assignment_id,second.id)
    await noOperationalAccess(a)
    assert.deepEqual((await call(a,'/assignments?request_id='+report.id)).map(j=>j.id),[second.id,job.id])
    const old = await call(a,'/assignments/'+second.id)
    for (const field of ['description','location_note','priority','status']) assert.equal(old[field],null,field)
    await pageA.goto(origin+'/technician/notifications?event_type=reassigned')
    await pageA.getByRole('button',{name:'Open record'}).click()
    await pageA.waitForURL('**/technician/assignments/'+second.id)
    await pageA.getByRole('heading',{name:'Assignment record'}).waitFor()
    assert.equal(await pageA.getByText('For the replacement technician').count(),0)
    assert.equal(await pageA.getByRole('link',{name:'Request history and comments'}).count(),0)
    await call(a,'/assignments/'+third.id,'GET',undefined,404)
    await call(a,'/assignments/'+second.id+'/start','PATCH',{},404)
    assert.equal((await notices(a,'internal_update')).length,0)
    assert.equal((await notices(b,'assigned'))[0].assignment_id,third.id)
    assert.deepEqual((await jobs(b)).map(j=>j.id),[third.id])
    assert.equal((await call(b,path+'/comments')).at(-1).body,'For the replacement technician')
    await call(student,path+'/comments','POST',{body:'Access to the room is available.'},201)
    assert.equal((await notices(b,'public_comment')).length,1)
    assert.equal((await notices(bCoordinator,'public_comment')).length,2)
    await call(coord,path+'/reopen','PATCH',{note:'Cancel this assignment'})
    assert.equal((await call(b,'/assignments/'+third.id)).end_reason,'cancelled')
    assert.equal((await summary(b)).completed,0)
    await noOperationalAccess(b)
    const rejected = await submit('Duplicate fixture')
    const rejectionPath = '/maintenance-requests/'+rejected.id
    await call(coord,rejectionPath+'/reject','PATCH',{note:'Duplicate'})
    assert.equal((await call(student,rejectionPath)).status,'rejected')
    for (const user of [a,b]) await denied(user,rejectionPath)
    console.log('Passed two-technician API and browser visibility through approval, assignment, completion, closure, reopening, reassignment, cancellation and rejection.')
  } finally {
    await browser?.close()
    await new Promise(resolve=>app.httpServer.close(resolve))
  }
})
