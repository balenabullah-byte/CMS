import { activeRequestIds, period } from './report-filters.js';
import TableModule from './base.module.js';
import knex from '../connection.js';
import notifications from './notification.module.js';
import deadlines from './deadline.module.js';
import assets from './asset.module.js';
class MaintenanceModule extends TableModule {
  constructor() { super('maintenance_requests'); }
  async create(fields, db) {
    if (!db) return knex.transaction(trx => this.create(fields,trx));
    if (fields.asset_id) await assets.validateReport(db,fields);
    const request = await super.create(fields,db);
    await deadlines.snapshot(db,request);
    await notifications.workflow(db,request,fields.reporter_id);
    return request;
  }
  async update(id,fields,db=knex) {
    if(fields.status==='reopened') {
      // A reopened request counts as unresolved. Serialize that transition
      // with transfer and retirement using the same registration row lock.
      await db('assets').whereIn('id',db(this.table).where({id}).select('asset_id')).forUpdate().first('id');
    }
    const request = await super.update(id,fields,db);
    if (fields.status) {
      await deadlines.milestone(db,request);
      await notifications.workflow(db,request,fields.status_changed_by_id);
    }
    return request;
  }
  async lock(id, db) { return db(this.table).where({ id }).forUpdate().first(); }
  async accessible(user, page, id, db=knex) {
    const query = db(this.table);
    if (!user.roles.includes('coordinator')) {
      query.where(function () {
        this.whereRaw('1 = 0');
        if (user.roles.includes('campus_member')) this.orWhere('reporter_id', user.id);
        if (user.roles.includes('technician')) this.orWhereIn('id', activeRequestIds(db,user.id));
      });
    }
    if (!user.roles.includes('coordinator')) {
      query.select('id','reporter_id','building_id','room_id','asset_id','category_id','location_note','title',
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
