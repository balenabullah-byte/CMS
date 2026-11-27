import inbox from '../module/notification.module.js';
import audit from '../module/audit.module.js';
import policies from '../module/policy.module.js';
import deadlines from '../module/deadline.module.js';
import recommendations from '../module/recommendation.module.js';
import requests from '../module/maintenance.module.js';
import {found} from './common.js';
function respond(operation){
  return async (req,res,next)=>{try{res.json({data:await operation(req.user,req.input)})}catch(error){next(error)}};
}
export default {
 notices:respond((user,{query})=>inbox.list(user,query)),
 count:respond(user=>inbox.count(user)),
 read:respond((user,{params})=>inbox.read(user,params.id)),
 audit:respond((user,{query})=>audit.list(query)),
 policies:respond(()=>policies.list()),
 save:respond((user,{params,body})=>policies.save(params.priority,body,user.id)),
 deadlines:respond((user,{query})=>deadlines.list(user,query)),
 metrics:respond(()=>deadlines.metrics()),
 candidates:respond(async(user,{params,query})=>recommendations.list(found(await requests.accessible(user,{},params.id)),query))
};
