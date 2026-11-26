import { J, id, page, str } from './common.js';
import { causes, requestStates } from '../../shared/maintenance.js';

const choice = (...values) => J.string().valid(...values);
const day = J.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((s, h) => {
  const value = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(+value) && value.toISOString().slice(0,10) === s ? s : h.error('any.invalid');
});
const duration = J.number().integer().min(0).max(10000000);
const dimensions = { building_id:id, room_id:id, category_id:id, priority:choice('low','normal','high'),
  status:choice(...requestStates), from:day, to:day };
export const assignmentFields = { ...dimensions, technician_id:id, search:str(150),
  cause:choice(...Object.keys(causes),'missing'), end_reason:choice('completed','cancelled','reassigned'),
  scope:choice('active','ended','verification','all','started','waiting'),
  date_field:choice('assigned','completed','ended','reported','closed'), labor_min:duration,labor_max:duration,
  repair_min:duration,repair_max:duration, sort:choice('id','title','assigned','completed','ended','labor'),
  direction:choice('asc','desc') };
function ranges(q,h) {
  if ((q.from && q.to && q.from > q.to) || q.labor_min > q.labor_max || q.repair_min > q.repair_max)
    return h.message({custom:'Range start must be at or before its end'});
  return q;
}
export const workPage = page.keys(assignmentFields).custom(ranges);
export const reportPage = page.keys({...dimensions, search:str(150), totals:J.boolean(), status:choice(...requestStates,'ready','active'),
  sort:choice('created_at','updated_at','title','id'),direction:choice('asc','desc')}).custom(ranges);
export const analyticsFilters = J.object(dimensions).custom(ranges);
export const causeFilters = J.object({...dimensions,cause:assignmentFields.cause,technician_id:id}).custom(ranges);
export const workloadFilters = J.object({...dimensions,technician_id:id,assignment_status:choice('active','in_progress','completed','verification')}).custom(ranges);
export const accountFilters = J.object({from:day,to:day,search:str(150),member_type:choice('student','staff','faculty','contractor'),
  role:choice('admin','coordinator','technician','campus_member'),active:J.boolean()}).custom(ranges);
