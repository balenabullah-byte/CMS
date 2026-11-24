import { J, id, str, page } from './common.js';
export default {
  assign: { params: J.object({ id: id.required() }), body: J.object({ technician_id: id.required(), instructions: str(2000) }) },
  reassign: { params: J.object({ id: id.required() }), body: J.object({ technician_id: id.required(), instructions: str(2000), note: str(500).required() }) },
  list: { query: page.keys({ request_id: id }) },
  detail: { params: J.object({ id: id.required() }) },
  start: { params: J.object({ id: id.required() }) },
  progress: { params: J.object({ id: id.required() }), body: J.object({ body: str(12000).required() }) },
  complete: { params: J.object({ id: id.required() }), body: J.object({ completion_note: str(12000).required() }) },
};
