#!/usr/bin/env node
/* tools/calib.js — معايرة نهائية: 1500+ جولة مع قياس السلاسل الزمنية والوعود والانهيارات
   node tools/calib.js [n_greedy] [n_random]                                      */
"use strict";
const fs = require("fs"), path = require("path");
const SY = require(path.join(__dirname, "..", "src", "engine.js"));
const ROOT = path.join(__dirname, "..");

function loadData() {
  const dir = path.join(ROOT, "src", "data");
  const out = { events: [], endings: [] };
  fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().forEach(f => {
    const o = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    out.events = out.events.concat(o.events || []);
    out.endings = out.endings.concat(o.endings || []);
  });
  out.byId = {}; out.events.forEach(e => out.byId[e.id] = e);
  return out;
}
const D = loadData();

const DOCTRINES = { security: { eff: { sec: 3, mil: 3, dem: -3 }, bonusCat: "أمني" },
  bread: { eff: { srv: 3, eco: 2, mil: -2 }, bonusCat: "اقتصادي" },
  consensus: { eff: { coh: 4, leg: 3, sec: -2 }, bonusCat: "مكونات" },
  sovereign: { eff: { sov: 4, dip: 2, r_tr: -3 }, bonusCat: "دبلوماسي" },
  sharia: { eff: { shr: 12, leg: 2, coh: -3, r_eu: -3 }, bonusCat: "مجتمع" } };
const ADVISERS = { shaykh: { cat: "مجتمع", v: 6 }, hawk: { cat: "أمني", v: 6 }, econ: { cat: "اقتصادي", v: 6 },
  dipl: { cat: "دبلوماسي", v: 6 }, kurd: { cat: "مكونات", v: 6 }, tech: { cat: "اقتصادي", v: 6 } };
function playOne(seed, mode, diff, doctrine, adv) {
  const S = SY.initialState(seed);
  if (doctrine && DOCTRINES[doctrine]) { S.doctrine = DOCTRINES[doctrine]; SY.applyEff(S, S.doctrine.eff); SY.addFlags(S, ["doc_" + doctrine]); }
  if (adv && ADVISERS[adv]) S.cabinet = [ADVISERS[adv]];
  if (diff) { S.diff = diff; S.difficulty = { easy: 1.18, normal: 1.0, hard: 0.84 }[diff]; }
  let g = 0, hit = { echo: 0, kept: 0, broken: 0, made: 0, opened: 0, ladder: 0, decree: 0 };
  while (S.month < SY.MONTHS_TOTAL - 1 && !S.over && g++ < 400) {
    const ev = SY.pickEvent(S, D);
    if (!ev) { SY.advance(S); continue; }
    S.used[ev.id] = 1; S.seen.push(ev.id);
    const opts = ev.options;
    let oi = 0;
    if (mode === "random") oi = Math.floor(S.rng() * opts.length);
    else {
      let best = -1e9;
      opts.forEach((o, idx) => {
        const val = e => { let v = 0; for (const k in e) { const neg = (k === "press" || k === "frag" || k.indexOf("t_") === 0);
          const w = (k in SY.STATS ? 1 : k in SY.AXIS ? .4 : k === "cash" ? 3 : k === "cap" ? .6 : k.indexOf("r_") === 0 ? .4 : k.indexOf("p_") === 0 ? .9 : .9);
          v += e[k] * w * (neg ? -1 : 1); } return v; };
        const p = SY.chance(S, o);
        let v = val((o.out && o.out.ok && o.out.ok.eff) || o.eff || {});
        if (p !== null && o.out) { const pm = (100 - p) * .45, pb = (100 - p) * .55;
          v = (val(o.out.ok.eff || {}) * p + val((o.out.mid || {}).eff || {}) * pm + val((o.out.bad || {}).eff || {}) * pb) / 100; }
        if (v > best) { best = v; oi = idx; }
      });
    }
    const o = opts[oi];
    if (o.promise) hit.made++;
    if (o.unlocks) hit.opened += o.unlocks.length;
    const r = SY.resolve(S, ev, o);
    if (r.decree) hit.decree++;
    const a = SY.advance(S);
    (a.msgs || []).forEach(m => {
      if (m.t === "أثر متأخر") hit.echo++;
      else if (m.t === "وعد أُنجز") hit.kept++;
      else if (m.t === "وعد نكث") hit.broken++;
      else if (m.t === "نكث تشريعي") hit.ladder++;
    });
    const c = SY.collapse(S); if (c) S.over = c;
  }
  return { S, hit };
}

