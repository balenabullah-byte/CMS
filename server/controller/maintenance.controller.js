import model from '../module/maintenance.module.js';
import attachments from '../module/attachment.module.js';
import comments from '../module/comment.module.js';
import assignments from '../module/assignment.module.js';
import history from '../module/history.module.js';
import knex from '../connection.js';
import { found, state } from './common.js';
import { fail } from '../middleware/error.middleware.js';

class MaintenanceController {
  async list(req, res, next) {
    try {
      const { query } = req.input;
      const user = req.user;
      res.status(200).json({ data: await model.accessible(user, query) });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { body } = req.input;
      const user = req.user;
      res.status(201).json({ data: await model.create({ ...body, reporter_id: user.id }) });
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const { params } = req.input;
      const user = req.user;
      res.status(200).json({ data: found(await model.accessible(user, {}, params.id)) });
    } catch (error) {
      next(error);
    }
  }

  async summary(req, res, next) {
    try {
      const reporter = req.user.roles.includes('coordinator') ? undefined : req.user.id;
      res.json({ data: await model.statistics(reporter) });
    } catch (error) { next(error); }
  }

  async stats(req, res, next) {
    try {
      res.status(200).json({ data: await model.statistics() });
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const { body, params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const request = found(await model.lock(params.id, db));
        state(request, ["submitted"]);

        return model.update(request.id, { status: 'approved', status_changed_by_id: user.id, status_note: body.note || null, reviewed_at: new Date(), reviewed_by_id: user.id }, db);
      });
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const { body, params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const request = found(await model.lock(params.id, db));
        state(request, ["submitted"]);

        return model.update(request.id, { status: 'rejected', status_changed_by_id: user.id, status_note: body.note || null, reviewed_at: new Date(), reviewed_by_id: user.id }, db);
      });
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  async close(req, res, next) {
    try {
      const { body, params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const request = found(await model.lock(params.id, db));
        state(request, ["completed"]);

        return model.update(request.id, { status: 'closed', status_changed_by_id: user.id, status_note: body.note || null, closed_at: new Date(), closed_by_id: user.id }, db);
      });
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  async reopen(req, res, next) {
    try {
      const { body, params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const request = found(await model.lock(params.id, db));
        state(request, ["assigned","in_progress","completed","closed"]);
        const active = await assignments.active(request.id, db);
        if (active) await assignments.update(active.id, { ended_at: new Date(), ended_by_id: user.id, end_reason: 'cancelled' }, db);
        return model.update(request.id, { status: 'reopened', status_changed_by_id: user.id, status_note: body.note || null, closed_at: null, closed_by_id: null }, db);
      });
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  async priority(req, res, next) {
    try {
      const { body, params } = req.input;
      res.status(200).json({ data: found(await model.update(params.id, body)) });
    } catch (error) {
      next(error);
    }
  }

  async attachments(req,res,next) {
    try {
      const {params,query}=req.input;
      found(await model.accessible(req.user,{},params.id));
      const staff=req.user.roles.includes('coordinator') || (req.user.roles.includes('technician') && await assignments.isAssigned(params.id,req.user.id));
      res.json({data:await attachments.list(params.id,req.user.id,staff,query)});
    } catch(error) {next(error)}
  }

  async history(req, res, next) {
    try {
      const { params, query } = req.input;
      const user = req.user;
      found(await model.accessible(user, query, params.id));
      res.status(200).json({ data: await history.list(params.id, query, user.roles.includes('coordinator') || (user.roles.includes('technician') && await assignments.isAssigned(params.id, user.id))) });
    } catch (error) {
      next(error);
    }
  }

  async comments(req, res, next) {
    try {
      const { params, query } = req.input;
      const user = req.user;
      found(await model.accessible(user, query, params.id));
      const staff = user.roles.includes('coordinator') || (user.roles.includes('technician') && await assignments.isAssigned(params.id, user.id));
      res.status(200).json({ data: await comments.list(params.id, query, staff) });
    } catch (error) {
      next(error);
    }
  }

  async comment(req, res, next) {
    try {
      const { body, params, query } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const request = found(await model.accessible(user, query, params.id, db));
        if (['closed','rejected'].includes(request.status)) fail(409, 'Comments are read-only on ' + request.status + ' requests.');
        if (body.visibility === 'staff_only' && !user.roles.includes('coordinator') &&
            !(user.roles.includes('technician') && await assignments.isAssigned(params.id, user.id, db)))
          fail(403, 'Staff access required');
        return comments.create({ ...body, request_id: params.id, author_id: user.id }, db);
      });
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
export default new MaintenanceController();
