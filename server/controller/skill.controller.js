import knex from '../connection.js';
import audit from '../module/audit.module.js';
import model from '../module/skill.module.js';
import membership from '../module/user-role.module.js';
import { found } from './common.js';
import { fail } from '../middleware/error.middleware.js';

class SkillController {
  async roster(req,res,next){
    try{res.json({data:await model.roster(req.user,req.input.query)})}catch(error){next(error)}
  }
  async list(req, res, next) {
    try {
      const { query } = req.input;
      res.status(200).json({ data: await model.list(query) });
    } catch (error) {
      next(error);
    }
  }

  async add(req, res, next) {
    try {
      const { body } = req.input;
      if (!(await membership.codes(body.technician_id)).includes('technician')) fail(409, 'Technician role required');
      res.status(201).json({ data: await knex.transaction(async db=>{
        const row=await model.add(body,db);
        await audit.record(db,req.user.id,'technician_skill_added','technician_skill',body.technician_id,null,body);
        return row;
      }) });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const { params } = req.input;
      await knex.transaction(async db=>{
        found(await model.remove(params,db));
        await audit.record(db,req.user.id,'technician_skill_removed','technician_skill',params.technician_id,params,null);
      });
      res.status(200).json({ data: { removed: true } });
    } catch (error) {
      next(error);
    }
  }
}
export default new SkillController();
