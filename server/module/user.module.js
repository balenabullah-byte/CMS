import {period} from './report-filters.js';
import TableModule from './base.module.js';
import knex from '../connection.js';
class UserModule extends TableModule {
  constructor() { super('users', ['id','campus_id','full_name','email','member_type','is_active','created_at','updated_at']); }
  async reportingTechnicians(page) {
    return knex('users').whereIn('id',knex('work_assignments').select('technician_id'))
      .orWhereIn('id',knex('user_roles as ur').join('roles as r','r.id','ur.role_id').where('r.code','technician').select('ur.user_id'))
      .select('id','full_name').orderBy(['full_name','id']).limit(page.limit).offset(page.offset);
  }
  async technicians(page) {
    return knex('users').join('user_roles', 'users.id', 'user_roles.user_id')
      .join('roles', 'roles.id', 'user_roles.role_id').where({ 'roles.code': 'technician', is_active: true })
      .select('users.id', 'users.full_name').orderBy(['users.full_name','users.id']).limit(page.limit).offset(page.offset);
  }
  directoryBase(f, db=knex) {
    const q=db('users as u');
    if(f.member_type) q.where('u.member_type',f.member_type);
    if(f.active!==undefined) q.where('u.is_active',f.active);
    if(f.search) q.where(function(){const term='%'+f.search+'%';this.where('u.full_name','like',term).orWhere('u.email','like',term).orWhere('u.campus_id','like',term)});
    if(f.role) q.whereIn('u.id',db('user_roles as ur').join('roles as ro','ro.id','ur.role_id').where('ro.code',f.role).select('ur.user_id'));
    return q;
  }
  async directory(f) {
    const q=period(this.directoryBase(f),'u.created_at',f);
    const [rows,count]=await Promise.all([q.clone().select(this.columns).orderBy('u.full_name').orderBy('u.id').limit(f.limit).offset(f.offset),q.clone().count({n:'*'}).first()]);
    return {rows:await this.withRoles(rows),total:Number(count.n),offset:f.offset,limit:f.limit};
  }
  async getAll(page, db = knex) {
    const users = await super.getAll(page, db);
    return this.withRoles(users,db);
  }
  async withRoles(users,db=knex) {
    const memberships = await db('user_roles').join('roles', 'roles.id', 'user_roles.role_id')
      .whereIn('user_id', users.map(user => user.id)).select('user_id', 'code');
    return users.map(user => ({ ...user, roles: memberships.filter(r => r.user_id === user.id).map(r => r.code) }));
  }
  async credentials(where, db = knex) { return db(this.table).where(where).first(); }
}
export default new UserModule();
