import { J, id, str, page } from './common.js';
export default {
  list: { query: page },
  detail: { params: J.object({ id: id.required() }) },
  create: { body: J.object({building_id: id, room_code: str(30), floor_number: J.number().integer().min(-32768).max(32767), description: str(255), is_active: J.boolean()}).fork(["building_id","room_code"], s => s.required()) },
  update: { params: J.object({ id: id.required() }), body: J.object({building_id: id, room_code: str(30), floor_number: J.number().integer().min(-32768).max(32767), description: str(255), is_active: J.boolean()}).min(1) },
};
