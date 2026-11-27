import knex from '../connection.js';
import audit from '../module/audit.module.js';
import model from '../module/room.module.js';
import { found } from './common.js';

class RoomController {
  async list(req, res, next) {
    try {
      const { query } = req.input;
      res.status(200).json({ data: await model.getAll(query) });
    } catch (error) {
      next(error);
    }
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
      res.status(201).json({ data: await knex.transaction(async db => {
        const row = await model.create(body,db);
        await audit.record(db,req.user.id,'room_created','room',row.id,null,row);
        return row;
      }) });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { body, params } = req.input;
      res.status(200).json({ data: await knex.transaction(async db => {
        const before = found(await db(model.table).where({id:params.id}).forUpdate().first());
        const row = found(await model.update(params.id,body,db));
        await audit.record(db,req.user.id,before.is_active && !row.is_active ? 'room_deactivated' : 'room_updated','room',row.id,before,row);
        return row;
      }) });
    } catch (error) {
      next(error);
    }
  }
}
export default new RoomController();
