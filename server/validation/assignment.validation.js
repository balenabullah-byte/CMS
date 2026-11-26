import { J, id, str, page } from './common.js';
import { causes, maxLaborMinutes } from '../../shared/maintenance.js';
export default {
  assign: { params: J.object({ id: id.required() }), body: J.object({ technician_id: id.required(), instructions: str(2000) }) },
  reassign: { params: J.object({ id: id.required() }), body: J.object({ technician_id: id.required(), instructions: str(2000), note: str(500).required() }) },
  list: { query: page.keys({ request_id: id }) },
  detail: { params: J.object({ id: id.required() }) },
  start: { params: J.object({ id: id.required() }) },
  progress: { params: J.object({ id: id.required() }), body: J.object({ body: str(12000).required() }) },
  complete: { params: J.object({ id: id.required() }), body: J.object({ completion_note: str(12000).required(),
    root_cause: J.string().valid(...Object.keys(causes)).required(),
    root_cause_details: str(4000).when('root_cause', { is: 'other', then: J.required() }),
    labor_minutes: J.number().integer().min(0).max(maxLaborMinutes), materials_used: str(4000) }) },
};
