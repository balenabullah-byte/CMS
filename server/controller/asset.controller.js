import db from '../connection.js';
import assets from '../module/asset.module.js';
import analytics from '../module/asset-analytics.module.js';
import requests from '../module/maintenance.module.js';
import { found } from './common.js';

function handle(fn, status = 200) {
  return async (req, res, next) => {
    try {
      res.status(status).json({ data: await fn(req.input, req.user) });
    } catch (error) {
      next(error);
    }
  };
}
class AssetController {
  categories = handle(({ query }) => assets.categories(query));
  createCategory = handle(
    ({ body }, user) => db.transaction((t) => assets.saveCategory(t, user.id, null, body)),
    201
  );
  editCategory = handle(({ params, body }, user) =>
    db.transaction((t) => assets.saveCategory(t, user.id, params.id, body))
  );
  list = handle(({ query }) => assets.directory(query));
  lookup = handle(({ query }) => assets.lookup(query));
  detail = handle(async ({ params }) => found(await assets.detail(params.id)));
  create = handle(({ body }, user) => db.transaction((t) => assets.create(t, user.id, body)), 201);
  change(action) {
    return handle(({ params, body }, user) =>
      db.transaction((t) => assets.change(t, user.id, params.id, action, body))
    );
  }
  history = handle(async ({ params, query }) => {
    found(await assets.detail(params.id));
    return assets.history(params.id, query);
  });
  locations = handle(async ({ params, query }) => {
    found(await assets.detail(params.id));
    return assets.locations(params.id, query);
  });
  analytics = handle(({ query }) => analytics.report(query));
  requestEquipment = handle(({ params, query }, user) =>
    db.transaction(
      async (trx) => {
        const request = found(await requests.accessible(user, {}, params.id, trx));
        const asset = found(await assets.detail(found(request.asset_id), trx));
        const identity = { id: asset.id, asset_code: asset.asset_code, name: asset.name };
        if (user.roles.includes('campus_member')) return { asset: identity };
        if (user.roles.includes('coordinator'))
          return { asset, history: await assets.history(asset.id, query, trx) };
        const job = found(
          await trx('work_assignments')
            .where({ request_id: request.id, technician_id: user.id })
            .whereNull('ended_at')
            .first()
        );
        const { manufacturer, model, serial_number, building, room_code, category, operational_status } =
          asset;
        return {
          asset: {
            ...identity,
            manufacturer,
            model,
            serial_number,
            building,
            room_code,
            category,
            operational_status,
          },
          history: await assets.history(asset.id, query, trx, job),
        };
      },
      { isolationLevel: 'repeatable read' }
    )
  );
}
export default new AssetController();
