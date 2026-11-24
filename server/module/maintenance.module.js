import TableModule from './base.module.js';
import knex from '../connection.js';
class MaintenanceModule extends TableModule {
  constructor() { super('maintenance_requests'); }
  async lock(id, db) { return db(this.table).where({ id }).forUpdate().first(); }
  async accessible(user, page, id) {
    const query = knex(this.table);
    if (!user.roles.includes('coordinator')) {
      query.where(function () {
        this.whereRaw('1 = 0');
        if (user.roles.includes('campus_member')) this.orWhere('reporter_id', user.id);
        if (user.roles.includes('technician')) this.orWhereIn('id', knex('work_assignments').select('request_id').where({ technician_id: user.id }).whereNull('ended_at'));
      });
    }
    if (!user.roles.includes('coordinator')) {
      query.select('id','reporter_id','building_id','room_id','category_id','location_note','title',
        'description','status','priority','created_at','updated_at','closed_at');
      query.select(knex.raw("CASE WHEN status IN ('closed','rejected') THEN status_note END AS status_note"));
    }
    if (id) return query.where({ id }).first();
    if (page.status === 'ready') query.whereIn('status',['approved','reopened']);
    else if (page.status === 'active') query.whereNotIn('status',['closed','rejected']);
    else if (page.status) query.where({ status: page.status });
    if (page.search) {
      const term = '%' + page.search + '%';
      query.where(function () {
        this.where('title', 'like', term)
          .orWhereIn('building_id', knex('buildings').select('id').where('name', 'like', term));
        const reference = /^(?:REQ-)?([0-9]+)$/i.exec(page.search);
        if (reference) this.orWhere('id', reference[1]);
      });
    }
    if (page.status === 'closed') query.orderBy('closed_at', 'desc');
    return query.orderBy('id','desc').limit(page.limit).offset(page.offset);
  }
  async statistics(reporter) {
    const query = knex(this.table);
    if (reporter !== undefined) query.where({ reporter_id: reporter });
    return query.select('status').count({ count: '*' }).groupBy('status'); }
}
export default new MaintenanceModule();
