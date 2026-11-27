import { J, id, page } from './common.js';
export default {
  roster:{query:page.keys({search:J.string().trim().max(150),category_id:id,active:J.boolean()})},
  list: { query: page },
  add: { body: J.object({ technician_id: id.required(), category_id: id.required() }) },
  remove: { params: J.object({ technician_id: id.required(), category_id: id.required() }) },
};
