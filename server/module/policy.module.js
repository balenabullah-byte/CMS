import knex from '../connection.js';
import audit from './audit.module.js';
class PolicyModule {
  list(){return knex('maintenance_priority_policies').orderBy('priority');}
  async save(priority,fields,actor){
    return knex.transaction(async db=>{
      const q=db('maintenance_priority_policies').where({priority});
      const before=await q.clone().forUpdate().first();
      await db('maintenance_priority_policies').insert({...fields,priority,updated_by_id:actor}).onConflict('priority').merge();
      const after=await q.first();
      const change=!before?'created':Boolean(before.is_active)!==Boolean(after.is_active)?(after.is_active?'activated':'deactivated'):'updated';
      await audit.record(db,actor,'priority_policy_'+change,'priority_policy',priority,before,after);
      return after;
    });
  }
}
export default new PolicyModule();
