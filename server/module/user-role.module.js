import knex from '../connection.js';
class UserRoleModule {
  async codes(user_id, db = knex) { return db('user_roles').join('roles','roles.id','user_roles.role_id').where({ user_id }).pluck('roles.code'); }
  async grant(user_id, role_id, db = knex) { await db('user_roles').insert({ user_id, role_id }); }
  async activeAdministrators(db) {
    // Serialize destructive membership changes on the fixed system role.
    const role = await db('roles').where({ code: 'admin' }).forUpdate().first('id');
    const users = await db('user_roles').join('users', 'users.id', 'user_roles.user_id')
      .where({ role_id: role.id, is_active: true }).forUpdate().pluck('users.id');
    return { roleId: role.id, users };
  }
  async revoke(user_id, role_id, db = knex) { return db('user_roles').where({ user_id, role_id }).del(); }
}
export default new UserRoleModule();
