import model from '../module/user.module.js';
import membership from '../module/user-role.module.js';
import { found } from './common.js';
import { hashPassword } from '../security/password.js';

import knex from '../connection.js';
import { fail } from '../middleware/error.middleware.js';

async function protectAdministrator(id, roleId, db) {
  const active = await membership.activeAdministrators(db);
  if ((roleId == null || roleId === active.roleId) && active.users.length === 1 && active.users[0] === id)
    fail(409, 'Keep at least one active administrator.');
}

async function secure(body) {
  if (body.password) {
    body.password_hash = await hashPassword(body.password);
    delete body.password;
  }
}

class UserController {
  async list(req, res, next) {
    try {
      const { query } = req.input;
      res.status(200).json({ data: await model.getAll(query) });
    } catch (error) {
      next(error);
    }
  }

  async directory(req,res,next) {
    try {res.json({data:await model.directory(req.input.query)});} catch(error){next(error)}
  }
  async reportingTechnicians(req,res,next) {
    try {res.json({data:await model.reportingTechnicians(req.input.query)});} catch(error){next(error)}
  }
  async technicians(req, res, next) {
    try { res.json({ data: await model.technicians(req.input.query) }); }
    catch (error) { next(error); }
  }

  async detail(req, res, next) {
    try {
      const { params } = req.input;
      res.status(200).json({ data: found(await model.getById(params.id)) });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { body } = req.input;
      await secure(body);
      res.status(201).json({ data: await model.create(body) });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { body, params } = req.input;
      await secure(body);
      res.status(200).json({ data: await knex.transaction(async db => {
        if (body.is_active === false) await protectAdministrator(params.id, null, db);
        return found(await model.update(params.id, body, db));
      }) });
    } catch (error) {
      next(error);
    }
  }

  async roles(req, res, next) {
    try {
      const { params } = req.input;
      found(await model.getById(params.id));
      res.status(200).json({ data: await membership.codes(params.id) });
    } catch (error) {
      next(error);
    }
  }

  async grant(req, res, next) {
    try {
      const { body, params } = req.input;
      await membership.grant(params.id, body.role_id);
      res.status(201).json({ data: { granted: true } });
    } catch (error) {
      next(error);
    }
  }

  async revoke(req, res, next) {
    try {
      const { params } = req.input;
      await knex.transaction(async db => {
        await protectAdministrator(params.id, params.role_id, db);
        found(await membership.revoke(params.id, params.role_id, db));
      });
      res.status(200).json({ data: { revoked: true } });
    } catch (error) {
      next(error);
    }
  }
}
export default new UserController();
