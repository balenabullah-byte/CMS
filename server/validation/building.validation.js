import { J, id, str, page } from './common.js';
export default {
  list: { query: page },
  detail: { params: J.object({ id: id.required() }) },
  create: { body: J.object({code: str(20), name: str(150), description: str(12000), is_active: J.boolean()}).fork(["code","name"], s => s.required()) },
  update: { params: J.object({ id: id.required() }), body: J.object({code: str(20), name: str(150), description: str(12000), is_active: J.boolean()}).min(1) },
};
