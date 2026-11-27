import knex from '../connection.js';
class SkillModule {
  async roster(user,f) {
    const q=knex('users as u').join('user_roles as ur','ur.user_id','u.id').join('roles as r','r.id','ur.role_id').where('r.code','technician');
    if(!user.roles.some(role=>['admin','coordinator'].includes(role))) q.where('u.id',user.id);
    if(f.search) q.where('u.full_name','like','%'+f.search+'%');
    if(f.active!==undefined) q.where('u.is_active',f.active);
    if(f.category_id) q.whereIn('u.id',knex('technician_skills').where({category_id:f.category_id}).select('technician_id'));
    const {total}=await q.clone().count({total:'*'}).first();
    const rows=await q.select('u.id','u.full_name','u.is_active',
      knex.raw('(SELECT COUNT(*) FROM work_assignments a WHERE a.technician_id=u.id AND a.ended_at IS NULL) AS workload'),
      knex.raw("(SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM technician_skills s JOIN maintenance_categories c ON c.id=s.category_id WHERE s.technician_id=u.id) AS skills"))
      .orderBy('u.full_name').orderBy('u.id').limit(f.limit).offset(f.offset);
    return {rows,total:Number(total)};
  }
  async list(page) { return knex('technician_skills').orderBy(['technician_id','category_id']).limit(page.limit).offset(page.offset); }
  async add(data,db=knex) { await db('technician_skills').insert(data); return data; }
  async remove(data,db=knex) { return db('technician_skills').where(data).del(); }
}
export default new SkillModule();
