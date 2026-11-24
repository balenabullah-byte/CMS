import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app } from '../index.js';
import { state } from '../controller/common.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { login, session, logout } from '../security/session.js';
import allow from '../middleware/role.middleware.js';
import schemas from '../validation/maintenance.validation.js';

test('passwords require a valid salted hash', async () => {
  const hash = await hashPassword('a secure test passphrase');
  assert.equal(await verifyPassword('a secure test passphrase', hash), true);
  assert.equal(await verifyPassword('incorrect', hash), false);
  assert.equal(await verifyPassword('demo', 'placeholder'), false);
});

test('sessions survive independent requests and logout revokes the token', async () => {
  const old = process.env.SESSION_DIR;
  const dir = await mkdtemp(join(tmpdir(), 'campus-session-'));
  process.env.SESSION_DIR = dir;
  try {
    let cookie;
    const res = { clearCookie() {}, cookie(name, token) { cookie = name + '=' + token; } };
    await login({ headers: {} }, res, { id: 7, password_hash: 'test' });
    const req = { headers: { cookie } };
    assert.equal((await session(req)).id, 7);
    await logout(req, res);
    assert.equal(await session(req), undefined);
  } finally {
    if (old === undefined) delete process.env.SESSION_DIR;
    else process.env.SESSION_DIR = old;
    await rm(dir, { recursive: true, force: true });
  }
});

test('expired sessions stop authenticating and are removed', async t => {
  const previous = process.env.SESSION_DIR;
  const dir = await mkdtemp(join(tmpdir(), 'campus-expiry-'));
  process.env.SESSION_DIR = dir;
  try {
    let cookie;
    await login({ headers: {} }, { clearCookie() {}, cookie(name, value) { cookie = name + '=' + value; } },
      {id: 21, password_hash: 'fixture'});
    const req = {headers: {cookie}};
    assert.equal((await session(req)).id, 21);
    const later = Date.now() + 9 * 3600000;
    t.mock.method(Date, 'now', () => later);
    assert.equal(await session(req), undefined);
    assert.equal(await session(req), undefined);
  } finally {
    if (previous === undefined) delete process.env.SESSION_DIR;
    else process.env.SESSION_DIR = previous;
    await rm(dir, {recursive:true, force:true});
  }
});

test('reporters cannot set actor or workflow fields', () => {
  const body = { title: 'Light', description: 'Broken', building_id: 1, category_id: 2 };
  assert.equal(schemas.create.body.validate(body).error, undefined);
  for (const key of ['status','closed_by_id','reporter_id','priority']) {
    assert.ok(schemas.create.body.validate({ ...body, [key]: 1 }).error);
  }
});

test('closure requires coordinator permission and completed work', () => {
  assert.throws(() => allow('coordinator')({ user: { roles: ['technician'] } }, {}, () => {}), { apiStatus: 403 });
  assert.throws(() => state({ status: 'assigned' }, ['completed']), { apiStatus: 409 });
});

test('Postman endpoints reach Express without connecting to a database', async () => {
  const collection = JSON.parse(await readFile(new URL('../Campus Postman Collection.json', import.meta.url)));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const folder of collection.item) for (const { request } of folder.item) {
      const path = request.url.replace('{{baseUrl}}', '/api').replace(/\{\{\w+\}\}/g,'1');
      const response = await fetch('http://127.0.0.1:' + server.address().port + path, { method: request.method });
      const expected = path.endsWith('/health') ? 200 : path.endsWith('/auth/login') ? 400 : 401;
      assert.equal(response.status, expected, request.method + ' ' + path);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('repair assignment, start, completion and verification run in trigger order', async t => {
  const { default: knex } = await import('../connection.js');
  const { default: requests } = await import('../module/maintenance.module.js');
  const { default: assignments } = await import('../module/assignment.module.js');
  const { default: work } = await import('../controller/assignment.controller.js');
  const { default: maintenance } = await import('../controller/maintenance.controller.js');
  const transaction = {};
  const row = { id: 1, status: 'submitted' };
  let job;
  t.mock.method(knex, 'transaction', async callback => callback(transaction));
  t.mock.method(requests, 'lock', async (id, db) => {
    assert.equal(db, transaction);
    return row;
  });
  t.mock.method(requests, 'update', async (id, changes, db) => {
    assert.equal(db, transaction);
    if (changes.status === 'assigned') assert.equal(job.technician_id, 7);
    if (changes.status === 'in_progress') assert.ok(job.started_at);
    if (changes.status === 'completed') assert.equal(job.end_reason, 'completed');
    return Object.assign(row, changes);
  });
  t.mock.method(assignments, 'create', async data => (job = { ...data, id: 4 }));
  t.mock.method(assignments, 'getById', async () => job);
  t.mock.method(assignments, 'active', async () => job.ended_at ? undefined : job);
  t.mock.method(assignments, 'update', async (id, changes) => Object.assign(job, changes));
  const res = { status() { return this; }, json() {} };
  function action(method, id, actor, body = {}) {
    return method({ input: { params: { id }, body }, user: { id: actor } }, res, error => { throw error; });
  }
  await action(maintenance.approve, 1, 9);
  await action(work.assign, 1, 9, { technician_id: 7 });
  await assert.rejects(action(work.start, 4, 8), { apiStatus: 404 });
  await action(work.start, 4, 7);
  await action(work.complete, 4, 7, { completion_note: 'Replaced lamp' });
  await action(maintenance.close, 1, 9);
  assert.equal(row.status, 'closed');
  assert.equal(row.closed_by_id, 9);
});

test('invalid JSON and unsupported encodings return client errors', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const [type, status] of [['application/json', 400], ['application/json; charset=latin1', 415]]) {
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth/login',
        { method: 'POST', headers: { 'Content-Type': type }, body: '{' });
      assert.equal(response.status, status);
      assert.equal(typeof (await response.json()).error, 'string');
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