function run(n, mode, diff, doctrine, adv) {
  const R = { n, mode, diff: (diff || "normal") + (doctrine ? " / عقيدة " + doctrine : "") + (adv ? " / مستشار " + adv : ""), months: [], score: [], grades: {}, ends: {}, coll: {},
              hit: { echo: 0, kept: 0, broken: 0, made: 0, opened: 0, ladder: 0, decree: 0 }, y1: 0, sat: {}, seen: {} };
  for (let i = 0; i < n; i++) {
    const { S, hit } = playOne(900000 + i * 7919, mode, diff, doctrine, adv);
    R.months.push(S.month);
    const sc = SY.score(S); R.score.push(sc.final);
    R.grades[sc.grade] = (R.grades[sc.grade] || 0) + 1;
    if (S.over && S.over.id) R.coll[S.over.id] = (R.coll[S.over.id] || 0) + 1;
    else { const e = SY.ending(S, D.endings).end; R.ends[e ? e.id : "none"] = (R.ends[e ? e.id : "none"] || 0) + 1; }
    if (S.month < 12) R.y1++;
    for (const k in hit) R.hit[k] += hit[k];
    ["leg", "coh", "sec", "eco", "srv", "mil", "sov", "dip", "dem", "press", "frag", "shr"].forEach(k => {
      R.sat[k] = R.sat[k] || { lo: 0, hi: 0, sum: 0 };
      if (S.st[k] <= 1) R.sat[k].lo++; if (S.st[k] >= 99) R.sat[k].hi++; R.sat[k].sum += S.st[k];
    });
    S.seen.forEach(id => R.seen[id] = (R.seen[id] || 0) + 1);
  }
  return R;
}

function report(R) {
  const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10;
  const pct = x => Math.round(x / R.n * 100);
  console.log("\n### " + R.mode + " / " + R.diff + "  (" + R.n + " جولة)");
  console.log("أشهر مكتملة: " + avg(R.months) + "  | نتيجة وسطى: " + avg(R.score) +
              "  | أعلى: " + Math.max(...R.score) + " أدنى: " + Math.min(...R.score));
  console.log("تقديرات: " + Object.entries(R.grades).sort().map(([g, c]) => g + ":" + c).join("  "));
  console.log("لم تتجاوز السنة الأولى: " + R.y1 + " (" + pct(R.y1) + "%)");
  console.log("انهيارات: " + Object.entries(R.coll).sort((a, b) => b[1] - a[1]).map(([k, c]) => k + ":" + pct(c) + "%").join("  "));
  const ends = Object.entries(R.ends).sort((a, b) => b[1] - a[1]);
  console.log("نهايات: " + ends.map(([k, c]) => k + ":" + pct(c) + "%").join("  "));
  const dead = D.endings.filter(e => !R.ends[e.id] && !R.coll[e.id]).map(e => e.id);
  console.log("نهايات لم تظهر: " + (dead.join(", ") || "—"));
  console.log("سلاسل زمنية لكل جولة: آثار مؤجلة " + (R.hit.echo / R.n).toFixed(2) +
              " | وعود (قطعت " + (R.hit.made / R.n).toFixed(2) + "، أُنجزت " + (R.hit.kept / R.n).toFixed(2) +
              "، نُكِثت " + (R.hit.broken / R.n).toFixed(2) + ") | أحداث فُتحت " + (R.hit.opened / R.n).toFixed(2) +
              " | نكث تشريعي " + (R.hit.ladder / R.n).toFixed(2) + " | مراسيم " + (R.hit.decree / R.n).toFixed(2));
  console.log("تشبّع المؤشرات (0 أو 100) %" + ": " + Object.entries(R.sat).map(([k, v]) =>
    k + " " + pct(v.lo) + "/" + pct(v.hi)).join("  "));
  const ns = D.events.filter(e => !e.shock);
  const unseen = ns.filter(e => !R.seen[e.id]);
  console.log("تغطية الأحداث: " + Object.keys(R.seen).length + "/" + D.events.length +
              " | تاريخية لم تظهر: " + unseen.length + (unseen.length ? " (" + unseen.slice(0, 8).map(e => e.id).join(", ") + ")" : ""));
}

const ng = Number(process.argv[2] || 1500), nr = Number(process.argv[3] || 400);
report(run(ng, "greedy", "normal"));
report(run(nr, "random", "normal"));
report(run(300, "greedy", "easy"));
report(run(300, "greedy", "hard"));
report(run(500, "greedy", "normal", "sharia", "shaykh"));
