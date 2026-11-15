#!/usr/bin/env node
/* tools/test.js — اختبارات آلية للمحرك والبيانات
   node tools/test.js [عدد_الجولات] [random|greedy|both]        */
"use strict";
const fs = require("fs"), path = require("path");
const SY = require(path.join(__dirname, "..", "src", "engine.js"));
const ROOT = path.join(__dirname, "..");

function loadData() {
  const dir = path.join(ROOT, "src", "data");
  const out = { events: [], endings: [], news: [] };
  fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().forEach(f => {
    const o = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    out.events = out.events.concat(o.events || []);
    out.endings = out.endings.concat(o.endings || []);
    out.news = out.news.concat(o.news || []);
  });
  out.byId = {}; out.events.forEach(e => out.byId[e.id] = e);
  return out;
}

/* ---------- 1) فحوص بنيوية ---------- */
function structural(data) {
  const problems = [];
  const ids = new Set();
  data.events.forEach(e => {
    if (ids.has(e.id)) problems.push("مكرر: " + e.id);
    ids.add(e.id);
    if (typeof e.month !== "number" || e.month < 0 || e.month > 36) problems.push(e.id + ": month خاطئ");
    if (!e.options || e.options.length < 2) problems.push(e.id + ": خيارات قليلة");
    (e.options || []).forEach(o => {
      (o.unlocks || []).forEach(u => { if (!data.byId[u]) problems.push(e.id + ": يفتح " + u + " غير الموجود"); });
      (o.delay || []).forEach(d => { if (!d.in) problems.push(e.id + ": delay بلا in"); });
    });
  });
  // تغطية الأشهر: كم حدثاً متاحاً لكل شهر (تقريبي: أحداث شهرها <= m)
  const cover = [];
  for (let m = 0; m < 37; m++) {
    const n = data.events.filter(e => !e.shock && e.month <= m && (!e.ttl || m <= e.month + e.ttl)).length;
    cover.push(n);
  }
  const shockCount = data.events.filter(e => e.shock).length;
  return { problems, cover, shockCount };
}

/* ---------- 2) جولات آلية ---------- */
function run(data, mode, seed) {
  let S = SY.initialState(seed);
  S.difficulty = 1.0;
  S.doctrine = { id: "x", t: "-", bonusCat: "" };
  S.cabinet = [];
  const errs = [];
  try {
    SY.autoRun(S, data, mode);
  } catch (e) { errs.push("استثناء: " + e.message); }
  // فحص القيم
  ["st", "res", "rel", "pop", "thr"].forEach(g => {
    Object.keys(S[g]).forEach(k => {
      const v = S[g][k];
      if (typeof v !== "number" || isNaN(v) || !isFinite(v)) errs.push(g + "." + k + "=" + v);
    });
  });
  const sc = SY.score(S);
  if (isNaN(sc.final)) errs.push("score NaN");
  return {
    mode, seed, month: S.month, log: S.log.length, over: S.over ? S.over.id : (SY.ending(S, data.endings).end || {}).id || "none",
    score: sc.final, avg: sc.avg, st: S.st, res: S.res, errs
  };
}

function main() {
  const N = parseInt(process.argv[2] || "300", 10);
  const mode = process.argv[3] || "both";
  if (!Number.isInteger(N) || N < 1 || !["random", "greedy", "both"].includes(mode)) { console.error("عدد الجولات أو الوضع غير صالح"); process.exitCode = 1; return; }
  const data = loadData();
  console.log("الأحداث: " + data.events.length + " | نهايات: " + data.endings.length + " | أخبار: " + data.news.length);
  const s = structural(data);
  if (s.problems.length) process.exitCode = 1;
  if (s.problems.length) { console.log("\n⚠ مشاكل بنيوية (" + s.problems.length + "):"); s.problems.slice(0, 40).forEach(p => console.log("   - " + p)); }
  else console.log("✓ الفحص البنيوي سليم");
  console.log("تغطية الأحداث لكل شهر (تراكمي نافذة): " + s.cover.join(","));

  const modes = mode === "both" ? ["random", "greedy"] : [mode];
  modes.forEach(mo => {
    const rs = [];
    for (let i = 0; i < N; i++) rs.push(run(data, mo, i * 7919 + 13));
    const bad = rs.filter(r => r.errs.length);
    if (bad.length) process.exitCode = 1;
    const months = rs.map(r => r.month);
    const scores = rs.map(r => r.score);
    const ends = {};
    rs.forEach(r => ends[r.over] = (ends[r.over] || 0) + 1);
    const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
    const mn = k => Math.min(...rs.map(r => r.st[k])), mx = k => Math.max(...rs.map(r => r.st[k]));
    console.log("\n=== وضع " + mo + " (" + N + " جولة) ===");
    console.log("أخطاء: " + bad.length + (bad.length ? " -> " + bad[0].errs.slice(0, 3).join("; ") : ""));
    console.log("متوسط الأشهر المكتملة: " + avg(months) + "  |  متوسط النتيجة: " + avg(scores) + "  |  أعلى: " + Math.max(...scores) + "  أدنى: " + Math.min(...scores));
    console.log("مدى المؤشرات: leg " + mn("leg") + "-" + mx("leg") + " | coh " + mn("coh") + "-" + mx("coh") +
      " | eco " + mn("eco") + "-" + mx("eco") + " | mil " + mn("mil") + "-" + mx("mil") +
      " | sov " + mn("sov") + "-" + mx("sov") + " | press " + mn("press") + "-" + mx("press") + " | frag " + mn("frag") + "-" + mx("frag"));
    console.log("النهايات: " + Object.entries(ends).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ":" + v).join("  "));
    const stuck = rs.filter(r => r.month < 12);
    console.log("جولات لم تتجاوز السنة الأولى: " + stuck.length + " (" + (100 * stuck.length / N).toFixed(0) + "%)");
  });
}
main();
