import {J,id,page,str} from './common.js';
import {requestStates} from '../../shared/maintenance.js';
const priority=J.string().valid('low','normal','high');
const day=J.string().pattern(/^\d{4}-\d\d-\d\d$/).custom((v,h)=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v?v:h.error('any.invalid')});
const period={from:day,to:day};
const duration=J.number().integer().min(1).max(525600).required();
export default {
  id:{params:J.object({id:id.required()})},
  notices:{query:page.keys({...period,event_type:str(50),read:J.string().valid('read','unread')})},
  audit:{query:page.keys({...period,actor_id:id,action:str(50),entity_type:str(40),entity_id:str(80),search:str(100),direction:J.string().valid('asc','desc')})},
  deadlines:{query:page.keys({kind:J.string().valid('response','resolution'),condition:J.string().valid('overdue','approaching','on_track','met','missed','not_applicable'),request_id:id,priority,status:J.string().valid(...requestStates)})},
  policy:{params:J.object({priority:priority.required()}),body:J.object({
    response_target_minutes:duration,resolution_target_minutes:duration.min(J.ref('response_target_minutes')),
    response_warning_minutes:J.number().integer().min(0).max(J.ref('response_target_minutes')).required(),
    resolution_warning_minutes:J.number().integer().min(0).max(J.ref('resolution_target_minutes')).required(),is_active:J.boolean().required()
  })},
  recommendations:{params:J.object({id:id.required()}),query:page.keys({search:str(150),matching:J.boolean(),sort:J.string().valid('recommended','workload')})}
};
