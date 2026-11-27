import knex from '../connection.js';
class RecommendationModule {
  async list(request,f){
    const candidates=knex('users as u').join('user_roles as ur','ur.user_id','u.id').join('roles as r','r.id','ur.role_id')
      .where({'r.code':'technician','u.is_active':true}).select('u.id','u.full_name',
        knex.raw('EXISTS(SELECT 1 FROM technician_skills s WHERE s.technician_id=u.id AND s.category_id=?) AS matching',[request.category_id]),
        knex.raw('(SELECT COUNT(*) FROM work_assignments a WHERE a.technician_id=u.id AND a.ended_at IS NULL) AS workload'),
        knex.raw("(SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM technician_skills s JOIN maintenance_categories c ON c.id=s.category_id WHERE s.technician_id=u.id) AS skills"));
    const q=knex.from(candidates.as('c'));
    if(f.search) q.where('full_name','like','%'+f.search+'%');
    if(f.matching) q.where({matching:1});
    if(f.sort!=='workload') q.orderBy('matching','desc');
    return q.orderBy('workload').orderBy('id').limit(f.limit).offset(f.offset);
  }
}
export default new RecommendationModule();
