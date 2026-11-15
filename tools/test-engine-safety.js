"use strict";
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const SY = require('../src/engine.js');
let failures = 0;
function test(name, fn) { try { fn(); console.log('✓ ' + name); } catch (e) { failures++; console.error('✗ ' + name + ': ' + e.message); } }
function event(id, extra) { return Object.assign({id, month:100, title:id, options:[{t:'x'}]}, extra); }
function data(events) { return {events, byId:Object.fromEntries(events.map(e => [e.id, e]))}; }
test('preview is pure and matches post-cost and decree roll', () => {
  const s = SY.initialState(12); s.res.cash = 1; s.res.cap = 2; s.st.frag = 74;
  const opt = {cost:{cash:-4, cap:-12}, prob:{base:70, mods:{cash:2, cap:0.1, frag:-0.1, dem:0.2}}, cat:'أمني'};
  const before = JSON.stringify(s), rng = SY.rngSnapshot(s);
  assert.strictEqual(typeof SY.previewChance, 'function');
  const p = SY.previewChance(s, opt);
  assert.strictEqual(JSON.stringify(s), before); assert.strictEqual(SY.rngSnapshot(s), rng);
  const result = SY.resolve(s, event('e'), opt);
  assert.strictEqual(p, result.roll.p); assert.strictEqual(result.decree, 10);
  assert.strictEqual(SY.previewChance(s, {}), null);
});
test('queued selection consumes only selected; conditional event defers', () => {
  const a = event('a', {when:{flagAll:['ready']}}), b = event('b'), c = event('c');
  const s = SY.initialState(1); s.rng = () => 0.99;
  s.queue = [{id:'a',at:0},{id:'b',at:0},{id:'c',at:0},{id:'missing',at:0},{id:'used',at:0}];
  const used = event('used'); s.used.used = 1;
  assert.strictEqual(SY.pickEvent(s, data([a,b,c,used])).id, 'b');
  assert.deepStrictEqual(s.queue.map(q => q.id), ['a','c']);
  s.used.b = 1; s.flags.ready = 1;
  assert.strictEqual(SY.pickEvent(s, data([a,b,c,used])).id, 'a');
  assert.deepStrictEqual(s.queue.map(q => q.id), ['c']);
});
test('shock override keeps queued event for later', () => {
  const q = event('q'), shock = event('shock', {month:0, shock:true});
  const s = SY.initialState(1); let draws = [0, 0]; s.rng = () => draws.shift();
  s.queue = [{id:'q',at:0}];
  assert.strictEqual(SY.pickEvent(s, data([q,shock])).id, 'shock');
  assert.deepStrictEqual(s.queue.map(x => x.id), ['q']);
  s.used.shock = 1; s.rng = () => 0.99;
  assert.strictEqual(SY.pickEvent(s, data([q,shock])).id, 'q');
  assert.strictEqual(s.queue.length, 0);
});
test('empty terminal month checks collapse without advance', () => {
  const s = SY.initialState(1); s.month = 36; s.st.leg = 11.9;
  SY.autoRun(s, data([]), 'greedy');
  assert.strictEqual(s.over && s.over.id, 'X_legitimacy'); assert.strictEqual(s.month, 36);
});
test('calibration sets doctrine flag as UI does', () => {
  const file = path.join(__dirname, 'calib.js');
  const source = fs.readFileSync(file, 'utf8').split('const ng = Number(process.argv')[0] + '\nresult = playOne(1, "greedy", "normal", "sharia", "shaykh");';
  const sandbox = {require, __dirname, console, result:null}; vm.runInNewContext(source, sandbox, {filename:file});
  assert.strictEqual(sandbox.result.S.flags.doc_sharia, 1);
});
if (failures) process.exitCode = 1;
