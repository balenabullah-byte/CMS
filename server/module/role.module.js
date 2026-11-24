import TableModule from './base.module.js';

class RoleModule extends TableModule {
  async getByCode(code, db) { return db(this.table).where({ code }).first('id'); }
  constructor() { super('roles'); }
  
}
export default new RoleModule();
