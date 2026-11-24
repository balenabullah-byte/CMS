import { J, id, str, email, password, page } from './common.js';
export default {
  list: { query: page },
  detail: { params: J.object({ id: id.required() }) },
  create: { body: J.object({email: email, full_name: str(150), campus_id: str(30), member_type: J.string().valid('student','faculty','staff','contractor'), password: password, is_active: J.boolean()}).fork(["email","full_name","member_type","password"], s => s.required()) },
  update: { params: J.object({ id: id.required() }), body: J.object({email: email, full_name: str(150), campus_id: str(30), member_type: J.string().valid('student','faculty','staff','contractor'), password: password, is_active: J.boolean()}).min(1) },
  roles: { params: J.object({ id: id.required() }) },
  grant: { params: J.object({ id: id.required() }), body: J.object({ role_id: id.required() }) },
  revoke: { params: J.object({ id: id.required(), role_id: id.required() }) },
};
