import { J, id, page, str } from './common.js';
import { calendarDay } from './reporting.validation.js';

const statuses = ['operational', 'under_maintenance', 'out_of_service'];
const params = J.object({ id: id.required() });
const location = { building_id: id.required(), room_id: id.allow(null).default(null) };
const category = {
  code: str(40)
    .uppercase()
    .pattern(/^[A-Z0-9_-]+$/),
  name: str(100),
  description: str(4000).allow(null),
  is_active: J.boolean(),
};
const inventory = {
  name: str(150),
  asset_category_id: id,
  manufacturer: str(150).allow(null),
  model: str(150).allow(null),
  serial_number: str(150).allow(null),
  description: str(4000).allow(null),
  purchase_date: calendarDay.allow(null),
  installation_date: calendarDay.allow(null),
  warranty_expires_at: calendarDay.allow(null),
};
const dates = J.object({ from: calendarDay, to: calendarDay }).custom((v, h) =>
  v.from && v.to && v.from > v.to ? h.error('any.invalid') : v
);
const reason = str(500).required();

class AssetValidation {
  categories = { query: page.keys({ search: str(150), active: J.boolean() }) };
  categoryCreate = {
    body: J.object({ ...category, code: category.code.required(), name: category.name.required() }),
  };
  categoryEdit = { params, body: J.object(category).min(1) };
  directory = {
    query: page.keys({
      search: str(150),
      asset_category_id: id,
      building_id: id,
      room_id: id,
      operational_status: J.string().valid(...statuses, 'retired'),
      sort: J.string().valid('asset_code', 'name', 'building', 'category', 'operational_status'),
      direction: J.string().valid('asc', 'desc'),
    }),
  };
  lookup = { query: page.keys({ ...location, search: str(150) }) };
  create = {
    body: J.object({
      ...inventory,
      ...location,
      name: inventory.name.required(),
      asset_category_id: id.required(),
      operational_status: J.string()
        .valid(...statuses)
        .default('operational'),
    }),
  };
  edit = { params, body: J.object(inventory).min(1) };
  status = {
    params,
    body: J.object({
      operational_status: J.string()
        .valid(...statuses)
        .required(),
    }),
  };
  transfer = { params, body: J.object({ ...location, reason }) };
  retire = { params, body: J.object({ reason }) };
  detail = { params };
  history = { params, query: page };
  analytics = { query: dates };
}
export default new AssetValidation();
