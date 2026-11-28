import knex from '../connection.js';
import {period} from './report-filters.js';
const fields={
 asset_category:['code','name','description','is_active'],
 asset:['asset_code','name','asset_category_id','building_id','room_id','manufacturer','model','serial_number','description',
   'operational_status','purchase_date','installation_date','warranty_expires_at','retired_at','retired_by_id','retirement_reason'],
 user:['is_active','member_type'],role:['role_id'],building:['code','name','is_active'],
 room:['building_id','room_code','floor_number','is_active'],maintenance_category:['code','name','is_active'],
 technician_skill:['technician_id','category_id'],priority_policy:['priority','response_target_minutes','resolution_target_minutes','response_warning_minutes','resolution_warning_minutes','is_active']
};
function permitted(type,row){
  return row ? JSON.stringify(Object.fromEntries(fields[type].filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]))) : null;
}
class AuditModule {
  record(db,actor,action,type,id,oldRow,newRow){
    return db('audit_logs').insert({actor_id:actor,action,entity_type:type,entity_id:String(id),
      old_values:permitted(type,oldRow),new_values:permitted(type,newRow)});
  }
  async list(f){
    const q=knex('audit_logs');
    for(const k of ['actor_id','action','entity_type','entity_id']) if(f[k]) q.where(k,f[k]);
    if(f.search) q.where(function(){this.where('action','like','%'+f.search+'%').orWhere('entity_id','like','%'+f.search+'%')});
    period(q,'created_at',f);
    const [{total},rows]=await Promise.all([q.clone().count({total:'*'}).first(),q.orderBy('id',f.direction||'desc').limit(f.limit).offset(f.offset)]);
    return {rows,total:Number(total)};
  }
}
export default new AuditModule();
