import model from '../module/assignment.module.js';
import comments from '../module/comment.module.js';
import requests from '../module/maintenance.module.js';
import knex from '../connection.js';
import { found, state } from './common.js';
import { fail } from '../middleware/error.middleware.js';

async function lockOwnedAssignment(id, technicianId, db) {
  const reference = found(await model.getById(id, db));
  const request = found(await requests.lock(reference.request_id, db));
  const job = await model.active(request.id, db);
  if (!job || job.id !== reference.id || job.technician_id !== technicianId) fail(404, 'Active assignment not found');
  return { request, job };
}

class AssignmentController {
  async assign(req, res, next) {
    try {
      const { body, params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const request = found(await requests.lock(params.id, db));
        state(request, ['approved','reopened']);

        const job = await model.create({ request_id: request.id, technician_id: body.technician_id, assigned_by_id: user.id }, db);
        await requests.update(request.id, { status: 'assigned', status_changed_by_id: user.id, status_note: null }, db);
        if (body.instructions) await comments.create({
          request_id: request.id, author_id: user.id, visibility: 'staff_only',
          body: 'Instructions for assignment #' + job.id + ': ' + body.instructions,
        }, db);
        return job;
      });
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  }

  async reassign(req, res, next) {
    try {
      const { body, params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const request = found(await requests.lock(params.id, db));
        state(request, ['assigned','in_progress']);
        const old = found(await model.active(request.id, db));
        await model.update(old.id, { ended_at: new Date(), ended_by_id: user.id, end_reason: 'reassigned' }, db);
        await requests.update(request.id, { status: 'reopened', status_changed_by_id: user.id, status_note: body.note }, db);
        const job = await model.create({ request_id: request.id, technician_id: body.technician_id, assigned_by_id: user.id }, db);
        await requests.update(request.id, { status: 'assigned', status_changed_by_id: user.id, status_note: null }, db);
        if (body.instructions) await comments.create({
          request_id: request.id, author_id: user.id, visibility: 'staff_only',
          body: 'Instructions for assignment #' + job.id + ': ' + body.instructions,
        }, db);
        return job;
      });
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const { query } = req.input;
      const user = req.user;
      res.status(200).json({ data: await model.jobs(user, query) });
    } catch (error) {
      next(error);
    }
  }

  async summary(req,res,next) {
    try { res.json({data:await model.summary(req.user.id,req.input.query)}); } catch(error) { next(error); }
  }
  async search(req,res,next) {
    try { res.json({data:await model.search(req.user,req.input.query)}); } catch(error) { next(error); }
  }

  async detail(req, res, next) {
    try {
      res.json({ data: found(await model.jobs(req.user, { id: req.input.params.id })) });
    } catch (error) { next(error); }
  }

  async start(req, res, next) {
    try {
      const { params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const { request, job } = await lockOwnedAssignment(params.id, user.id, db);
        state(request, ['assigned']);
        await model.update(job.id, { started_at: new Date() }, db);
        return requests.update(request.id, { status: 'in_progress', status_changed_by_id: user.id, status_note: null }, db);
      });
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  async progress(req, res, next) {
    try {
      const { body, params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const { request, job } = await lockOwnedAssignment(params.id, user.id, db);
        state(request, ['in_progress']);
        return comments.create({ request_id: request.id, author_id: user.id, visibility: 'staff_only', body: body.body }, db);
      });
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  async complete(req, res, next) {
    try {
      const { body, params } = req.input;
      const user = req.user;
      const data = await knex.transaction(async db => {
        const { request, job } = await lockOwnedAssignment(params.id, user.id, db);
        state(request, ['in_progress']);
        const completed = new Date();
        await model.update(job.id, { ...body, completed_at: completed, ended_at: completed,
          ended_by_id: user.id, end_reason: 'completed' }, db);
        return requests.update(request.id, { status: 'completed', status_changed_by_id: user.id, status_note: null }, db);
      });
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
export default new AssignmentController();
