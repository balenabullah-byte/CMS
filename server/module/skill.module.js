import knex from '../connection.js';
class SkillModule {
  async list(page) { return knex('technician_skills').orderBy(['technician_id','category_id']).limit(page.limit).offset(page.offset); }
  async add(data) { await knex('technician_skills').insert(data); return data; }
  async remove(data) { return knex('technician_skills').where(data).del(); }
}
export default new SkillModule();
