#!/usr/bin/env node
/* tools/track.js — قياس مسار «تحكيم الشريعة» داخل المحاكاة
   node tools/track.js [N] [greedy|random|both]                      */
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
  out.byId = {}; out.events.forEach(e => { out.byId[e.id] = e; });
  return out;
}

const data = loadData();
const trackIds = new Set(data.events.filter(e => /^(S\d|XS)/.test(e.id)).map(e => e.id));
const byTitle = {};
data.events.forEach(e => { byTitle[e.title] = e.id; });
const N = parseInt(process.argv[2] || "300", 10);
const modes = (process.argv[3] || "both").split(",");

function run(mode) {
  let sum = { months: 0, score: 0, shrEnd: 0, shrMin: 0, track: 0, low: 0, high: 0 };
  const ends = {}; const shrHist = new Array(10).fill(0);
  for (let i = 0; i < N; i++) {
    const S = SY.initialState(1000 + i * 37);
    // بداية بعقيدة/مستشارين متنوعين حتى لا نقيس وضعاً واحداً
    if (i % 4 === 0) { S.doctrine = { id: "sharia", t: "المرجعية", eff: {}, bonusCat: "مجتمع" }; SY.applyEff(S, { shr: 12, leg: 2, coh: -3, r_eu: -3 }); }
    if (i % 3 === 0) S.cabinet = [{ t: "شيخ", cat: "مجتمع", v: 6 }];
    SY.autoRun(S, data, mode);
    const sc = SY.score(S).final;
    const evs = S.log.filter(l => trackIds.has(byTitle[l.ev])).length;
    sum.months += S.month; sum.score += sc; sum.track += evs;
    const shr = S.st.shr;
    sum.shrEnd += shr; sum.shrMin += Math.min(...(S.line.map(p => p.shr).concat(shr)));
    if (shr < 30) sum.low++; if (shr > 70) sum.high++;
    shrHist[Math.min(9, Math.floor(shr / 10))]++;
    const eid = S.over ? S.over.id : (SY.ending(S, data.endings).end || {}).id || "-";
    ends[eid] = (ends[eid] || 0) + 1;
  }
  console.log("\n=== " + mode + " (" + N + " جولة) — مسار الشريعة ===");
  console.log("أشهر: " + (sum.months / N).toFixed(1) + " | نتيجة: " + (sum.score / N).toFixed(1) +
    " | أحداث المسار لكل جولة: " + (sum.track / N).toFixed(1));
  console.log("shr نهاية: متوسط " + (sum.shrEnd / N).toFixed(1) + " | أدنى متوسط: " + (sum.shrMin / N).toFixed(1) +
    " | تحت 30: " + sum.low + " | فوق 70: " + sum.high);
  console.log("توزيع shr (عشرات): " + shrHist.join(" "));
  console.log("النهايات: " + Object.entries(ends).sort((a, b) => b[1] - a[1]).map(x => x[0] + ":" + x[1]).join("  "));
}
modes.forEach(m => run(m.trim()));
