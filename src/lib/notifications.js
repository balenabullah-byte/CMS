import {portals} from './workspace'
const descriptions={
 submitted:'A new report is waiting for coordinator review.',approved:'The request was approved for assignment.',
 rejected:'The report was declined. Open it to read the public decision.',assigned:'A technician has been assigned.',
 reassigned:'The work was reassigned. Your assignment record is available.',
 in_progress:'Maintenance work has started.',completed:'The repair is ready for coordinator verification.',
 closed:'The coordinator verified and closed the repair.',reopened:'The request was reopened for additional work.',
 public_comment:'A participant added a public comment.',internal_update:'Maintenance staff posted an internal update.',
 response_approaching:'The target for starting work is approaching.',resolution_approaching:'The verification target is approaching.',
 response_missed:'Work has not started by its target.',resolution_missed:'The verification target has passed.',
 admin_access_granted:'Administrator access was granted. Review the administrative audit.'
}
export function description(event){return descriptions[event]||'Open the record for details.'}
export function destination(n){
 const path=n.portal==='admin'?'/audit-logs':n.assignment_id?'/assignments/'+n.assignment_id:'/requests/'+n.request_id
 return '/'+portals[n.portal]+path
}
