import { writeFile } from 'node:fs/promises';
import { withTestApi } from './test-api.mjs';

const results = [];
await withTestApi(async (base, password) => {
  const sessions = {};
  async function check(method, path, expected, role, body, verify, label) {
    const name = method + ' ' + path + ' (' + [role || 'public', label].filter(Boolean).join(', ') + ')';
    const headers = {};
    if (role && sessions[role]) headers.Cookie = sessions[role];
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
  const request = root + '/' + (await check('POST', root, 201, member, report))?.id;
  const rejected = root + '/' + (await check('POST', root, 201, member, report))?.id;
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
  await check('POST', request + '/comments', 403, member, { body: 'Private', visibility: 'staff_only' });
  const assign = () => check('POST', request + '/assignments', 201, coord, target);
  let job = (await assign())?.id;
  await check('POST', request + '/assignments', 409, coord, target);
  await check('PATCH', '/assignments/' + job + '/complete', 409, tech, { completion_note: 'Too early' });
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
  const complete = () => check('PATCH', '/assignments/' + job + '/complete', 200, tech, { completion_note: 'Replaced lamp' });
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
  await complete();
  await reopen(); // completed
  job = (await assign())?.id;
  await start();
  await complete();
  await check('PATCH', request + '/close', 200, coord, note);
  await check('GET', request, 200, member, undefined, row => row.status === 'closed' && row.status_note === note.note);
  const { default: db } = await import('../connection.js');
  const stored = await db('maintenance_requests').where({id: Number(request.split('/').at(-1))}).first();
  const assignment = await db('work_assignments').where({id: job}).first();
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
