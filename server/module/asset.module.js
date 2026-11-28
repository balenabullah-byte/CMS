import { randomUUID } from 'node:crypto';
import db from '../connection.js';
import audit from './audit.module.js';
import verification from './verification.module.js';
import { fail } from '../middleware/error.middleware.js';
import { found } from '../controller/common.js';

const optionalDates = ['purchase_date', 'installation_date', 'warranty_expires_at'];
async function paginate(query, f, sort, direction = 'asc', tie) {
  const count = query.clone().clearSelect().count({ total: '*' }).first();
  query.orderBy(sort, direction);
  if (tie && sort !== tie) query.orderBy(tie);
  const [n, rows] = await Promise.all([count, query.limit(f.limit).offset(f.offset)]);
  return { rows, total: Number(n.total) };
}

class AssetModule {
  categories(f) {
    const q = db('asset_categories');
    if (f.active !== undefined) q.where({ is_active: f.active });
    if (f.search)
      q.where(function () {
        this.whereLike('code', '%' + f.search + '%').orWhereLike('name', '%' + f.search + '%');
      });
    return paginate(q, f, 'name', 'asc', 'id');
  }
  async saveCategory(trx, actor, id, fields) {
    const table = 'asset_categories';
    const old = id ? found(await trx(table).where({ id }).forUpdate().first()) : null;
    if (old) await trx(table).where({ id }).update(fields);
    else [id] = await trx(table).insert(fields);
    const row = await trx(table).where({ id }).first();
    await audit.record(
      trx,
      actor,
      old ? 'asset_category_edited' : 'asset_category_created',
      'asset_category',
      id,
      old,
      row
    );
    return row;
  }
  base(trx = db) {
    return trx('assets as e')
      .join('asset_categories as c', 'c.id', 'e.asset_category_id')
      .join('buildings as b', 'b.id', 'e.building_id')
      .leftJoin('rooms as rm', 'rm.id', 'e.room_id');
  }
  directory(f) {
    const q = this.base().select(
      'e.id',
      'e.asset_code',
      'e.name',
      'e.operational_status',
      'c.name as category',
      'b.name as building',
      'rm.room_code'
    );
    for (const k of ['asset_category_id', 'building_id', 'room_id', 'operational_status'])
      if (f[k]) q.where('e.' + k, f[k]);
    if (f.search)
      q.where(function () {
        for (const col of ['e.asset_code', 'e.name', 'e.serial_number'])
          this.orWhere(col, 'like', '%' + f.search + '%');
      });
    const sorts = {
      asset_code: 'e.id',
      name: 'e.name',
      building: 'b.name',
      category: 'c.name',
      operational_status: 'e.operational_status',
    };
    return paginate(q, f, sorts[f.sort || 'asset_code'], f.direction, 'e.id');
  }
  lookup(f) {
    const q = this.base()
      .select('e.id', 'e.asset_code', 'e.name')
      .where('b.is_active', true)
      .where({ 'e.building_id': f.building_id, 'e.room_id': f.room_id })
      .whereNot('e.operational_status', 'retired');
    if (f.room_id) q.where('rm.is_active', true);
    if (f.search)
      q.where(function () {
        this.where('e.name', 'like', '%' + f.search + '%').orWhere(
          'e.asset_code',
          'like',
          '%' + f.search + '%'
        );
      });
    return paginate(q, f, 'e.name', 'asc', 'e.id');
  }
  detail(id, trx = db) {
    const q = this.base(trx).select('e.*', 'b.name as building', 'rm.room_code', 'c.name as category');
    for (const key of optionalDates)
      q.select(trx.raw("DATE_FORMAT(??,'%Y-%m-%d') AS ??", ['e.' + key, key]));
    return q.where('e.id', id).first();
  }
  async validateLocation(trx, fields) {
    if (
      !(await trx('buildings').where({ id: fields.building_id, is_active: true }).forShare().first('id'))
    )
      fail(409, 'Select an active building.');
    if (
      fields.room_id &&
      !(await trx('rooms')
        .where({ id: fields.room_id, building_id: fields.building_id, is_active: true })
        .forShare()
        .first('id'))
    )
      fail(409, 'Select an active room in this building.');
  }
  async validateCategory(trx, id) {
    if (!(await trx('asset_categories').where({ id, is_active: true }).forShare().first('id')))
      fail(409, 'Select an active asset category.');
  }
  async validateReport(trx, fields) {
    const asset = found(await trx('assets').where({ id: fields.asset_id }).forUpdate().first());
    if (asset.operational_status === 'retired')
      fail(409, 'Retired equipment cannot receive new reports.');
    if (asset.building_id !== fields.building_id || asset.room_id !== (fields.room_id ?? null))
      fail(409, 'Equipment is outside the selected location.');
    await this.validateLocation(trx, fields);
  }
  async create(trx, actor, fields) {
    await this.validateCategory(trx, fields.asset_category_id);
    await this.validateLocation(trx, fields);
    // The provisional unique key is replaced before the registration transaction commits.
    const [id] = await trx('assets').insert({
      ...fields,
      asset_code: randomUUID(),
      created_by_id: actor,
    });
    await trx('assets')
      .where({ id })
      .update({ asset_code: 'AST-' + String(id).padStart(6, '0') });
    const row = await this.detail(id, trx);
    await audit.record(trx, actor, 'asset_registered', 'asset', id, null, row);
    return row;
  }
  async change(trx, actor, id, action, fields) {
    const old = found(await trx('assets').where({ id }).forUpdate().first());
    if (old.operational_status === 'retired') fail(409, 'This asset is retired.');
    let changes = fields;
    if (fields.asset_category_id && fields.asset_category_id !== old.asset_category_id)
      await this.validateCategory(trx, fields.asset_category_id);
    if (action === 'transferred' || action === 'retired') {
      const open = await trx('maintenance_requests')
        .where({ asset_id: id })
        .whereNotIn('status', ['closed', 'rejected'])
        .first('id');
      if (open) fail(409, 'Resolve open maintenance requests first.');
    }
    if (action === 'transferred') {
      await this.validateLocation(trx, fields);
      if (fields.building_id === old.building_id && fields.room_id === old.room_id)
        fail(409, 'Choose a different location.');
      changes = { building_id: fields.building_id, room_id: fields.room_id };
      await trx('asset_location_history').insert({
        asset_id: id,
        actor_id: actor,
        previous_building_id: old.building_id,
        previous_room_id: old.room_id,
        new_building_id: fields.building_id,
        new_room_id: fields.room_id,
        reason: fields.reason,
      });
    }
    if (action === 'retired')
      changes = {
        operational_status: 'retired',
        retired_at: trx.fn.now(),
        retired_by_id: actor,
        retirement_reason: fields.reason,
      };
    await trx('assets').where({ id }).update(changes);
    const row = await this.detail(id, trx);
    await audit.record(trx, actor, 'asset_' + action, 'asset', id, old, row);
    return row;
  }
  locations(id, f) {
    const q = db('asset_location_history as h')
      .join('users as u', 'u.id', 'h.actor_id')
      .join('buildings as b', 'b.id', 'h.previous_building_id')
      .join('buildings as dest', 'dest.id', 'h.new_building_id')
      .leftJoin('rooms as rm', 'rm.id', 'h.previous_room_id')
      .leftJoin('rooms as room', 'room.id', 'h.new_room_id')
      .where('h.asset_id', id)
      .select(
        'h.*',
        'u.full_name as actor',
        'b.name as previous_building',
        'dest.name as new_building',
        'rm.room_code as previous_room',
        'room.room_code as new_room'
      );
    return paginate(q, f, 'h.id', 'desc');
  }
  history(id, f, trx = db, priorToAssignment = null) {
    const q = trx('maintenance_requests as r')
      .leftJoin('work_assignments as a', 'a.request_id', 'r.id')
      .leftJoin('users as t', 't.id', 'a.technician_id')
      .join('buildings as b', 'b.id', 'r.building_id')
      .leftJoin('rooms as rm', 'rm.id', 'r.room_id')
      .where('r.asset_id', id)
      .select(
        'r.id as request_id',
        'r.title',
        'r.created_at as reported_at',
        'b.name as reported_building',
        'rm.room_code as reported_room',
        'a.id as assignment_id',
        'a.end_reason',
        'a.completed_at',
        'a.root_cause',
        'a.root_cause_details',
        'a.materials_used',
        'a.completion_note',
        'a.labor_minutes',
        't.full_name as technician',
        'ev.decision',
        'ev.decision_at'
      );
    verification.join(q);
    if (priorToAssignment)
      q.where('a.id', '<', priorToAssignment.id)
        .where('a.end_reason', 'completed')
        .where('a.completed_at', '<=', priorToAssignment.assigned_at);
    else
      q.select(
        'r.status',
        trx.raw(
          "EXISTS(SELECT 1 FROM request_history h WHERE h.request_id=r.id AND h.new_status='reopened') AS was_reopened"
        )
      );
    return paginate(q, f, 'r.id', 'desc', 'a.id');
  }
}
export default new AssetModule();
