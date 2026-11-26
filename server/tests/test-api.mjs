import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { hashPassword } from '../security/password.js';

export async function withTestApi(run, { beforeMigration, adminEmail = 'admin@example.test' } = {}) {
  const port = Number(process.env.TEST_DB_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || !process.env.TEST_DB_USER) {
    throw new Error('Set TEST_DB_PORT and TEST_DB_USER for a local MariaDB test instance.');
  }
  const database = 'campus_test_' + randomBytes(12).toString('hex');
  const password = randomBytes(24).toString('hex');
  const options = { host: '127.0.0.1', port, user: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD || '' };
  const connection = await mysql.createConnection(options);
  let created = false, dir, server, pool;
  try {
    await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [database]);
    created = true;
    await connection.changeUser({ database });
    let schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
    if (beforeMigration) schema = schema.replace(/^    (root_cause|root_cause_details|materials_used|labor_minutes) [^\n]+\n/gm,'');
    let delimiter = ';', statement = '';
    for (const line of schema.split(/\r?\n/)) {
      if (line.startsWith('DELIMITER ')) { delimiter = line.slice(10); continue; }
      statement += line + '\n';
      if (line.trimEnd().endsWith(delimiter)) {
        await connection.query(statement.trimEnd().slice(0, -delimiter.length));
        statement = '';
      }
    }
    if (statement.trim()) throw new Error('Unterminated schema statement');
    if (beforeMigration) {
      await beforeMigration(connection);
      const ddl=await readFile(new URL('../migrations/002_1_assignment_completion.sql', import.meta.url),'utf8');
      await connection.query(ddl);
    }
    const [{ insertId }] = await connection.execute(
      'INSERT INTO users (email, full_name, member_type, password_hash) VALUES (?, ?, ?, ?)',
      [adminEmail, 'Test Admin', 'staff', await hashPassword(password)]);
    await connection.execute("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code='admin'", [insertId]);
    dir = await mkdtemp(join(tmpdir(), 'campus-api-'));
    Object.assign(process.env, { DB_HOST: options.host, DB_PORT: String(port), DB_NAME: database,
      DB_PASSWORD: options.password, DB_USER: options.user, SESSION_DIR: dir, NODE_ENV: 'test' });
    const { app } = await import('../index.js');
    pool = (await import('../connection.js')).default;
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    await run('http://127.0.0.1:' + server.address().port + '/api', password);
  } finally {
    try {
      if (server) await new Promise(resolve => server.close(resolve));
      if (pool) await pool.destroy();
      if (dir) await rm(dir, { recursive: true, force: true });
      if (created) await connection.query('DROP DATABASE ??', [database]);
    } finally { await connection.end(); }
  }
}

