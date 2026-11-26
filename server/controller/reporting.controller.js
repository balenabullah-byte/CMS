import analytics from '../module/analytics.module.js';
import jobs from '../module/assignment.module.js';
import { fail } from '../middleware/error.middleware.js';

export function csv(rows) {
  const escape = value => {
    let text = String(value ?? '');
    if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  };
  if (!rows.length) fail(404,'No matching records to export');
  if (rows.length > 5000) fail(422,'Narrow the filters to export up to 5,000 records');
  const keys = Object.keys(rows[0]);
  return [keys,...rows.map(row=>keys.map(k=>row[k]))].map(row=>row.map(escape).join(',')).join('\r\n');
}
class ReportingController {
  analytics(kind) {
    return async (req,res,next) => {
      try {
        const result = await analytics[kind](req.input.query);
        if (req.path.endsWith('/export')) {
          const rows = [...result.metrics.map(m=>({section:'Summary',label:m.label,value:m.value,unit:m.unit})),
            ...result.series.flatMap(s=>s.rows.map(r=>({section:s.title,label:r.label,value:r.value,unit:''})))];
          if(result.table?.length) {
            for(const row of result.table) for(const [key,value] of Object.entries(row).slice(1))
              rows.push({section:'Supporting records',label:Object.values(row)[0]+' / '+key,value,unit:''});
          }
          res.json({data:{csv:csv(rows)}});
        } else res.json({data:result});
      } catch(error){next(error)}
    };
  }
  async historyExport(req,res,next) {
    try {
      const {rows,total} = await jobs.search(req.user,{...req.input.query,limit:5001,offset:0});
      if(total>5000) fail(422,'Narrow the filters to export up to 5,000 records');
      res.json({data:{csv:csv(rows.map(r=>({assignment:r.id,request:r.request_id,title:r.title,building:r.building,room:r.room_code,
        technician:r.technician_name,cause:r.root_cause,completed:r.completed_at?.toISOString(),reason:r.end_reason,labor_minutes:r.labor_minutes})))}});
    } catch(error){next(error)}
  }
}
export default new ReportingController();
