import { writeFile } from 'node:fs/promises';
import { withTestApi } from './test-api.mjs';

const results = [];
await withTestApi(async (base, password) => {
  const sessions = {};
  async function check(method, path, expected, role, body, verify, label) {
    const name = method + ' ' + path + ' (' + [role || 'public', label].filter(Boolean).join(', ') + ')';
    const headers = {};
    if (role && sessions[role]) headers.Cookie = sessions[role];
    if (role === 'other' && path.startsWith('/assignments/')) headers['X-Campus-Role']='technician';
    if (body) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(base + path, { method, headers, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    } catch {
      results.push({ name, status: 0, expected, pass: false, detail: 'No HTTP response' });
      return;
    }
    const json = (await response.json().catch(() => null)) ?? {};
    const validBody = expected >= 400 ? typeof json.error === 'string' : json.data != null;
    let detail;
    if (!validBody) detail = 'Unexpected response body';
    else if (response.status === expected && verify && !verify(json.data, json.error)) detail = 'Response data failed the scenario check';
    const pass = response.status === expected && !detail;
    results.push({ name, status: response.status, expected, pass, ...(detail && { detail }) });
    if (process.argv.includes('--verbose')) console.error(pass ? 'PASS' : 'FAIL', response.status, name);
    if (path === '/auth/login' && response.ok) {
      const cookie = response.headers.getSetCookie().findLast(c => c.startsWith('campus_session=') && !c.startsWith('campus_session=;'));
      sessions[role] = cookie?.split(';')[0];
    }
    return json.data;
  }
  const admin = 'admin', member = 'campus_member', coord = 'coordinator', tech = 'technician';
  const login = role => check('POST', '/auth/login', 200, role, { email: role + '@example.test', password });
  await check('GET', '/health', 200);
  await check('POST', '/auth/login', 400, null, {});
  await check('POST', '/auth/login', 401, null, { email: 'absent@example.test', password });
  await login(admin);
  await check('GET', '/me', 200, admin, undefined, u => u.roles.includes(admin) && !('password_hash' in u));
  const roles = await check('GET', '/roles', 200, admin);
  const self = await check('GET','/me',200,admin);
  const adminRole = roles.find(r => r.code === 'admin');
  await check('PATCH','/users/' + self.id,409,admin,{ is_active:false });
  await check('DELETE','/users/' + self.id + '/roles/' + adminRole.id,409,admin);
  await check('POST','/auth/register',404,null,{});
  await check('POST','/auth/login',401,null,{ email:'admin@example.test',password:'incorrect-password' });
  const ids = {};
  for (const role of [member, coord, tech, 'other']) {
    const user = await check('POST', '/users', 201, admin, { email: role + '@example.test', full_name: role, member_type: 'staff', password }, u => !('password_hash' in u));
    ids[role] = user?.id;
    const roleId = roles?.find(r => r.code === (role === 'other' ? member : role))?.id;
    await check('POST', '/users/' + user?.id + '/roles', 201, admin, { role_id: roleId });
    await login(role);
  }
  const uid = '/users/' + ids.other;
  const rid = roles?.find(r => r.code === member)?.id;
  await check('GET', '/users', 200, admin);
  await check('GET', '/users', 403, member);
  await check('POST','/users',403,member,{});
  await check('POST',uid + '/roles',403,coord,{role_id:adminRole.id});
  await check('GET','/technicians',200,coord,undefined,rows => rows.length === 1 && rows[0].id === ids[tech] && Object.keys(rows[0]).length === 2);
  await check('GET','/technicians',403,member);
  await check('GET', uid, 200, admin);
  await check('PATCH', uid, 200, admin, { full_name: 'Other member' });
  await check('GET', uid + '/roles', 200, admin);
  await check('GET', '/roles/' + rid, 200, admin);
  await check('PATCH', '/roles/' + rid, 200, admin, { description: 'Report issues' });
  const building = { name: 'Library', code: 'LIB' };
  const b = (await check('POST', '/buildings', 201, admin, building))?.id;
  await check('POST', '/buildings', 409, admin, building);
  await check('POST', '/buildings', 400, admin, { code: 'LAB' });
  await check('PATCH', '/buildings/' + b, 400, admin, {}, (_, error) => error.includes('at least 1 key'));
  await check('GET', '/buildings/99999', 404, member);
  const room = (await check('POST', '/rooms', 201, admin, { building_id: b, room_code: '101' }))?.id;
  const category = (await check('POST', '/maintenance-categories', 201, admin, { code: 'test', name: 'Test' }))?.id;
  for (const [path, id, changes] of [['buildings', b, { name: 'Library Annex' }], ['rooms', room, { floor_number: 1 }], ['maintenance-categories', category, { name: 'Lighting' }]]) {
    await check('GET', '/' + path, 200, member);
    await check('PATCH', '/' + path + '/' + id, 200, admin, changes);
    await check('GET', '/' + path + '/' + id, 200, member, undefined, row => Object.entries(changes).every(([k,v]) => row[k] === v));
  }
  await check('POST', '/technician-skills', 201, admin, { technician_id: ids[tech], category_id: category });
  await check('GET', '/technician-skills', 200, coord);
  await check('DELETE', '/technician-skills/' + ids[tech] + '/' + category, 200, admin);
  const root = '/maintenance-requests';
  const report = { building_id: b, room_id: room, category_id: category, title: 'Light flickers', description: 'Inspect fixture' };
  const policy = {response_target_minutes:60,resolution_target_minutes:300,response_warning_minutes:10,resolution_warning_minutes:30,is_active:true};
  await check('GET','/priority-policies',200,admin,undefined,rows=>rows.length===0);
  await check('PUT','/priority-policies/normal',403,coord,policy);
  await check('PUT','/priority-policies/normal',400,admin,{...policy,response_warning_minutes:61});
  await check('PUT','/priority-policies/normal',200,admin,policy);
  const request = root + '/' + (await check('POST', root, 201, member, report))?.id;
  const rejected = root + '/' + (await check('POST', root, 201, member, report))?.id;
  const requestId=Number(request.split('/').at(-1));
  const {default:database}=await import('../connection.js');
  const {default:worker}=await import('../module/deadline.module.js');
  const assert3=(await import('node:assert/strict')).default;
  const snapshot=()=>database('request_deadlines').where({request_id:requestId}).first();
  assert3.equal((await snapshot()).response_target_minutes,60);
  await check('PUT','/priority-policies/normal',200,admin,{...policy,response_target_minutes:90});
  assert3.equal((await snapshot()).response_target_minutes,60);
  await check('GET','/notifications',200,coord,undefined,p=>p.rows.filter(r=>r.event_type==='submitted').length===2);
  await check('GET','/notifications?user_id='+ids[coord],400,member);
  await check('GET','/audit-logs',403,member);
  await check('GET','/audit-logs?action=technician_skill_added',200,admin,undefined,p=>p.total===1);
  await check('GET',request+'/recommendations',200,coord,undefined,p=>p.length===1 && p[0].matching===0 && p[0].workload===0);
  await check('GET',request+'/recommendations',403,tech);
  await check('GET','/deadlines',200,'other',undefined,p=>p.total===0);
  // Change only the isolated deadline fixture. Request status still advances exclusively via HTTP.
  await database('request_deadlines').where({request_id:requestId}).update({
    response_due_at:database.raw('NOW() + INTERVAL 5 MINUTE'),response_next_alert:database.fn.now(),
    resolution_due_at:database.raw('NOW() - INTERVAL 1 MINUTE'),resolution_next_alert:database.fn.now()});
  await Promise.all([worker.process(),worker.process()]);
  await worker.process();
  for(const event of ['response_approaching','resolution_missed'])
    await check('GET','/notifications?event_type='+event,200,coord,undefined,p=>p.total===1);
  const note = { note: 'Coordinator inspection' };
  const target = { technician_id: ids[tech] };
  await check('GET', root, 200, coord);
  await check('GET', request, 404, 'other');
  await check('GET', root + '/summary',200,'other',undefined,rows => rows.length === 0);
  await check('GET', root + '?search=flickers',200,member,undefined,rows => rows.length === 2);
  await check('GET', root + '?search=Library',200,member,undefined,rows => rows.length === 2);
  await check('PATCH', request + '/close', 403, tech, note);
  await check('PATCH', rejected + '/reject', 200, coord, note);
  const history = path => check('GET', path + '/history', 200, coord);
  const original = await history(rejected);
  await check('PATCH', rejected + '/reopen', 409, coord, note, (_, error) => error.includes('rejected') && error.includes('completed'), 'rejected is terminal');
  await check('GET', rejected, 200, member, undefined, row => row.status === 'rejected');
  await check('GET', rejected + '/history', 200, coord, undefined, rows => rows.length === 2 && JSON.stringify(rows) === JSON.stringify(original));
  await check('PATCH', request + '/close', 409, coord, note);
  await check('PATCH', request + '/approve', 200, coord);
  await check('PATCH', request + '/priority', 200, coord, { priority: 'high' });
  await check('POST', request + '/comments', 201, member, { body: 'Still flickering' });
  for (const body of ['', '  ', 'x'.repeat(12001), 123])
    await check('POST', request + '/comments', 400, member, { body });
  await check('POST', request + '/comments', 401, null, {body:'No session'});
  await check('POST', request + '/comments', 404, 'other', {body:'Restricted report'});
  await check('POST', request + '/comments', 400, member, {body:'Spoofed author',author_id:ids[coord]});
  await check('GET', request + '/comments', 200, coord, undefined,
    rows => rows.length === 1 && rows[0].author_id === ids[member] && rows[0].body === 'Still flickering');
  for (const role of [member,tech]) {
    await check('POST', request + '/assignments', 403, role, target);
    await check('POST', request + '/reassign', 403, role, {...target,...note});
  }
  await check('POST', rejected + '/comments', 409, member, {body:'Rejected report'});
  await check('POST', request + '/comments', 403, member, { body: 'Private', visibility: 'staff_only' });
  const assign = () => check('POST', request + '/assignments', 201, coord, target);
  let job = (await assign())?.id;
  await check('POST', request + '/assignments', 409, coord, target);
  await check('PATCH', '/assignments/' + job + '/complete', 409, tech, { root_cause:'unknown', completion_note: 'Too early' });
  await check('POST', request + '/reassign', 409, coord, { technician_id: ids.other, ...note });
  await check('GET', '/assignments', 200, coord, undefined, rows => rows.length === 1 && rows[0].id === job && !rows[0].ended_at);
  const replacement = await check('POST', request + '/reassign', 201, coord, { ...target, ...note });
  await check('PATCH', '/assignments/' + job + '/start', 404, tech);
  job = replacement?.id;
  await check('GET', '/assignments/' + job, 200, tech, undefined, row => row.technician_id === ids[tech]);
  await check('GET', '/assignments/' + job, 403, member);
  await check('POST', uid + '/roles', 201, admin, {role_id:roles.find(r => r.code === tech).id});
  await check('GET', '/assignments/' + job, 404, 'other');
  await check('PATCH', '/assignments/' + job + '/start', 404, 'other');
  await check('DELETE', uid + '/roles/' + roles.find(r => r.code === tech).id, 200, admin);
  const start = () => check('PATCH', '/assignments/' + job + '/start', 200, tech);
  const complete = () => check('PATCH', '/assignments/' + job + '/complete', 200, tech, { root_cause:'electrical_failure', labor_minutes:75, materials_used:'Lamp', completion_note: 'Replaced lamp' });
  const reopen = () => check('PATCH', request + '/reopen', 200, coord, note, row => row.status === 'reopened' && row.closed_at === null);
  // Exercise each permitted source state through the normal HTTP routes.
  await reopen(); // assigned
  job = (await assign())?.id;
  await start();
  await reopen(); // in progress
  job = (await assign())?.id;
  await start();
  await check('PATCH', '/assignments/' + job + '/progress', 200, tech, { body: 'Work started' });
  await check('GET', request + '/comments', 200, member, undefined, rows => rows.length === 1 && rows[0].visibility === 'reporter_visible');
  for(const extra of [{},{root_cause:'nonsense'},{root_cause:'other'},{root_cause:'unknown',labor_minutes:-1},{root_cause:'unknown',ended_at:'2020-01-01'}])
    await check('PATCH','/assignments/'+job+'/complete',400,tech,{completion_note:'Repair',...extra});
  const earlier = job;
  await check('PATCH','/assignments/'+job+'/complete',200,tech,{root_cause:'unknown',completion_note:'Initial repair'});
  await reopen(); // completed
  job = (await assign())?.id;
  await start();
  await complete();
  await check('PATCH', request + '/close', 200, coord, note);
  await check('POST', request + '/comments', 409, member, {body:'Closed report'});
  await check('GET', request, 200, member, undefined, row => row.status === 'closed' && row.status_note === note.note);
  const { default: db } = await import('../connection.js');
  const summaryMetric = (result,label) => Number(result.metrics.find(m=>m.label===label)?.value);
  const params = '?building_id='+b+'&scope=ended&technician_id='+ids[tech]+'&cause=electrical_failure&date_field=completed&from=2000-01-01&to=2099-12-31&labor_min=75&labor_max=75&sort=completed&direction=desc';
  await check('GET','/work-records'+params,200,coord,undefined,p=>p.total===1 && p.rows[0].id===job && p.rows[0].materials_used==='Lamp');
  await check('GET','/work-records?scope=ended&limit=1&offset=1',200,coord,undefined,p=>p.total===5 && p.rows.length===1 && p.rows[0].id!==job);
  await check('GET','/work-records?sort=password_hash',400,coord);
  await check('GET','/work-records?from=2026-02-30',400,coord);
  await check('GET','/work-records?from=2026-03-02&to=2026-03-01',400,coord);
  await check('GET','/work-records?scope=ended',403,member);
  await check('GET','/work-records/export'+params,200,coord,undefined,p=>p.csv.includes('electrical_failure') && !p.csv.includes('completion_note'));
  await check('GET','/work-records/export',403,admin);
  await check('GET','/work-records/export',403,tech);
  await check('GET','/work-records/export?from=1900-01-01&to=1900-01-01',404,coord);
  await check('GET','/assignments/'+earlier,200,coord,undefined,r=>r.decision==='reopened' && r.labor_minutes===null);
  await check('GET','/assignments/'+job,200,coord,undefined,r=>r.decision==='closed' && r.labor_minutes===75);
  await check('PATCH','/assignments/'+job+'/complete',404,tech,{root_cause:'unknown',completion_note:'Duplicate'});
  await check('GET','/analytics/causes',200,coord,undefined,r=>summaryMetric(r,'Completed assignments')===2 && summaryMetric(r,'Explicitly unknown')===1);
  await check('GET','/analytics/workload',200,coord,undefined,r=>r.table.length===1 && r.table[0].completed===2 && Number(r.table[0].labor_minutes)===75);
  await check('GET','/analytics/operations',200,coord,undefined,r=>summaryMetric(r,'Reported')===2 && summaryMetric(r,'First verified closures')===1 && summaryMetric(r,'Current open backlog')===0);
  await check('GET','/analytics/trends',200,admin,undefined,r=>summaryMetric(r,'Recorded labor')===75 && r.metrics.find(m=>m.label==='Elapsed repair time').samples===2);
  await check('GET','/analytics/infrastructure',200,admin,undefined,r=>r.table[0]?.reports===2);
  await check('GET','/analytics/accounts',200,admin,undefined,r=>summaryMetric(r,'Accounts')===5);
  await check('GET','/user-directory?member_type=staff&role=admin&search=admin&limit=1',200,admin,undefined,q=>q.total===1 && !('password_hash' in q.rows[0]));
  await check('POST',uid+'/roles',201,admin,{role_id:roles.find(r=>r.code===tech).id});
  await check('GET','/analytics/accounts',200,admin,undefined,r=>summaryMetric(r,'Accounts')===5 && r.series[1].rows.reduce((n,x)=>n+Number(x.value),0)===6);
  await check('DELETE',uid+'/roles/'+roles.find(r=>r.code===tech).id,200,admin);
  await check('GET','/analytics/accounts/export',200,admin,undefined,r=>!r.csv.includes('password_hash') && r.csv.includes('Summary'));
  await check('GET','/analytics/operations',403,admin);
  await check('GET','/analytics/trends',403,member);
  await check('GET','/analytics/causes/export',403,tech);
  await check('GET','/analytics/operations?to=1900-01-01',200,coord,undefined,r=>summaryMetric(r,'Reported')===0 && r.metrics.find(m=>m.label==='Response time').value===null);
  const assert = (await import('node:assert/strict')).default;
  await assert.rejects(db('work_assignments').where({id:job}).update({labor_minutes:1}),{errno:1644});
  await assert.rejects(db('request_history').where({request_id:Number(request.split('/').at(-1))}).update({note:'Mutation test'}),{errno:1644});
  const finalSnapshot=await snapshot();
  assert3.ok(finalSnapshot.response_met_at && finalSnapshot.resolution_met_at);
  await check('GET','/deadlines?condition=missed&kind=resolution',200,coord,undefined,p=>p.rows.some(r=>r.request_id===requestId));
  await check('GET','/notifications',200,member,undefined,p=>['approved','assigned','in_progress','closed'].every(e=>p.rows.some(n=>n.event_type===e)) && !p.rows.some(n=>n.event_type==='internal_update'));
  await check('GET','/notifications?event_type=completed',200,coord,undefined,p=>p.total===2);
  await check('PATCH','/notifications/read',200,member,{},r=>r.unread===0);
  await check('GET','/notifications/count',200,coord,undefined,n=>n>0);
  await assert3.rejects(db('audit_logs').where({actor_id:self.id}).update({action:'change'}),{errno:1644});
  await assert3.rejects(db('audit_logs').where({actor_id:self.id}).del(),{errno:1644});
  const auditRows=await db('audit_logs').select('old_values','new_values');
  assert3.ok(!JSON.stringify(auditRows).includes(password) && !JSON.stringify(auditRows).includes('password_hash'));
  const stored = await db('maintenance_requests').where({id: Number(request.split('/').at(-1))}).first();
  const assignment = await db('work_assignments').where({id: job}).first();
  const publicComments = await db('request_comments').where({request_id:stored.id,visibility:'reporter_visible'});
  assert.equal(publicComments.length,1);
  assert.equal(publicComments[0].author_id,ids[member]);
  assert.equal(publicComments[0].body,'Still flickering');
  assert.ok(publicComments[0].created_at);
  await db('request_attachments').insert({request_id:stored.id,uploaded_by_id:ids[tech],storage_key:'fixture-internal',original_filename:'Evidence.png',mime_type:'image/png',file_size_bytes:100});
  await check('GET',request+'/attachments',200,coord,undefined,rows=>rows.length===1 && !('storage_key' in rows[0]));
  await check('GET',request+'/attachments',200,member,undefined,rows=>rows.length===0);
  await check('GET',request+'/attachments',404,'other');
  if (stored.status !== 'closed' || stored.closed_by_id !== ids[coord] || assignment.end_reason !== 'completed' || assignment.technician_id !== ids[tech])
    throw Error('Unexpected persisted closure or assignment');
  await check('GET', request + '/history', 200, member, undefined, rows => rows.every(r => !('note' in r) && !('actor_id' in r)));
  await reopen(); // closed
  await check('GET', '/assignments', 200, tech, undefined, rows =>
    rows.every(row => row.ended_at) && rows.map(row => row.end_reason).join(',') === 'completed,completed,cancelled,cancelled,reassigned');
  await check('GET', request + '/history', 200, coord, undefined, rows =>
    rows.filter(row => row.event_type === 'assignment_created').length === 5 &&
    rows.filter(row => row.event_type === 'assignment_ended').length === 5 &&
    rows.at(-1)?.new_status === 'reopened');
  const concurrent = await Promise.all([assignConcurrent(), assignConcurrent()]);
  const ordered = concurrent.sort((a, b) => a.status - b.status);
  for (const [i, response] of ordered.entries()) {
    const expected = [201, 409][i];
    const json = (await response.json().catch(() => null)) ?? {};
    const validBody = expected === 201 ? json.data?.request_id === Number(request.split('/').at(-1)) : typeof json.error === 'string';
    results.push({ name: 'POST ' + request + '/assignments (concurrent coordinator ' + (i + 1) + ')',
      status: response.status, expected, pass: response.status === expected && validBody });
  }
  function assignConcurrent() {
    return fetch(base + request + '/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sessions[coord] }, body: JSON.stringify(target) });
  }
  await check('GET', '/assignments', 200, coord, undefined, rows => rows.filter(row => !row.ended_at).length === 1);
  await check('GET', '/statistics', 200, admin);
  await check('DELETE', uid + '/roles/' + rid, 200, admin);
  await check('GET', root, 403, 'other');
  await check('PATCH', uid, 200, admin, { is_active: false });
  await check('GET', '/me', 401, 'other');
  await check('POST','/auth/login',401,null,{email:'other@example.test',password});
  await check('PATCH', uid, 200, admin, { is_active: true, password: password + 'new' });
  await check('GET', '/me', 401, 'other');
  await check('POST', '/auth/logout', 200, admin);
  await check('GET', '/me', 401, admin, undefined, undefined, 'revoked cookie');
  await check('GET', '/me', 401);
});
const json = JSON.stringify(results, null, 2);
if (process.env.TEST_REPORT_FILE) await writeFile(process.env.TEST_REPORT_FILE, json);
console.log(json);
if (results.some(result => !result.pass)) process.exitCode = 1;
