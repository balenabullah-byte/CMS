import notifications from '../module/notification.module.js';
import audit from '../module/audit.module.js';
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
      res.status(201).json({ data: await knex.transaction(async db => {
        const row = await model.create(body,db);
        await audit.record(db,req.user.id,'user_created','user',row.id,null,row);
        return row;
      }) });
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
        const before = found(await db('users').select(model.columns).where({id:params.id}).forUpdate().first());
        const row = found(await model.update(params.id,body,db));
        const action = row.is_active === before.is_active ? 'user_updated' : row.is_active ? 'user_activated' : 'user_deactivated';
        if (!body.password_hash || Object.keys(body).length>1) await audit.record(db,req.user.id,action,'user',row.id,before,row);
        if (body.password_hash) await audit.record(db,req.user.id,'password_reset','user',row.id,null,null);
        return row;
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
      await knex.transaction(async db=>{
        await membership.grant(params.id,body.role_id,db);
        const [auditId]=await audit.record(db,req.user.id,'role_assigned','role',params.id,null,body);
        await notifications.adminGrant(db,req.user.id,body.role_id,auditId);
      });
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
        await audit.record(db,req.user.id,'role_removed','role',params.id,params,null);
      });
      res.status(200).json({ data: { revoked: true } });
    } catch (error) {
      next(error);
    }
  }
}
export default new UserController();
