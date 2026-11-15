"use strict";
const assert = require('assert');
const SY = require('../src/engine.js');
const failures = [];
function test(name, fn) { try { fn(); console.log('✓ ' + name); } catch (e) { failures.push(name); console.error('✗ ' + name + ': ' + e.message); } }
test('RNG snapshot resumes the exact sequence', () => {
  const s = SY.initialState(42); s.rng(); s.rng();
  const snapshot = SY.rngSnapshot(s); const expected = [s.rng(), s.rng()];
  const restored = SY.initialState(1); SY.rngRestore(restored, snapshot);
  assert.deepStrictEqual([restored.rng(), restored.rng()], expected);
});
test('autoRun plays month 36', () => {
  const events = Array.from({length:37}, (_, month) => ({id:'e'+month, month, ttl:1, title:'e', options:[{t:'x',eff:{leg:10,sec:10,eco:10,coh:10,mil:10,frag:-10,cash:2}}]}));
  const data = {events, byId:Object.fromEntries(events.map(e => [e.id,e]))};
  const s = SY.initialState(5); SY.autoRun(s, data, 'greedy');
  assert.strictEqual(s.log.length, 37); assert.strictEqual(s.log[36].dateIdx, 36);
});
test('stopAt zero processes no months', () => {
  const s = SY.initialState(1); SY.autoRun(s, {events:[], byId:{}}, 'greedy', 0);
  assert.strictEqual(s.month, 0);
});
test('last decision triggers real collapse without advancing', () => {
  const s = SY.initialState(1); s.month = 36; s.st.leg = 12.1;
  const ev = {id:'last', month:36, title:'last', options:[{t:'x', eff:{leg:-10}}]};
  SY.autoRun(s, {events:[ev], byId:{last:ev}}, 'greedy');
  assert.strictEqual(s.over && s.over.id, 'X_legitimacy'); assert.strictEqual(s.month, 36);
});
if (failures.length) process.exitCode = 1;
