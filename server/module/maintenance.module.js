import { period } from './report-filters.js';
import TableModule from './base.module.js';
import knex from '../connection.js';
class MaintenanceModule extends TableModule {
  constructor() { super('maintenance_requests'); }
  async lock(id, db) { return db(this.table).where({ id }).forUpdate().first(); }
  async accessible(user, page, id, transaction) {
    const query = (transaction || knex)(this.table);
    if (transaction) query.forUpdate();
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
    for (const key of ['building_id','room_id','category_id','priority']) if(page[key]) query.where(key,page[key]);
    period(query,'created_at',page);
    const countQuery = page.totals ? query.clone().clearSelect().count({total:'*'}).first() : null;
    if (page.sort) query.orderBy(page.sort,page.direction || 'desc');
    else if (page.status === 'closed') query.orderBy('closed_at', 'desc');
    const rows = query.orderBy('id','desc').limit(page.limit).offset(page.offset);
    if (!countQuery) return rows;
    const [records, count] = await Promise.all([rows,countQuery]);
    return {rows:records,total:Number(count.total),limit:page.limit,offset:page.offset};
  }
  async statistics(reporter) {
    const query = knex(this.table);
    if (reporter !== undefined) query.where({ reporter_id: reporter });
    return query.select('status').count({ count: '*' }).groupBy('status'); }
}
export default new MaintenanceModule();
