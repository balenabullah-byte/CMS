import { reportPage } from './reporting.validation.js';
import { J, id, str, page } from './common.js';
export default {
  list: { query: reportPage },
  create: { body: J.object({ building_id: id.required(), room_id: id.allow(null), asset_id:id.allow(null), category_id: id.required(), title: str(150).required(), description: str(12000).required(), location_note: str(255) }) },
  detail: { params: J.object({ id: id.required() }) },
  stats: {  },
  approve: { params: J.object({ id: id.required() }), body: J.object({ note: str(500) }) },
  reject: { params: J.object({ id: id.required() }), body: J.object({ note: str(500).required() }) },
  close: { params: J.object({ id: id.required() }), body: J.object({ note: str(500) }) },
  reopen: { params: J.object({ id: id.required() }), body: J.object({ note: str(500).required() }) },
  priority: { params: J.object({ id: id.required() }), body: J.object({ priority: J.string().valid('low','normal','high').required() }) },
  history: { params: J.object({ id: id.required() }), query: page },
  comments: { params: J.object({ id: id.required() }), query: page },
  comment: { params: J.object({ id: id.required() }), body: J.object({ body: str(12000).required(), visibility: J.string().valid('reporter_visible','staff_only') }) },
};
