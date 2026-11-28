import db from '../connection.js';
import { period } from './report-filters.js';

class AssetAnalytics {
  async report(f) {
    const assets = db('assets as e');
    const reports = period(
      db('maintenance_requests as r').whereNotNull('r.asset_id'),
      'r.created_at',
      f
    );
    const repairs = period(
      db('work_assignments as a')
        .join('maintenance_requests as r', 'r.id', 'a.request_id')
        .whereNotNull('r.asset_id')
        .where('a.end_reason', 'completed'),
      'a.completed_at',
      f
    );
    const grouped = (q, col) =>
      q
        .select(col + ' as label')
        .count({ value: '*' })
        .groupBy(col)
        .orderBy('value', 'desc')
        .orderBy('label');
    const [
      total,
      registered,
      unresolved,
      retired,
      work,
      categories,
      buildings,
      rooms,
      statuses,
      frequent,
      causes,
      warranty,
    ] = await Promise.all([
      assets.clone().count({ n: '*' }).first(),
      period(assets.clone(), 'e.created_at', f).count({ n: '*' }).first(),
      db('maintenance_requests')
        .whereNotIn('status', ['rejected', 'closed'])
        .countDistinct({ n: 'asset_id' })
        .first(),
      assets.clone().where('operational_status', 'retired').count({ n: '*' }).first(),
      repairs
        .clone()
        .count({ jobs: '*' })
        .count({ samples: 'a.labor_minutes' })
        .sum({ labor: 'a.labor_minutes' })
        .first(),
      grouped(assets.clone().join('asset_categories as c', 'c.id', 'e.asset_category_id'), 'c.code'),
      grouped(assets.clone().join('buildings as b', 'b.id', 'e.building_id'), 'b.code'),
      assets
        .clone()
        .join('buildings as b', 'b.id', 'e.building_id')
        .leftJoin('rooms as rm', 'rm.id', 'e.room_id')
        .select(db.raw("CONCAT(b.code,' / ',COALESCE(rm.room_code,'Building only')) AS label"))
        .count({ value: '*' })
        .groupBy('label')
        .orderBy('label'),
      grouped(assets.clone(), 'e.operational_status'),
      reports
        .clone()
        .join('assets as e', 'e.id', 'r.asset_id')
        .select(db.raw("CONCAT(e.asset_code,' · ',e.name) AS label"))
        .count({ value: '*' })
        .groupBy('e.id', 'e.asset_code', 'e.name')
        .orderBy('value', 'desc')
        .orderBy('e.id')
        .limit(10),
      repairs
        .clone()
        .select(db.raw("COALESCE(a.root_cause,'not_recorded') AS label"))
        .count({ value: '*' })
        .groupBy('label')
        .orderBy('value', 'desc'),
      assets
        .clone()
        .select(
          db.raw(
            "CASE WHEN warranty_expires_at IS NULL THEN 'Not recorded' WHEN warranty_expires_at<CURDATE() THEN 'Expired' WHEN warranty_expires_at<=DATE_ADD(CURDATE(),INTERVAL 30 DAY) THEN 'Expires within 30 days' ELSE 'More than 30 days remaining' END AS label"
          )
        )
        .count({ value: '*' })
        .groupBy('label')
        .orderBy('label'),
    ]);
    return {
      metrics: [
        { label: 'Registered assets', value: Number(total.n) },
        { label: 'Registered in period', value: Number(registered.n) },
        { label: 'Assets with open requests', value: Number(unresolved.n) },
        { label: 'Retired assets', value: Number(retired.n) },
        { label: 'Repairs completed in period', value: Number(work.jobs) },
        {
          label: 'Recorded labor in period',
          value: work.labor == null ? null : Number(work.labor),
          unit: 'min',
          samples: Number(work.samples),
        },
      ],
      series: [
        ['Assets by category', categories],
        ['Assets by building', buildings],
        ['Assets by room', rooms],
        ['Operational status', statuses],
        ['Most reported in period', frequent],
        ['Repair causes in period', causes],
        ['Warranty expiration', warranty],
      ].map(([title, rows]) => ({ title, rows: rows.map((r) => ({ ...r, value: Number(r.value) })) })),
    };
  }
}
export default new AssetAnalytics();
