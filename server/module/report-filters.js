import { nextDay } from '../../shared/maintenance.js';
export function period(query, field, filter) {
  if (filter.from) query.where(field, '>=', filter.from);
  if (filter.to) query.where(field, '<', nextDay(filter.to));
  return query;
}
export function dimensions(query, filter, alias = 'r') {
  for (const key of ['building_id','room_id','category_id','priority','status']) {
    if (filter[key]) query.where(alias + '.' + key, filter[key]);
  }
  return query;
}
export const elapsed = 'TIMESTAMPDIFF(MINUTE,a.started_at,a.completed_at)';
export function scopedWork(query, user, f) {
  if (!user.roles.includes('coordinator')) query.where('a.technician_id',user.id);
  dimensions(query,f);
  if (f.scope === 'ended') query.whereNotNull('a.ended_at');
  if (['active','waiting','started'].includes(f.scope)) query.whereNull('a.ended_at');
  if (f.scope === 'waiting') query.whereNull('a.started_at');
  if (f.scope === 'started') query.whereNotNull('a.started_at');
  if (f.scope === 'verification') query.where('a.end_reason','completed').where('r.status','completed')
    .whereNotExists(function(){ this.select(1).from('work_assignments as later').whereRaw('later.request_id=a.request_id and later.id>a.id'); });
  if (f.end_reason) query.where('a.end_reason',f.end_reason);
  if (f.technician_id) query.where('a.technician_id',f.technician_id);
  if (f.cause === 'missing') query.whereNull('a.root_cause').where('a.end_reason','completed');
  else if (f.cause) query.where('a.root_cause',f.cause);
  if (f.search) query.where(function(){
    this.where('r.title','like','%' + f.search + '%');
    const ref = /^(?:(REQ|ASG)-)?(\d+)$/i.exec(f.search);
    if (ref && ref[1]?.toUpperCase() !== 'REQ') this.orWhere('a.id',ref[2]);
    if (ref && ref[1]?.toUpperCase() !== 'ASG') this.orWhere('r.id',ref[2]);
  });
  for (const [key, op] of [['min','>='],['max','<=']]) {
    if (f['labor_'+key] != null) query.where('a.labor_minutes',op,f['labor_'+key]);
    if (f['repair_'+key] != null) query.whereRaw(elapsed+' '+op+' ?', [f['repair_'+key]]);
  }
  const fields = {assigned:'a.assigned_at',ended:'a.ended_at',completed:'a.completed_at',reported:'r.created_at',closed:'ev.decision_at'};
  if(f.date_field==='closed' && (f.from || f.to)) query.where('ev.decision','closed');
  return period(query,fields[f.date_field || 'assigned'],f);
}
