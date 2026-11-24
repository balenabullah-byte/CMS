import TableModule from './base.module.js';
import knex from '../connection.js';
class CommentModule extends TableModule {
  constructor() { super('request_comments'); }
  async list(request_id, page, staff) {
    const query = knex(this.table).where({ request_id });
    if (!staff) query.where('visibility', 'reporter_visible');
    return query.orderBy('id').limit(page.limit).offset(page.offset);
  }
}
export default new CommentModule();
