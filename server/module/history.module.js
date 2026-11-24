import TableModule from './base.module.js';
import knex from '../connection.js';
class HistoryModule extends TableModule {
  constructor() { super('request_history'); }
  async list(request_id, page, staff) {
    const query = knex(this.table).where({ request_id });
    if (!staff) query.whereIn('event_type', ['submitted','status_changed'])
      .select('id','request_id','created_at','event_type','old_status','new_status');
    return query.orderBy('id').limit(page.limit).offset(page.offset); }
}
export default new HistoryModule();
