import knex from '../connection.js';
import {period} from './report-filters.js';

class NotificationModule {
  async deliver(db, request, event, identity, actor, audiences, job) {
    const recipients = db('users as u').join('user_roles as ur','ur.user_id','u.id')
      .join('roles as r','r.id','ur.role_id').where('u.is_active',true)
      .where(function () {
        if (audiences.includes('coordinator')) this.orWhere('r.code','coordinator');
        if (audiences.includes('campus_member')) this.orWhere({ 'r.code':'campus_member','u.id':request.reporter_id });
        if (audiences.includes('technician') && job) this.orWhere({ 'r.code':'technician','u.id':job.technician_id });
      }).select('u.id','r.code').orderBy('r.code');
    if (actor) recipients.whereNot('u.id',actor);
    const rows = (await recipients).map(({id,code}) => ({
      user_id:id, request_id:request.id, assignment_id:code==='technician'?job.id:null,
      portal:code, event_type:event, deduplication_key:audiences.length===1 ? identity : identity+':'+code
    }));
    if (rows.length) await db('notifications').insert(rows).onConflict(['user_id','deduplication_key']).ignore();
  }
  async workflow(db, request, actor) {
    const event = request.status;
    const audiences = {
      submitted:['coordinator'],approved:['campus_member'],rejected:['campus_member'],
      assigned:['technician','campus_member'],in_progress:['campus_member'],completed:['coordinator'],
      closed:['technician','campus_member'],reopened:['technician','campus_member']
    };
    const history = await db('request_history').where({request_id:request.id}).orderBy('id','desc').first('id');
    const job = await db('work_assignments').where({request_id:request.id}).orderBy('id','desc').first();
    if(event==='reopened' && job?.end_reason==='reassigned'){
      await this.deliver(db,request,'reassigned','assignment-ended:'+job.id,actor,['technician'],job);
      return;
    }
    await this.deliver(db,request,event,'history:'+history.id,actor,audiences[event],job);
  }
  async adminGrant(db,actor,roleId,auditId){
    const role=await db('roles').where({id:roleId}).first('code');
    if(role.code!=='admin') return;
    const recipients=await db('users as u').join('user_roles as ur','ur.user_id','u.id')
      .where({'ur.role_id':roleId,'u.is_active':true}).whereNot('u.id',actor).pluck('u.id');
    if(recipients.length) await db('notifications').insert(recipients.map(user_id=>({
      user_id,portal:'admin',event_type:'admin_access_granted',deduplication_key:'audit:'+auditId
    })));
  }
  async comment(db,comment) {
    const request = await db('maintenance_requests').where({id:comment.request_id}).first();
    const job = await db('work_assignments').where({request_id:request.id}).whereNull('ended_at').first();
    const internal = comment.visibility==='staff_only';
    await this.deliver(db,request,internal?'internal_update':'public_comment','comment:'+comment.id,comment.author_id,
      internal?['coordinator','technician']:['coordinator','technician','campus_member'],job);
  }
  inbox(user) {
    return knex('notifications').where({user_id:user.id}).whereIn('portal',user.roles)
      .where(function(){
        this.whereNot('event_type','internal_update').orWhere('portal','coordinator')
          .orWhereIn('assignment_id',knex('work_assignments').where({technician_id:user.id}).whereNull('ended_at').select('id'));
      });
  }
  async list(user,f) {
    const q=this.inbox(user);
    if(f.event_type) q.where({event_type:f.event_type});
    if(f.read==='unread') q.whereNull('read_at');
    if(f.read==='read') q.whereNotNull('read_at');
    period(q,'created_at',f);
    const [{total},rows]=await Promise.all([q.clone().count({total:'*'}).first(),q.orderBy('id','desc').limit(f.limit).offset(f.offset)]);
    return {rows,total:Number(total)};
  }
  async count(user){return Number((await this.inbox(user).whereNull('read_at').count({n:'*'}).first()).n);}
  async read(user,id){
    const q=this.inbox(user);
    if(id) {
      q.where({id});
      if (!await q.clone().first('id')) return null;
    }
    await q.whereNull('read_at').update({read_at:knex.fn.now()});
    return {unread:await this.count(user)};
  }
}
export default new NotificationModule();
