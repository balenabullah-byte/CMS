import model from '../module/skill.module.js';
import membership from '../module/user-role.module.js';
import { found } from './common.js';
import { fail } from '../middleware/error.middleware.js';

class SkillController {
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
      res.status(201).json({ data: await model.add(body) });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const { params } = req.input;
      found(await model.remove(params));
      res.status(200).json({ data: { removed: true } });
    } catch (error) {
      next(error);
    }
  }
}
export default new SkillController();
