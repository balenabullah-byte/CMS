import { randomBytes } from 'node:crypto';
import db from '../connection.js';
import audit from './audit.module.js';
import { fail } from '../middleware/error.middleware.js';

const tables = { asset: 'assets', room: 'rooms', building: 'buildings' };
function target(row) {
  const type = Object.keys(tables).find(key => row[key + '_id'] != null);
  return {type, id: row[type + '_id']};
}
class QrModule {
  async resource(trx, type, id) {
    const row = await trx(tables[type]).where({id}).forUpdate().first();
    if (!row || row.operational_status === 'retired') fail(409,'Resource unavailable for reporting.');
    const roomId = type === 'room' ? id : row.room_id;
    const buildingId = type === 'building' ? id : row.building_id;
    const building = await trx('buildings').where({id:buildingId,is_active:1}).forUpdate().first();
    const room = roomId && await trx('rooms').where({id:roomId,building_id:buildingId,is_active:1}).forUpdate().first();
    if (!building || (roomId && !room)) fail(409,'Location unavailable for reporting.');
    return {type,id,name:row.name || row.room_code,identifier:row.asset_code || row.code || row.room_code,
      building_id:buildingId,room_id:roomId || null,building:building.name,room:room?.room_code};
  }
  async generate(trx, actor, type, id, previous) {
    const resource = await this.resource(trx,type,id);
    const field = type+'_id';
    const active = await trx('qr_codes').where({[field]:id}).whereNull('revoked_at').forUpdate().first();
    if (previous && active?.id !== previous) fail(409,'Label changed. Refresh before replacing it.');
    if (active && !previous) return {...active,resource};
    if (active) await this.revoke(trx,actor,active.id);
    const token = randomBytes(32).toString('base64url');
    const [key] = await trx('qr_codes').insert({token,[field]:id,created_by_id:actor});
    await audit.record(trx,actor,previous?'qr_replaced':'qr_created','qr_code',key,null,{[field]:id,previous_id:previous});
    return {id:key,token,resource};
  }
  async revoke(trx,actor,id) {
    const row = await trx('qr_codes').where({id}).forUpdate().first();
    if (!row) fail(404,'Unknown label.');
    if (!row.revoked_at) {
      await trx('qr_codes').where({id}).update({revoked_by_id:actor,revoked_at:trx.fn.now()});
      await audit.record(trx,actor,'qr_revoked','qr_code',id,row,null);
    }
    return {id};
  }
  async resolve(trx,token) {
    const row = await trx('qr_codes').where({token}).first();
    if (!row || row.revoked_at) fail(404,'This label is unavailable.');
    const {type,id} = target(row);
    const resource = await this.resource(trx,type,id);
    const current = await trx('qr_codes').where({id:row.id}).forUpdate().first();
    if (current.revoked_at) fail(404,'This label is unavailable.');
    return {qr_code_id:row.id,...resource};
  }
  async submission(trx,fields) {
    const {qr_token,...report} = fields;
    if (!qr_token) return {...report,reporting_source:'manual'};
    const r = await this.resolve(trx,qr_token);
    if (r.building_id !== report.building_id || (r.type !== 'building' && r.room_id !== (report.room_id || null)) ||
        (r.type === 'asset' && r.id !== report.asset_id)) fail(409,'Resource changed. Review its current location and submit again.');
    if (report.room_id) {
      const room = await trx('rooms').where({id:report.room_id,building_id:r.building_id,is_active:1}).forUpdate().first();
      if (!room) fail(409,'Choose an active room in this building.');
    }
    return {...report,qr_code_id:r.qr_code_id,reporting_source:'qr'};
  }
  history(type,id) {
    return db('qr_codes').where({[type+'_id']:id}).orderBy('id','desc')
      .select('id','created_at','created_by_id','revoked_at','revoked_by_id');
  }
  async analytics() {
    const [codes,sources,buildings,assets] = await Promise.all([
      db('qr_codes').select(db.raw("CASE WHEN asset_id IS NOT NULL THEN 'asset' WHEN room_id IS NOT NULL THEN 'room' ELSE 'building' END AS type, revoked_at IS NULL AS active")).count('* as total').groupBy('type','active'),
      db('maintenance_requests').select('reporting_source').countDistinct('id as total').groupBy('reporting_source'),
      db('maintenance_requests as m').join('buildings as b','b.id','m.building_id').where('reporting_source','qr').groupBy('b.id','b.name').select('b.name').countDistinct('m.id as total'),
      db('maintenance_requests as m').join('assets as a','a.id','m.asset_id').where('reporting_source','qr').groupBy('a.id','a.asset_code','a.name').select('a.asset_code','a.name').countDistinct('m.id as total').orderBy('total','desc').limit(20)
    ]);
    return {codes,sources,buildings,assets};
  }
}
export default new QrModule();
