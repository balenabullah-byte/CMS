import { api } from './api'
export const assetStatuses = ['operational', 'under_maintenance', 'out_of_service', 'retired']
export const assetDates = ['purchase_date', 'installation_date', 'warranty_expires_at']
export const dateLabels = {
  purchase_date: 'Purchase date',
  installation_date: 'Installation date',
  warranty_expires_at: 'Warranty expiry',
}
export async function assetOptions(path, params = {}, signal) {
  const rows = []
  for (let offset = 0; ; offset += 100) {
    const result = await api(path + '?' + new URLSearchParams({ ...params, limit: 100, offset }), {
      signal,
    })
    rows.push(...result.rows)
    if (rows.length >= result.total || result.rows.length < 100) return rows
  }
}
