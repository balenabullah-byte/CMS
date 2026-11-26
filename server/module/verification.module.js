import db from '../connection.js';

// History IDs order transitions even when several events share a timestamp.
class VerificationModule {
  events() {
    const event = db('request_history').select('request_id','event_type','note',
      db.raw('LEAD(new_status) OVER w AS completion_state, LEAD(new_status,2) OVER w AS decision, LEAD(created_at,2) OVER w AS decision_at, LEAD(actor_id,2) OVER w AS decision_by'))
      .modify(q => q.whereIn('event_type',['assignment_ended','status_changed']));
    // Knex does not expose named WINDOW definitions in this version.
    return db.raw('( '+event.toQuery()+' WINDOW w AS (PARTITION BY request_id ORDER BY id) ) as ev');
  }
  join(query) {
    return query.leftJoin(this.events(), function(){
      this.on('ev.request_id','=','a.request_id').andOnVal('ev.event_type','=','assignment_ended')
        .andOnVal('ev.completion_state','=','completed')
        .andOn(db.raw("ev.note=CONCAT('Assignment #',a.id,' ended: completed')"));
    });
  }
}
export default new VerificationModule();
