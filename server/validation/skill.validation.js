import { J, id, page } from './common.js';
export default {
  list: { query: page },
  add: { body: J.object({ technician_id: id.required(), category_id: id.required() }) },
  remove: { params: J.object({ technician_id: id.required(), category_id: id.required() }) },
};
