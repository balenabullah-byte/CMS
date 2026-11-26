import TableModule from './base.module.js';
import knex from '../connection.js';
import verification from './verification.module.js';
import { period } from './report-filters.js';
import { scopedWork, elapsed } from './report-filters.js';
class AssignmentModule extends TableModule {
  constructor() { super('work_assignments'); }
  async isAssigned(request_id, technician_id, db = knex) { return db(this.table).where({ request_id, technician_id }).whereNull('ended_at').first('id'); }
  async active(request_id, db) { return db(this.table).where({ request_id }).whereNull('ended_at').forUpdate().first(); }
  base() {
    return knex('work_assignments as a')
      .join('maintenance_requests as r', 'r.id', 'a.request_id')
      .join('users as u', 'u.id', 'a.technician_id')
       .join('buildings as b','b.id','r.building_id').leftJoin('rooms as rm','rm.id','r.room_id')
      .join('maintenance_categories as c','c.id','r.category_id');
  }
  rows(query) {
    return query.select('a.*','r.title','r.status','r.building_id','r.room_id','r.priority','r.category_id',
      'b.name as building','rm.room_code','c.name as category','u.full_name as technician_name',
      knex.raw(elapsed + ' as elapsed_minutes'));
  }
  async search(user, f) {
    const base = this.base();
    if(f.date_field==='closed') verification.join(base);
    const query = scopedWork(base,user,f);
    const fields = {id:'a.id',title:'r.title',assigned:'a.assigned_at',completed:'a.completed_at',ended:'a.ended_at',labor:'a.labor_minutes'};
    const [count, rows] = await Promise.all([query.clone().count({n:'*'}).first(),
      this.rows(query.clone()).orderBy(fields[f.sort || 'id'],f.direction || 'desc').orderBy('a.id','desc').limit(f.limit).offset(f.offset)]);
    return {rows,total:Number(count.n),limit:f.limit,offset:f.offset};
  }
  async summary(technician,f) {
    const scope = () => this.base().where('a.technician_id',technician);
    const [active,done,verification] = await Promise.all([
      scope().whereNull('a.ended_at').count({n:'*'}).count({started:'a.started_at'}).first(),
      period(scope().where('a.end_reason','completed'),'a.completed_at',f).count({n:'*'}).first(),
      scopedWork(scope(),{id:technician,roles:['technician']},{scope:'verification'}).count({n:'*'}).first()]);
    return {active:Number(active.n),started:Number(active.started),waiting:Number(active.n)-Number(active.started),
      completed:Number(done.n),verification:Number(verification.n)};
  }
  async jobs(user, page) {
    const query = this.rows(this.base());
    if (!user.roles.includes('coordinator')) query.where('technician_id', user.id);
    if (page.id) return verification.join(query).select('ev.decision','ev.decision_at','ev.decision_by','r.description','r.location_note')
      .where('a.id',page.id).first();
    if (page.request_id) query.where('a.request_id', page.request_id);
    return query.orderBy('a.id','desc').limit(page.limit).offset(page.offset);
  }
}
export default new AssignmentModule();
