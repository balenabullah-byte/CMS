import { J, id, str, page } from './common.js';
export default {
  list: { query: page },
  detail: { params: J.object({ id: id.required() }) },
  update: { params: J.object({ id: id.required() }), body: J.object({description: str(255)}).min(1) },
};
