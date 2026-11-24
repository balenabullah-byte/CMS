import TableModule from './base.module.js';
import knex from '../connection.js';
class UserModule extends TableModule {
  constructor() { super('users', ['id','campus_id','full_name','email','member_type','is_active','created_at','updated_at']); }
  async technicians(page) {
    return knex('users').join('user_roles', 'users.id', 'user_roles.user_id')
      .join('roles', 'roles.id', 'user_roles.role_id').where({ 'roles.code': 'technician', is_active: true })
      .select('users.id', 'users.full_name').orderBy(['users.full_name','users.id']).limit(page.limit).offset(page.offset);
  }
  async getAll(page, db = knex) {
    const users = await super.getAll(page, db);
    const memberships = await db('user_roles').join('roles', 'roles.id', 'user_roles.role_id')
      .whereIn('user_id', users.map(user => user.id)).select('user_id', 'code');
    return users.map(user => ({ ...user, roles: memberships.filter(r => r.user_id === user.id).map(r => r.code) }));
  }
  async credentials(where, db = knex) { return db(this.table).where(where).first(); }
}
export default new UserModule();
