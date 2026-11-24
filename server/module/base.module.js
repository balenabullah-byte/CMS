import knex from '../connection.js';
export default class TableModule {
  constructor(table, columns = ['*']) { this.table = table; this.columns = columns; }
  async getAll(page, db = knex) {
    return db(this.table).select(this.columns).orderBy('id').limit(page.limit).offset(page.offset);
  }
  async getById(id, db = knex) { return db(this.table).select(this.columns).where({ id }).first(); }
  async create(data, db = knex) { const [id] = await db(this.table).insert(data); return this.getById(id, db); }
  async update(id, data, db = knex) { await db(this.table).where({ id }).update(data); return this.getById(id, db); }
}
