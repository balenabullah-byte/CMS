import { J, email, password } from './common.js';
export default {
  login: { body: J.object({ email: email.required(), password: J.string().max(256).required() }) },
  logout: {  },
  me: {  },
};
