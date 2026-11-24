const validStatus = value => Number.isInteger(value) && value >= 100 && value <= 599;

export function summarize(report) {
  if (!Array.isArray(report)) throw new Error('Choose a JSON array produced by the API test runner.');
  const rows = report.map((row, index) => {
    if (typeof row?.name !== 'string' || !row.name.trim()) throw new Error('Missing test name in row ' + (index + 1));
    if (row.note && row.expected == null && row.status == null && row.pass == null && !row.detail) {
      return { ...row, result: 'NOTE' };
    }
    if (!validStatus(row.expected) || !(validStatus(row.status) || row.status === 0) ||
        (row.pass !== undefined && typeof row.pass !== 'boolean')) {
      throw new Error('Invalid test result in row ' + (index + 1));
    }
    const passed = row.expected === row.status && row.pass !== false && !row.detail;
    return { ...row, result: passed ? 'PASS' : 'FAIL' };
  });
  const passed = rows.filter(row => row.result === 'PASS').length;
  const failed = rows.filter(row => row.result === 'FAIL').length;
  const total = passed + failed;
  return { rows, passed, failed, total, notes: rows.length - total, rate: total ? (100 * passed / total).toFixed(1) + '%' : '—' };
}
