import TableModule from './base.module.js';
import knex from '../connection.js';
import notifications from './notification.module.js';
class CommentModule extends TableModule {
  constructor() { super('request_comments'); }
  async create(fields,db) {
    if (!db) return knex.transaction(trx=>this.create(fields,trx));
    const comment=await super.create(fields,db);
    await notifications.comment(db,comment);
    return comment;
  }
  async list(request_id, page, staff, db=knex) {
    const query = db(this.table).where({ request_id });
    if (!staff) query.where('visibility', 'reporter_visible');
    return query.orderBy('id').limit(page.limit).offset(page.offset);
  }
}
export default new CommentModule();
