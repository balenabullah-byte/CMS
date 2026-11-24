import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../../src/test-results.js';

test('dashboard counts expected conflicts, assertion failures, network failures and information', () => {
  const row = { name: 'Reopen', expected: 409, status: 409 };
  const report = summarize([row, { ...row, status: 500, pass: true, note: 'conflict expected' },
    { ...row, pass: false }, { ...row, status: 0 }, { name: 'Scenario', note: 'Coordinator review' }]);
  assert.deepEqual(report.rows.map(r => r.result), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'NOTE']);
  assert.deepEqual([report.total, report.passed, report.failed, report.notes, report.rate], [4, 1, 3, 1, '25.0%']);
});
test('empty results have no pass rate and malformed reports are rejected', () => {
  assert.equal(summarize([]).rate, '—');
  for (const value of [null, {}, [null], [{ name: 'Broken', status: '200', expected: 200 }]]) {
    assert.throws(() => summarize(value));
  }
});
