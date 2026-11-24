import model from '../module/category.module.js';
import { found } from './common.js';

class CategoryController {
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
      res.status(201).json({ data: await model.create(body) });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { body, params } = req.input;
      res.status(200).json({ data: found(await model.update(params.id, body)) });
    } catch (error) {
      next(error);
    }
  }
}
export default new CategoryController();
