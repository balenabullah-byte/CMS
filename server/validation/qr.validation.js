import {J,id} from './common.js';
const target = J.object({type:J.string().valid('asset','room','building').required(),id:id.required()});
export const token = J.string().pattern(/^[A-Za-z0-9_-]{43}$/);
class QrValidation {
  history={params:target};
  generate={params:target,body:J.object({replace_id:id})};
  revoke={params:J.object({id:id.required()})};
  scan={params:J.object({token:token.required()})};
}
export default new QrValidation();
