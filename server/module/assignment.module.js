import TableModule from './base.module.js';
import knex from '../connection.js';
class AssignmentModule extends TableModule {
  constructor() { super('work_assignments'); }
  async isAssigned(request_id, technician_id) { return knex(this.table).where({ request_id, technician_id }).whereNull('ended_at').first('id'); }
  async active(request_id, db) { return db(this.table).where({ request_id }).whereNull('ended_at').forUpdate().first(); }
  async jobs(user, page) {
    const query = knex('work_assignments as a')
      .join('maintenance_requests as r', 'r.id', 'a.request_id')
      .join('users as u', 'u.id', 'a.technician_id')
      .select('a.*','r.title','r.building_id','r.room_id','r.priority','u.full_name as technician_name');
    if (!user.roles.includes('coordinator')) query.where('technician_id', user.id);
    if (page.id) return query.where('a.id', page.id).first();
    if (page.request_id) query.where('a.request_id', page.request_id);
    return query.orderBy('a.id','desc').limit(page.limit).offset(page.offset);
  }
}
export default new AssignmentModule();
