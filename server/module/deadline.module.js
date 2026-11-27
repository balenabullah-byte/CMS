import knex from '../connection.js';
import notifications from './notification.module.js';
import {activeRequestIds} from './report-filters.js';
const kinds=['response','resolution'];
class DeadlineModule {
  async snapshot(db,request){
    const policy=await db('maintenance_priority_policies').where({priority:request.priority,is_active:true}).first();
    if(!policy) return;
    const row={request_id:request.id,priority:request.priority};
    for(const k of kinds){
      const target=policy[k+'_target_minutes'], warning=policy[k+'_warning_minutes'];
      row[k+'_target_minutes']=target;
      row[k+'_warning_minutes']=warning;
      for(const [name,minutes] of [['due_at',target],['next_alert',target-warning]])
        row[k+'_'+name]=db.raw('DATE_ADD((SELECT created_at FROM maintenance_requests WHERE id=?), INTERVAL ? MINUTE)',[request.id,minutes]);
    }
    await db('request_deadlines').insert(row);
  }
  async milestone(db,request){
    const q=db('request_deadlines').where({request_id:request.id});
    if(request.status==='rejected') await q.update({response_next_alert:null,resolution_next_alert:null});
    const k={in_progress:'response',closed:'resolution'}[request.status];
    if(!k) return;
    const actual=k==='response'?db('work_assignments').where({request_id:request.id}).min('started_at'):request.closed_at;
    await q.whereNull(k+'_met_at').update({[k+'_met_at']:actual,[k+'_next_alert']:null});
  }
  states(db=knex){
    const q=db('request_deadlines as d').join('maintenance_requests as r','r.id','d.request_id')
      .select('d.*','r.status','r.title','r.reporter_id');
    for(const k of kinds) q.select(db.raw(`CASE WHEN d.${k}_met_at IS NOT NULL THEN IF(d.${k}_met_at<=d.${k}_due_at,'met','missed')
      WHEN r.status='rejected' THEN 'not_applicable' WHEN NOW()>d.${k}_due_at THEN 'overdue'
      WHEN NOW()>=DATE_SUB(d.${k}_due_at, INTERVAL d.${k}_warning_minutes MINUTE) THEN 'approaching' ELSE 'on_track' END AS ${k}_state`),
      db.raw(`TIMESTAMPDIFF(MINUTE,NOW(),d.${k}_due_at) AS ${k}_remaining_minutes`));
    return q;
  }
  async list(user,f){
    const q=knex.from(this.states().as('s'));
    if(!user.roles.some(r=>['coordinator','admin'].includes(r))){
      if(user.roles.includes('technician')) q.whereIn('request_id',activeRequestIds(knex,user.id));
      else q.where({reporter_id:user.id});
    }
    if(f.request_id) q.where({request_id:f.request_id});
    if(f.status) q.where({status:f.status});
    if(f.priority) q.where({priority:f.priority});
    const k=f.kind||'resolution';
    if(f.condition) q.where(k+'_state',f.condition);
    const [{total},rows]=await Promise.all([q.clone().count({total:'*'}).first(),q.orderBy(k+'_due_at').orderBy('request_id').limit(f.limit).offset(f.offset)]);
    return {total:Number(total),rows};
  }
  async metrics(){
    const rows=await Promise.all(kinds.map(k=>knex.from(this.states().as('s')).select(k+'_state as state').count({count:'*'}).groupBy(k+'_state')));
    return Object.fromEntries(kinds.map((k,i)=>[k,Object.fromEntries(rows[i].map(r=>[r.state,Number(r.count)]))]));
  }
  async process(){
    for(const k of kinds){
      const next=k+'_next_alert', due=k+'_due_at';
      const ids=await knex('request_deadlines').where(next,'<=',knex.fn.now()).orderBy(next).limit(50).pluck('request_id');
      for(const id of ids) await knex.transaction(async db=>{
        const row=await db('request_deadlines').where({request_id:id}).where(next,'<=',db.fn.now()).forUpdate()
          .select('*',db.raw('?? <= NOW() AS missed',[due])).first();
        if(!row) return;
        const event=k+(row.missed?'_missed':'_approaching');
        await notifications.deliver(db,{id},event,'deadline:'+id+':'+event,null,['coordinator']);
        await db('request_deadlines').where({request_id:id}).update({[next]:row.missed?null:row[due]});
      });
    }
  }
}
export default new DeadlineModule();
