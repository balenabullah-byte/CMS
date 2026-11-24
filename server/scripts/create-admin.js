import knex from '../connection.js';
import roles from '../module/role.module.js';
import users from '../module/user.module.js';
import membership from '../module/user-role.module.js';
import { hashPassword } from '../security/password.js';
import schema from '../validation/user.validation.js';

try {
  if (!process.env.DB_USER) throw new Error('Missing DB_USER');
  const data = await schema.create.body.validateAsync({ email: process.env.ADMIN_EMAIL,
    full_name: process.env.ADMIN_NAME, member_type: 'staff', password: process.env.ADMIN_PASSWORD });
  data.password_hash = await hashPassword(data.password);
  delete data.password;
  await knex.transaction(async db => {
    const role = await roles.getByCode('admin', db);
    const user = await users.create(data, db);
    await membership.grant(user.id, role.id, db);
  });
  console.log('Administrator created.');
} catch (error) {
  console.error(error.errno === 1062 ? 'Account already exists.' : 'Creation failed. Check account details and database configuration.');
  process.exitCode = 1;
} finally { await knex.destroy(); }
