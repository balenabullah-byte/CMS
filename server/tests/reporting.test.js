import test from 'node:test';
import assert from 'node:assert/strict';
import {csv} from '../controller/reporting.controller.js';
import schemas from '../validation/assignment.validation.js';
import {workPage} from '../validation/reporting.validation.js';
test('CSV fields quote, preserve delimiters and neutralize spreadsheet expressions',()=>{
  assert.equal(csv([{title:'=1+2',note:'quoted "text", with\nnewline',labor:0}]),'"title","note","labor"\r\n"\'=1+2","quoted ""text"", with\nnewline","0"');
  assert.throws(()=>csv([]),{apiStatus:404});
  assert.throws(()=>csv(Array(5001).fill({id:1})),{apiStatus:422});
});
test('structured completion distinguishes unknown and validates actual labor',()=>{
  const body=schemas.complete.body;
  const base={completion_note:'Repaired',root_cause:'unknown'};
  assert.equal(body.validate(base).error,undefined);
  assert.equal(body.validate({...base,labor_minutes:0}).error,undefined);
  for(const change of [{root_cause:'other'},{root_cause:'invalid'},{labor_minutes:-1},{labor_minutes:0.5},{completed_at:'2020-01-01'}])
    assert.ok(body.validate({...base,...change}).error);
  assert.equal(body.validate({...base,root_cause:'other',root_cause_details:'Documented cause'}).error,undefined);
});
test('reporting dates accept leap days and reject inverted ranges and unsafe sorting',()=>{
  assert.equal(workPage.validate({from:'2024-02-29',to:'2024-02-29'}).error,undefined);
  for(const q of [{from:'2025-02-29'},{from:'2026-01-02',to:'2026-01-01'},{labor_min:4,labor_max:2},{sort:'unknown'},{limit:5001}])
    assert.ok(workPage.validate(q).error);
});
