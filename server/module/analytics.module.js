import verification from './verification.module.js';
import usersModule from './user.module.js';
import db from '../connection.js';
import { period, dimensions, elapsed } from './report-filters.js';

const n = row => Number(row?.n || 0);
const count = q => q.clone().count({n:'*'}).first().then(n);
const buckets = (q,col) => q.clone().select({label:col}).count({value:'*'}).groupBy(col).orderBy('value','desc');
const days = (q,col) => q.clone().select(db.raw('DATE_FORMAT(??,\'%Y-%m-%d\') as label',[col]))
  .count({value:'*'}).groupBy('label').orderBy('label');
const kpi = (label,value,unit='',samples) => ({label,value,unit,samples});
const section = (title,rows) => ({title,rows});
const reqs = f => dimensions(db('maintenance_requests as r'),f);
function repairs(f) {
  const q = dimensions(db('work_assignments as a').join('maintenance_requests as r','r.id','a.request_id'),f)
    .where('a.end_reason','completed');
  if (f.technician_id) q.where('a.technician_id',f.technician_id);
  if (f.cause === 'missing') q.whereNull('a.root_cause');
  else if (f.cause) q.where('a.root_cause',f.cause);
  return period(q,'a.completed_at',f);
}
function duration(q, start, end) {
  return q.clone().whereNotNull(start).whereNotNull(end).whereColumn(end,'>=',start)
    .select(db.raw('AVG(TIMESTAMPDIFF(SECOND,??,??))/60 AS mean',[start,end])).count({n:'*'}).first();
}
const average = (title, row) => kpi(title,row.mean == null ? null : Number(row.mean),'min',n(row));
function causeBuckets(q) {
  return q.clone().select(db.raw("COALESCE(a.root_cause,'missing') AS label")).count({value:'*'}).groupBy('a.root_cause').orderBy('value','desc');
}

