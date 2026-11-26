export const causes = Object.freeze({
  equipment_failure: 'Equipment failure', wear_and_tear: 'Normal wear and tear',
  electrical_failure: 'Electrical failure', installation_fault: 'Installation fault',
  improper_usage: 'Improper usage', environmental: 'Environmental factors',
  insufficient_maintenance: 'Insufficient preventive maintenance', unknown: 'Unknown cause', other: 'Other cause',
})
export const maxLaborMinutes = 30 * 24 * 60
export const requestStates = ['submitted','approved','assigned','in_progress','completed','closed','reopened','rejected']
export function nextDay(day) {
  const date = new Date(day + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0,10)
}
