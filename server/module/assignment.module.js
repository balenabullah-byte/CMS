import TableModule from './base.module.js';
import knex from '../connection.js';
import deadlines from './deadline.module.js';
import verification from './verification.module.js';
import { activeWorkStates, period, scopedWork, elapsed } from './report-filters.js';
class AssignmentModule extends TableModule {
  constructor() { super('work_assignments'); }
  async active(request_id, db) { return db(this.table).where({ request_id }).whereNull('ended_at').forUpdate().first(); }
  base(user) {
    const query = knex('work_assignments as a')
      .join('maintenance_requests as r', 'r.id', 'a.request_id')
      .leftJoin('assets as equipment','equipment.id','r.asset_id')
      .join('users as u', 'u.id', 'a.technician_id')
       .join('buildings as b','b.id','r.building_id').leftJoin('rooms as rm','rm.id','r.room_id')
      .join('maintenance_categories as c','c.id','r.category_id');
    if (!user.roles.includes('coordinator')) {
      query.where('a.technician_id',user.id).where(function () {
        this.whereNotNull('a.ended_at').orWhereIn('r.status',activeWorkStates);
      });
    }
    return query;
  }
  rows(query,user) {
    const liveFields = user.roles.includes('coordinator') ? ['r.status','r.priority'] : [
      knex.raw('IF(a.ended_at IS NULL,r.status,NULL) AS status'),
      knex.raw('IF(a.ended_at IS NULL,r.priority,NULL) AS priority')
    ];
    return query.select('a.*','r.title','r.asset_id','equipment.asset_code',...liveFields,'r.building_id','r.room_id','r.category_id',
      'b.name as building','rm.room_code','c.name as category','u.full_name as technician_name',
      knex.raw(elapsed + ' as elapsed_minutes'));
  }
  async search(user, f) {
    const coordinator = user.roles.includes('coordinator');
    const base = this.base(user).leftJoin(deadlines.states().as('d'),function () {
      this.on('d.request_id','=','r.id');
      if (!coordinator) this.onNull('a.ended_at');
    });
    if (!coordinator && (f.status || f.priority)) base.whereNull('a.ended_at');
    const kind=f.deadline_type || 'resolution';
    if (f.deadline_condition==='not_configured') base.whereNull('d.request_id');
    else if(f.deadline_condition) base.where('d.'+kind+'_state',f.deadline_condition);
    if(f.date_field==='closed') verification.join(base);
    const query = scopedWork(base,f);
    const fields = {deadline:'d.'+kind+'_due_at',priority:'priority',id:'a.id',title:'r.title',assigned:'a.assigned_at',completed:'a.completed_at',ended:'a.ended_at',labor:'a.labor_minutes'};
    const [count, rows] = await Promise.all([query.clone().count({n:'*'}).first(),
      this.rows(query.clone(),user).select('d.response_state','d.resolution_state','d.response_due_at','d.resolution_due_at').orderBy(fields[f.sort || 'id'],f.direction || 'desc').orderBy('a.id','desc').limit(f.limit).offset(f.offset)]);
    return {rows,total:Number(count.n),limit:f.limit,offset:f.offset};
  }
  async summary(technician,f) {
    const scope = () => this.base({id:technician,roles:['technician']});
    const [active,done,verification] = await Promise.all([
      scope().whereNull('a.ended_at').count({n:'*'}).count({started:'a.started_at'}).first(),
      period(scope().where('a.end_reason','completed'),'a.completed_at',f).count({n:'*'}).first(),
      scopedWork(scope(),{scope:'verification'}).count({n:'*'}).first()]);
    return {active:Number(active.n),started:Number(active.started),waiting:Number(active.n)-Number(active.started),
      completed:Number(done.n),verification:Number(verification.n)};
  }
  async jobs(user, page) {
    const query = this.rows(this.base(user),user);
    if (page.id) {
      if (user.roles.includes('coordinator')) query.select('r.description','r.location_note');
      else query.select(knex.raw('IF(a.ended_at IS NULL,r.description,NULL) AS description'),
        knex.raw('IF(a.ended_at IS NULL,r.location_note,NULL) AS location_note'));
      return verification.join(query).select('ev.decision','ev.decision_at','ev.decision_by').where('a.id',page.id).first();
    }
    if (page.request_id) query.where('a.request_id', page.request_id);
    return query.orderBy('a.id','desc').limit(page.limit).offset(page.offset);
  }
}
export default new AssignmentModule();