class AnalyticsModule {
  async operations(f) {
    const current = reqs(f), reported = period(current.clone(),'r.created_at',f);
    const closures = db('request_history').where('new_status','closed').select('request_id').min({event_at:'created_at'}).groupBy('request_id');
    const resolved = period(current.clone().join(closures.as('cl'),'cl.request_id','r.id'),'cl.event_at',f);
    const starts = db('work_assignments as w').join('maintenance_requests as original','original.id','w.request_id')
      .select('w.request_id').whereColumn('w.started_at','>=','original.created_at').min({event_at:'w.started_at'}).groupBy('w.request_id');
    const responded = period(current.clone().join(starts.as('st'),'st.request_id','r.id'),'st.event_at',f);
    const jobs = repairs(f);
    const [incoming, closed, states, byBuilding, byCategory, createdTrend, closedTrend, response, repair, resolution, labor, causes, assignmentDelay, verificationDelay] = await Promise.all([
      count(reported), count(resolved), buckets(current,'r.status'),
      buckets(reported.clone().join('buildings as b','b.id','r.building_id'),'b.name'),
      buckets(reported.clone().join('maintenance_categories as c','c.id','r.category_id'),'c.name'),
      days(reported,'r.created_at'),days(resolved,'cl.event_at'),duration(responded,'r.created_at','st.event_at'),
      duration(jobs,'a.started_at','a.completed_at'),duration(resolved,'r.created_at','cl.event_at'),
      jobs.clone().sum({minutes:'a.labor_minutes'}).count({samples:'a.labor_minutes'}).first(),causeBuckets(jobs),
      duration(period(dimensions(db('work_assignments as a').join('maintenance_requests as r','r.id','a.request_id'),f),'a.assigned_at',f),'r.created_at','a.assigned_at'),
      duration(period(verification.join(dimensions(db('work_assignments as a').join('maintenance_requests as r','r.id','a.request_id'),f)).where('ev.decision','closed'),'ev.decision_at',f),'a.completed_at','ev.decision_at')
    ]);
    const tally = (...names) => states.reduce((sum,s) => sum+(names.includes(s.label)? Number(s.value):0),0);
    return {metrics:[kpi('Reported',incoming),kpi('First verified closures',closed),kpi('Current open backlog',tally('submitted','approved','assigned','in_progress','completed','reopened')),
      kpi('Awaiting assignment',tally('approved','reopened')),kpi('In progress',tally('in_progress')),kpi('Awaiting verification',tally('completed')),
      average('Response time',response),average('Assignment delay',assignmentDelay),average('Verification delay',verificationDelay),average('Elapsed repair time',repair),average('Time to first closure',resolution),
      kpi('Recorded labor',labor.minutes,'min',Number(labor.samples))],
      series:[section('Reported by day',createdTrend),section('First closures by day',closedTrend),section('Current request statuses',states),
        section('Reports by building',byBuilding),section('Reports by category',byCategory),section('Completed repairs by cause',causes)]};
  }
  async causes(f) {
    const jobs = repairs(f);
    const breakdown = (table,key,name) => jobs.clone().join(table+' as d','d.id',key)
      .select(db.raw("CONCAT(d.??,' / ',COALESCE(a.root_cause,'missing')) as label",[name]))
      .count({value:'*'}).groupBy('d.id','label').orderBy('value','desc');
    const [distribution, buildings, categories, recurring] = await Promise.all([causeBuckets(jobs),breakdown('buildings','r.building_id','name'),
      breakdown('maintenance_categories','r.category_id','name'),
      jobs.clone().join('buildings as b','b.id','r.building_id').join('maintenance_categories as c','c.id','r.category_id')
        .whereNotNull('a.root_cause').whereNot('a.root_cause','unknown').select('b.name as building','c.name as category','a.root_cause')
        .count({completed_assignments:'*'}).groupBy('b.id','b.name','c.id','c.name','a.root_cause').havingRaw('COUNT(*) > 1').orderBy('completed_assignments','desc')]);
    return {metrics:[kpi('Completed assignments',distribution.reduce((sum,r)=>sum+Number(r.value),0)),
      kpi('Cause unrecorded',Number(distribution.find(r=>r.label==='missing')?.value || 0)),
      kpi('Explicitly unknown',Number(distribution.find(r=>r.label==='unknown')?.value || 0))],
      series:[section('Completed assignments by cause',distribution),section('Causes by building',buildings),section('Causes by category',categories)],table:recurring};
  }
  async workload(f) {
    const current = dimensions(db('work_assignments as a').join('maintenance_requests as r','r.id','a.request_id'),f);
    if (f.technician_id) current.where('a.technician_id',f.technician_id);
    const grouped = q => q.join('users as u','u.id','a.technician_id')
      .select('u.id','u.full_name as label').groupBy('u.id','u.full_name').orderBy('u.full_name');
    const eligible=db('users as u').join('user_roles as ur','ur.user_id','u.id').join('roles as ro','ro.id','ur.role_id')
      .where('ro.code','technician').where('u.is_active',1).select('u.id','u.full_name as label');
    if(f.technician_id)eligible.where('u.id',f.technician_id);
    const [active,done,waiting,skills,technicians] = await Promise.all([
      grouped(current.clone().whereNull('a.ended_at')).count({value:'*'}).count({started:'a.started_at'}),
      grouped(repairs(f)).count({value:'*'}).sum({labor:'a.labor_minutes'}).select(db.raw('AVG(CASE WHEN '+elapsed+' >= 0 THEN '+elapsed+' END) as repair')),
      grouped(current.clone().where('a.end_reason','completed').where('r.status','completed')
        .whereNotExists(function(){this.select(1).from('work_assignments as later').whereRaw('later.request_id=a.request_id AND later.id>a.id')})).count({value:'*'}),
      db('technician_skills as s').join('maintenance_categories as c','c.id','s.category_id').select('s.technician_id','c.name'),eligible]);
    const people = new Map([...technicians,...active,...done,...waiting].map(row=>[row.id,row.label]));
    const table = [...people].map(([id,label])=>{
      const open = active.find(r=>r.id===id), complete=done.find(r=>r.id===id);
      return {technician:label,active:Number(open?.value||0),in_progress:Number(open?.started||0),completed:Number(complete?.value||0),
        awaiting_verification:Number(waiting.find(r=>r.id===id)?.value||0),mean_repair_minutes:complete?.repair??null,
        labor_minutes:complete?.labor??null,skills:skills.filter(s=>s.technician_id===id).map(s=>s.name).join(', ')};
    });
    const column={active:'active',in_progress:'in_progress',completed:'completed',verification:'awaiting_verification'}[f.assignment_status];
    const included=column?table.filter(row=>row[column]>0):table;
    return {metrics:[],series:['active','in_progress','completed','awaiting_verification'].map((key,i)=>
      section(['Current active assignments','Currently in progress','Completed during period','Currently awaiting verification'][i],
        included.map(row=>({label:row.technician,value:row[key]})))),table:included};
  }
  async accounts(f) {
    const users = usersModule.directoryBase(f);
    const created=period(users.clone(),'u.created_at',f);
    const [total,active,newUsers,types,roles,trend] = await Promise.all([count(users),count(users.clone().where('u.is_active',1)),count(created),
      buckets(created,'u.member_type'),buckets(created.clone().join('user_roles as ur','ur.user_id','u.id').join('roles as ro','ro.id','ur.role_id'),'ro.code'),days(created,'u.created_at')]);
    return {metrics:[kpi('Accounts',total),kpi('Active',active),kpi('Inactive',total-active),kpi('Created during period',newUsers)],
      series:[section('Member types',types),section('Role memberships (accounts may overlap)',roles),section('Accounts created by day',trend)]};
  }
  async infrastructure(f) {
    const reports=period(reqs(f),'r.created_at',f);
    const buildings=db('buildings'),rooms=db('rooms');
    if(f.building_id){buildings.where('id',f.building_id);rooms.where('building_id',f.building_id)}
    if(f.room_id) rooms.where('id',f.room_id);
    const [total,active,roomCount,locations,byBuilding,categories,recurring]=await Promise.all([count(buildings),count(buildings.clone().where('is_active',1)),count(rooms),
      reports.clone().countDistinct({n:'r.room_id'}).first(),reports.clone().join('buildings as b','b.id','r.building_id').select('b.name as building')
        .count({reports:'*'}).select(db.raw("SUM(r.status='closed') AS resolved, SUM(r.status NOT IN ('closed','rejected')) AS unresolved")).groupBy('b.id','b.name').orderBy('reports','desc'),
      buckets(reports.clone().join('maintenance_categories as c','c.id','r.category_id'),'c.name'),
      reports.clone().join('buildings as b','b.id','r.building_id').leftJoin('rooms as rm','rm.id','r.room_id')
        .join('maintenance_categories as c','c.id','r.category_id').select(db.raw("CONCAT(b.name,' / ',COALESCE(rm.room_code,'Building-wide'),' / ',c.name) AS label"))
        .count({value:'*'}).groupBy('b.id','rm.id','c.id','label').havingRaw('COUNT(*) > 1').orderBy('value','desc')]);
    return {metrics:[kpi('Buildings',total),kpi('Active buildings',active),kpi('Rooms',roomCount),kpi('Rooms with reports',n(locations))],
      series:[section('Reported issues by building',byBuilding.map(x=>({label:x.building,value:x.reports}))),section('Reported issues by category',categories),section('Repeated reports by location and category',recurring)],table:byBuilding};
  }
}
export default new AnalyticsModule();
