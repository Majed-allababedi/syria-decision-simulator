/* ==========================================================================
   محاكي قرار سوريا — الواجهة (v2)
   ========================================================================== */
"use strict";
var UI = (function () {
  var D = null;          // البيانات (أحداث + نهايات + أخبار)
  var S = null;          // الحالة
  var lastEv = null;     // الحدث المعروض
  var lastRes = null;    // نتيجة آخر قرار
  var view = "start";    // start | play | result | end
  var returnView = "play";
  var tab = "gauges";
  var sideOpen = !(window.matchMedia && window.matchMedia("(max-width: 900px)").matches);
  var LS = "syria_sim_v3_save", LEGACY_LS = "syria_sim_v2_save";
  var saveBlocked = false, observedSave = null;
  function stats(method) {
    try { var a = window.answerStats; if (a && typeof a[method] === "function") return a[method].apply(a, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* لا تعطل الإحصاءات اللعبة. */ }
  }

  var ADVISERS = [
    { id: "tech",  t: "مصرفي تقنوقراطي",  d: "إضافة 6 نقاط مئوية إلى فرصة نجاح القرارات الاقتصادية", cat: "اقتصادي", v: 6 },
    { id: "hawk",  t: "ضابط أمني صارم",   d: "+6% نجاح في القرارات الأمنية والعسكرية", cat: "أمني", v: 6 },
    { id: "dipl",  t: "دبلوماسي مخضرم",   d: "+6% نجاح في القرارات الدبلوماسية", cat: "دبلوماسي", v: 6 },
    { id: "shaykh",t: "مستشار ديني مؤثر", d: "+6% في قرارات المجتمع والهوية (بما فيها مسار الشريعة والأحوال الشخصية)", cat: "مجتمع", v: 6 },
    { id: "kurd",  t: "وسيط مكونات (كردي/درزي)", d: "+6% في قرارات المكونات والثقة العامة", cat: "مكونات", v: 6 },
    { id: "econ",  t: "وزير إعادة إعمار",  d: "إضافة 1.2 مليار دولار إلى الخزينة عند البداية", cash: 1.2 }
  ];
  var DOCTRINES = [
    { id: "security", t: "الأمن أولاً", d: "+3 أمن و+3 جيش بدايةً، −3 شرعية مؤسساتية", eff: { sec: 3, mil: 3, dem: -3 }, bonusCat: "أمني" },
    { id: "bread",    t: "الخبز أولاً", d: "+3 خدمات و+2 اقتصاد، −2 جيش", eff: { srv: 3, eco: 2, mil: -2 }, bonusCat: "اقتصادي" },
    { id: "consensus",t: "التوافق أولاً", d: "+4 تماسك و+3 شرعية، −2 أمن", eff: { coh: 4, leg: 3, sec: -2 }, bonusCat: "مكونات" },
    { id: "sovereign",t: "السيادة أولاً", d: "+4 سيادة و+2 رصيد دبلوماسي، −3 مع أنقرة", eff: { sov: 4, dip: 2, r_tr: -3 }, bonusCat: "دبلوماسي" },
    { id: "sharia",   t: "المرجعية أولاً", d: "+12 مرجعية الشريعة و+2 شرعية، −3 تماسك و−3 مع أوروبا", eff: { shr: 12, leg: 2, coh: -3, r_eu: -3 }, bonusCat: "مجتمع" }
  ];

  /* ---------- أدوات عرض ---------- */
  function num(x) { return typeof x === "number" ? String(Number(x.toFixed(1))) : x; }
  function esc(x) { return String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function rich(x) { return esc(x).replace(/&lt;(\/?)(b|strong|em|br)\s*\/?&gt;/gi, "<$1$2>"); }
  function difficultyName(x) { return x === "easy" ? "سهل" : x === "hard" ? "قاسٍ" : "متوازن"; }
  function nameOf(k) {
    if (SY.STATS[k]) return SY.STATS[k].n;
    if (SY.NEG[k]) return SY.NEG[k].n;
    if (SY.AXIS[k]) return SY.AXIS[k].n;
    if (k === "cash") return "الخزينة";
    if (k === "cap") return "الرصيد السياسي";
    if (k.indexOf("r_") === 0) return "علاقة: " + (SY.REL[k.slice(2)] || k.slice(2));
    if (k.indexOf("p_") === 0) return "ثقة: " + (SY.POP[k.slice(2)] || k.slice(2));
    if (k.indexOf("t_") === 0) return "تهديد: " + (SY.THR[k.slice(2)] || k.slice(2));
    return "مؤشر غير معروف";
  }
  function isNeg(k) { return (k === "press" || k === "frag" || k.indexOf("t_") === 0); }
  function colorOf(k) {
    var key = k.indexOf("r_") === 0 ? "dip" : k.indexOf("p_") === 0 ? "sov" : k.indexOf("t_") === 0 ? "press" : k;
    var colors = {leg:"#a66e38",coh:"#4f8db9",sec:"#408369",eco:"#b87c45",srv:"#438c91",mil:"#a385bf",sov:"#759152",dip:"#b67c96",dem:"#7d9bc2",press:"#c56b72",frag:"#ce8b5e",shr:"#bda262"};
    return colors[key] || "#83a9c7";
  }
  function effPills(eff) {
    var keys = Object.keys(eff || {});
    if (!keys.length) return '<span class="eff nu">بلا أثر رقمي مباشر</span>';
    return keys.map(function (k) {
      var v = eff[k];
      var neg = isNeg(k);
      var good = neg ? v < 0 : v > 0;
      var cls = SY.AXIS[k] ? "ax" : (v === 0 ? "nu" : good ? "up" : "dn");
      var val = (v > 0 ? "+" : "") + num(v) + (k === "cash" ? " مليار$" : "");
      return '<span class="eff ' + cls + '">' + esc(nameOf(k)) + " " + esc(val) + "</span>";
    }).join("");
  }

  /* ============================ شاشة البداية ============================ */
  function showStart() {
    var liveObserved = observedSave, liveBlocked = saveBlocked;
    if (view !== "start") returnView = view;
    view = "start";
    var saved = null, warning = "";
    try {
      var existing = localStorage.getItem(LS); observedSave = existing;
      if (existing !== null) { saved = readSave(existing); saveBlocked = false; }
      else { saveBlocked = false; if (localStorage.getItem(LEGACY_LS)) warning = "الحفظ القديم محفوظ كما هو، لكن الاستئناف الدقيق غير متاح لأن حالة الحدث والعشوائية لم تُحفظ."; }
    } catch (e) { saveBlocked = true; warning = "الحفظ غير صالح أو غير مدعوم، أو التخزين غير متاح. لن نكتب فوقه."; }
    var evCount = D.events.length, hist = D.events.filter(function (e) { return !e.shock; }).length;
    var html = '<div class="hero"><div class="hero-copy">' +
      '<div class="section-label">غرفة القرار</div><h1>محاكي قرار سوريا<span class="hero-subtitle">قرارات اليوم، ملامح الغد</span></h1>' +
      '<div class="tag">سبعة وثلاثون شهراً، ' + evCount + ' حدثًا بين سياق تاريخي وسيناريوهات محتملة. وازن بين الخيارات، وتتبّع ما تتركه قراراتك.</div>' +
      '<div class="flagline"><span class="chip">8 ديسمبر 2024 → ديسمبر 2027</span>' +
      '<span class="chip cat">' + hist + ' ملف قرار</span>' +
      '<span class="chip shock">' + (evCount - hist) + ' صدمة محتملة</span>' +
      '</div></div>' +
      '<figure class="hero-map"><svg viewBox="0 0 440 330" role="img" aria-label="رسم تخطيطي توضيحي لسوريا، ليس خريطة حدود أو سيطرة"><g fill="none" stroke="currentColor"><circle cx="220" cy="160" r="135" opacity=".13"/><circle cx="220" cy="160" r="98" opacity=".15"/><path d="M30 160h380M220 20v280M80 65l280 190M70 240L370 80" opacity=".12"/><path d="M207.5,233.2 L133.1,284.4 L90.8,265.4 L90,265 L95.2,257.7 L94.6,238.1 L103.9,211.8 L124.6,193.7 L118.4,174.9 L101.3,172.4 L97.8,135.7 L107.1,116 L117.3,105.5 L127.4,94.9 L129.5,68.2 L141.9,77.5 L183.8,64.1 L204,73.2 L235.3,73 L279,55 L299.5,55.8 L342.7,48.4 L323.2,78.3 L302.4,90.2 L306,125.2 L291.6,183.3 Z" fill="#74c2b0" fill-opacity=".13" stroke="#92d6c5" stroke-width="2"/><path d="M115 245 Q180 170 155 105 T290 105" stroke="#dfb869" stroke-dasharray="3 7" opacity=".8"/><circle cx="115" cy="245" r="5" fill="#f0c67b"/><circle cx="155" cy="105" r="5" fill="#f0c67b"/><circle cx="290" cy="105" r="5" fill="#f0c67b"/></g></svg></figure>' +
      '<div class="stat3">' +
      '<div class="mini-card"><b>بداية مثقلة بالتحديات</b>مؤسسات تحتاج إلى إعادة بناء، موارد محدودة، ومطالب أمنية ومعيشية لا تنتظر.</div>' +
      '<div class="mini-card"><b>لا قرار بلا مفاضلة</b>الأمن والمعيشة والسيادة وثقة المجتمع ملفات مترابطة؛ مكسب في أحدها قد يحمل كلفة في آخر.</div>' +
      '<div class="mini-card"><b>محاكاة وليست نبوءة</b>المؤشرات والاحتمالات افتراضات تعليمية، وليست قياسًا لحياة الناس أو توقعًا مؤكدًا للمستقبل.</div>' +
      '</div></div>';

    html += '<div class="card setup"><h2>إعداد الجولة</h2><p class="setup-intro">اختر فريقك وأولوياتك قبل الدخول إلى غرفة القرار.</p>' +
      '<div class="pickers">' +
      '<div class="pick"><h4>مستوى الصعوبة</h4>' +
      '<label><input type="radio" name="diff" value="easy"> سهل<span class="pd">فرص نجاح أعلى للقرارات الاحتمالية</span></label>' +
      '<label><input type="radio" name="diff" value="normal" checked> متوازن<span class="pd">الاحتمالات الأساسية للمحاكاة</span></label>' +
      '<label><input type="radio" name="diff" value="hard"> قاسٍ<span class="pd">القرارات الحادة تنقلب غالباً</span></label>' +
      '</div>' +
      '<div class="pick"><h4>مستشارو المرحلة (اثنان)</h4>' +
      ADVISERS.map(function (a) { return '<label><input type="checkbox" name="adv" value="' + a.id + '"> ' + esc(a.t) + '<span class="pd">' + esc(a.d) + "</span></label>"; }).join("") +
      "</div>" +
      '<div class="pick"><h4>عقيدة الحكم</h4>' +
      DOCTRINES.map(function (d) { return '<label><input type="radio" name="doc" value="' + d.id + '"> ' + esc(d.t) + '<span class="pd">' + esc(d.d) + "</span></label>"; }).join("") +
      "</div></div>" +
      '<p><label><input type="checkbox" id="statsConsent"' + (stats("enabled") ? ' checked' : '') + '> الموافقة على مشاركة نتائجي</label></p>' +
      '<div class="nextrow"><div class="tiny">بذرة عشوائية للنتائج: <span class="hl" id="seedlab">' + (Math.floor(Math.random() * 99999) + 1) + "</span> — يمكن استئناف الجولة لاحقاً.</div>" +
      "<div>" + (S ? '<button class="btn ghost" id="returnRun">العودة للجولة الحالية</button> ' : "") + (saved ? '<button class="btn ghost" id="resume">استئناف جولة محفوظة</button> ' : "") +
      '<button class="btn" id="go">ابدأ — 8 ديسمبر 2024</button></div></div></div>';

    if (warning) html += '<div class="card">' + esc(warning) + '</div>';
    html += helpCard();
    document.getElementById("app").innerHTML = '<div class="wrap">' + html + "</div>";
    document.getElementById("go").onclick = start;
    var consentBox = document.getElementById("statsConsent"); if (consentBox) consentBox.onchange = function () { stats("consent", consentBox.checked); };
    var r = document.getElementById("resume"); if (r) r.onclick = resume;
    var back = document.getElementById("returnRun"); if (back) back.onclick = function () { observedSave = liveObserved; saveBlocked = liveBlocked; view = returnView; if (view === "end") showEnd(); else render([]); };
  }

  function helpCard() {
    return '<div class="two"><div class="card"><h2>كيف تلعب</h2><ul style="padding-right:20px">' +
      '<li>كل شهر حدث واحد (أو صدمة). لك <b>37 شهراً</b> حتى ديسمبر 2027.</li>' +
      '<li>اختر بـ <span class="chip">1 2 3 4</span> أو بالفأرة، ثم <span class="chip">إدخال</span> للمتابعة.</li>' +
      '<li>بعض القرارات تكلّف <b>خزينة</b> أو <b>رصيداً سياسياً</b>؛ الرصيد هو ما تملكه من ثقة لتشتري به قراراً مؤلماً.</li>' +
      '<li>الاحتمال المعروض يُحسب من مؤشراتك: الجاهزية والأمن يرفعان نجاح الحسم، والاحتقان يخفضه.</li>' +
      '<li>للقرارات الاحتمالية <b>ثلاثة مستويات نتيجة</b>؛ أما القرارات الحتمية فلا تتضمن قرعة.</li>' +
      '<li>مربّع <span style="color:var(--green)">السياق المرجعي</span> يفصل بين الرواية التاريخية والسيناريو؛ بعض التفاصيل ما زالت تحتاج تحققًا.</li>' +
      '<li>التغير الشهري جزء من النموذج: تتفاعل المؤشرات مع الموارد والضغوط وثقة المكونات.</li></ul></div>' +
      '<div class="card"><h2>المؤشرات ومحور الهوية</h2><div class="rows">' +
      Object.keys(SY.STATS).map(function (k) {
        return '<div class="row"><span class="rn">' + SY.STATS[k].ic + " " + SY.STATS[k].n + "</span><span class='tiny' style='flex:1'>" + SY.STATS[k].s + "</span></div>";
      }).join("") +
      '<div class="row"><span class="rn">🔥 الضغط الإسرائيلي</span><span class="tiny" style="flex:1">الأعلى أسوأ: غارات وتوغل وقضم</span></div>' +
      '<div class="row"><span class="rn">💥 الاحتقان</span><span class="tiny" style="flex:1">الأعلى أسوأ: قابلية الانفجار الأهلي</span></div>' +
      '<div class="row"><span class="rn">🕌 مرجعية الشريعة</span><span class="tiny" style="flex:1">محور محايد: موضع الدين من التشريع والقضاء. يرضي جهة ويقلق أخرى — انظر لوحة المؤشرات.</span></div>' +
      "</div></div></div>";
  }

  function start() {
    var seed = parseInt((document.getElementById("seedlab") || {}).textContent || "7", 10);
    var dv = document.querySelector('input[name=diff]:checked');
    if (document.querySelectorAll('input[name=adv]:checked').length !== 2) { alert("اختر مستشارين اثنين فقط."); return; }
    var advs = Array.prototype.slice.call(document.querySelectorAll('input[name=adv]:checked')).map(function (i) {
      return ADVISERS.filter(function (a) { return a.id === i.value; })[0];
    }).filter(Boolean);
    if (advs.length < 2) { alert("اختر مستشارين اثنين على الأقل."); return; }
    var dcv = document.querySelector('input[name=doc]:checked');
    if (!dcv) { alert("اختر عقيدة الحكم قبل بدء الجولة."); return; }
    var doc = DOCTRINES.filter(function (x) { return x.id === dcv.value; })[0];
    if (!doc || (dv && ["easy", "normal", "hard"].indexOf(dv.value) < 0)) { alert("إعداد الجولة غير صالح."); return; }
    if ((S || (observedSave !== null && !saveBlocked)) && !confirm("بدء جولة جديدة سيستبدل الجولة الحالية أو المحفوظة. متابعة؟")) return;
    S = SY.initialState(seed);
    S.diff = dv ? dv.value : "normal";
    S.difficulty = { easy: 1.18, normal: 1.0, hard: 0.84 }[S.diff];
    S.cabinet = advs;
    advs.forEach(function (a) { if (a.cash) S.res.cash += a.cash; });
    S.doctrine = doc; SY.applyEff(S, doc.eff); SY.addFlags(S, ["doc_" + doc.id]);
    S.line.push({ m: 0, leg: S.st.leg, coh: S.st.coh, eco: S.st.eco, mil: S.st.mil, sov: S.st.sov, dip: S.st.dip, sec: S.st.sec, dem: S.st.dem, srv: S.st.srv, press: S.st.press, frag: S.st.frag, shr: S.st.shr, cash: S.res.cash });
    nextMonth(true);
  }
  function resume() {
    try {
      var text = localStorage.getItem(LS), raw = readSave(text); observedSave = text; saveBlocked = false;
      SY.rngRestore(raw.state, raw.rng);
      S = raw.state; lastEv = raw.eventId ? D.byId[raw.eventId] : null;
      lastRes = raw.result; view = raw.phase;
      if (view === "end") showEnd(); else render([]);
    } catch (e) { alert("تعذّر استئناف الجولة؛ الحفظ غير صالح أو غير مدعوم ولم يُغيَّر."); }
  }
  function readSave(text) {
    var raw = JSON.parse(text), s = raw && raw.state, base = SY.initialState(1);
    function obj(x) { return x && typeof x === "object" && !Array.isArray(x); }
    function numbers(x) { return obj(x) && Object.keys(x).every(function (k) { return Number.isFinite(x[k]); }); }
    function strings(x) { return Array.isArray(x) && x.every(function (v) { return typeof v === "string"; }); }
    function optionalNumbers(x) { return x == null || numbers(x); }
    function tier(x) { return x === "ok" || x === "mid" || x === "bad"; }
    if (!raw || raw.version !== 3 || !s || !Number.isInteger(s.month) || s.month < 0 || s.month >= SY.MONTHS_TOTAL ||
        !Number.isInteger(raw.rng) || raw.rng < 0 || raw.rng > 4294967295 ||
        ["play", "result", "end"].indexOf(raw.phase) < 0) throw new Error("save");
    ["st", "res", "rel", "pop", "thr"].forEach(function (g) {
      if (!numbers(s[g])) throw new Error("save");
      Object.keys(base[g]).forEach(function (k) { if (typeof s[g][k] !== "number" || !isFinite(s[g][k])) throw new Error("save"); });
    });
    ["cabinet", "queue", "promises", "delay", "log", "line", "seen"].forEach(function (k) { if (!Array.isArray(s[k])) throw new Error("save"); });
    ["flags", "used", "notes"].forEach(function (k) { if (!s[k] || typeof s[k] !== "object" || Array.isArray(s[k])) throw new Error("save"); });
    if (!Number.isFinite(s.seed) || !Number.isFinite(s.shrHigh) || !Number.isFinite(s.difficulty) || typeof s.diff !== "string" ||
        !numbers(s.flags) || !numbers(s.used) || !strings(s.seen) ||
        (s.doctrine != null && (!obj(s.doctrine) || typeof s.doctrine.t !== "string" || (s.doctrine.bonusCat != null && typeof s.doctrine.bonusCat !== "string"))) ||
        s.cabinet.some(function (x) { return !obj(x) || typeof x.t !== "string" || (x.cat != null && typeof x.cat !== "string") || (x.v != null && !Number.isFinite(x.v)); }) ||
        s.queue.some(function (x) { return !obj(x) || typeof x.id !== "string" || !Number.isFinite(x.at); }) ||
        s.delay.some(function (x) { return !obj(x) || !Number.isFinite(x.at) || !optionalNumbers(x.eff) || (x.flags != null && !strings(x.flags)) || (x.txt != null && typeof x.txt !== "string"); }) ||
        s.promises.some(function (x) { return !obj(x) || typeof x.metric !== "string" || !Number.isFinite(x.due) || !Number.isFinite(x.target) || !optionalNumbers(x.reward) || !optionalNumbers(x.penalty) || (x.label != null && typeof x.label !== "string"); }) ||
        s.log.some(function (x) { return !obj(x) || ["month", "cat", "ev", "opt", "txt"].some(function (k) { return x[k] != null && typeof x[k] !== "string"; }) || (x.tier != null && !tier(x.tier)) || (x.p != null && !Number.isFinite(x.p)) || !optionalNumbers(x.eff); }) ||
        s.line.some(function (x) { return !numbers(x) || !Number.isFinite(x.m); })) throw new Error("save");
    if (raw.phase !== "end" && (!raw.eventId || !D.byId[raw.eventId] || !Array.isArray(D.byId[raw.eventId].options))) throw new Error("save");
    if (raw.phase === "result" && (!obj(raw.result) || typeof raw.result.txt !== "string" || !numbers(raw.result.eff) || !tier(raw.result.tier) ||
        (raw.result.decree != null && !Number.isFinite(raw.result.decree)) || (raw.result.flags != null && !strings(raw.result.flags)) ||
        (raw.result.roll != null && (!obj(raw.result.roll) || !Number.isFinite(raw.result.roll.p) || !Number.isFinite(raw.result.roll.r) || typeof raw.result.roll.hit !== "boolean")))) throw new Error("save");
    if (raw.phase === "play" && raw.result !== null) throw new Error("save");
    if (s.over && (typeof s.over.id !== "string" || typeof s.over.t !== "string" || typeof s.over.d !== "string")) throw new Error("save");
    return raw;
  }
  function save() {
    if (!S) return false;
    if (saveBlocked) { alert("تعذّر الحفظ حفاظاً على بيانات موجودة غير صالحة أو غير مدعومة."); return false; }
    try {
      var existing = localStorage.getItem(LS);
      if (existing !== observedSave) { saveBlocked = true; throw new Error("save changed"); }
      if (existing !== null) {
        try { readSave(existing); } catch (e) { saveBlocked = true; throw e; }
      }
      var c = JSON.parse(JSON.stringify(S));
      var text = JSON.stringify({ version: 3, state: c, rng: SY.rngSnapshot(S), eventId: lastEv ? lastEv.id : null, phase: view, result: lastRes });
      localStorage.setItem(LS, text); observedSave = text;
      return true;
    } catch (e) { alert("تعذّر حفظ الجولة؛ تحقق من مساحة التخزين وإتاحته."); return false; }
  }

  /* ============================ دورة اللعب ============================ */
  function nextMonth(first) {
    var notes = [];
    while (true) {
    if (!first) {
      if (S.month >= SY.MONTHS_TOTAL - 1) { S.over = SY.collapse(S); return finish(); }
      var a = SY.advance(S);
      notes = a.msgs || [];
      var col = SY.collapse(S);
      if (col) { S.over = col; return finish(); }
    }
    var ev = SY.pickEvent(S, D);
    if (!ev) {
      // شهر بلا حدث: أثر انجراف فقط
      first = false;
      continue;
    }
    S.used[ev.id] = 1;
    S.seen.push(ev.id);
    lastEv = ev; lastRes = null;
    view = "play";
    render(notes, true);
    save();
    return;
    }
  }

  function render(notes, handoff) {
    var st = S.st;
    var ev = lastEv;
    var riskCls = ev.risk === "مرتفع" ? "risk-high" : ev.risk === "متوسط" ? "risk-med" : "risk-low";
    var h = "";

    /* --- شريط علوي --- */
    h += '<div class="top"><div class="wrap" style="padding:0"><div class="topin">' +
      '<div class="brand"><div class="logo" aria-hidden="true">س</div><div><h1>محاكي قرار سوريا</h1><small>' + (S.doctrine ? esc(S.doctrine.t) : "") + " · مستشارون: " + esc(S.cabinet.map(function (a) { return a.t; }).join("، ")) + "</small></div></div>" +
      '<div class="monthbox"><div><div class="mt">' + SY.monthLabel(S.month) + '</div><div class="mn">الشهر ' + (S.month + 1) + " / " + SY.MONTHS_TOTAL + " · " + esc(difficultyName(S.diff)) + "</div></div>" +
      '<div style="width:150px"><div class="gbar"><i style="width:' + Math.round((S.month / (SY.MONTHS_TOTAL - 1)) * 100) + '%;background:linear-gradient(90deg,#c99b2e,#e7bf5c)"></i></div></div></div>' +
      '<div class="topbtns">' +
      '<button class="btn ghost sm side-toggle" id="sideToggle" aria-controls="statePanel" aria-expanded="' + sideOpen + '">' + (sideOpen ? "طي المؤشرات" : "عرض المؤشرات") + "</button>" +
      '<button class="btn ghost sm" id="saveBtn">حفظ</button>' +
      '<button class="btn ghost sm" id="reportBtn">تقرير قراراتي</button>' +
      '<button class="btn ghost sm" id="helpBtn">مساعدة</button>' +
      (stats("enabled") ? '<button class="btn ghost sm" id="withdrawStats">سحب موافقة الإحصاءات</button>' : '') +
      '<button class="btn danger sm" id="restartBtn">جولة جديدة</button>' +
      "</div></div></div></div>";

    h += '<div class="wrap"><div id="decisionLayout" class="grid' + (sideOpen ? "" : " side-closed") + '"><main class="main">';


    /* --- الحدث --- */
    h += '<div class="card event-card"><div class="eventhead">' +
      '<span class="chip cat">' + esc(ev.cat || "عام") + "</span>" +
      '<span class="chip ' + riskCls + '">خطورة: ' + esc(ev.risk || "متوسطة") + "</span>" +
      (ev.shock ? '<span class="chip shock">⚡ صدمة غير متوقعة</span>' : "") +
      (S.month >= 24 ? '<span class="chip">مسار متوقع — لم يحدث بعد (تاريخ الجلسة: نوفمبر 2026)</span>' : "") +
      (ev.real && S.month < 24 ? '<span class="chip">سياق تاريخي قابل للمراجعة</span>' : "") +
      (ev.verified === "needs-second-source" ? '<span class="chip shock">مصدر واحد — يحتاج تأكيداً</span>' : "") +
      "</div><h2>" + esc(ev.title) + "</h2>" +
      '<div class="brief">' + rich(ev.brief) + "</div>" +
      (ev.facts && ev.facts.length ? '<ul class="facts">' + ev.facts.map(function (f) { return "<li>" + rich(f) + "</li>"; }).join("") + "</ul>" : "") +
      "</div>";

    /* --- النتيجة أو الخيارات --- */
    if (!lastRes) {
      h += '<div class="opts">' + ev.options.map(function (o, i) {
        var p = SY.previewChance(S, o);
        var cost = [];
        if (o.cost) {
          if (o.cost.cash) cost.push('<span class="pill cost">' + (o.cost.cash > 0 ? "+" : "") + o.cost.cash + " مليار $</span>");
          if (o.cost.cap) cost.push('<span class="pill cost">' + (o.cost.cap > 0 ? "+" : "") + o.cost.cap + " رصيد سياسي</span>");
        }
        var pcls = p === null ? "lock" : p >= 65 ? "p-hi" : p >= 42 ? "p-md" : "p-lo";
        return '<button class="opt" data-i="' + i + '"><span class="key">' + (i + 1) + "</span><b>" + esc(o.t) + "</b><small>" + rich(o.d || "") + "</small>" +
          '<div class="optmeta">' +
          (p === null ? '<span class="pill lock">بلا مقامرة — النتيجة حتمية</span>' : '<span class="pill ' + pcls + '">فرصة النجاح: ' + p + "%</span>") +
          cost.join("") + "</div></button>";
      }).join("") + "</div>";
    } else {
      var r = lastRes;
      var tcls = "t-" + (r.tier === "ok" ? "ok" : r.tier === "mid" ? "mid" : "bad");
      var head = r.roll ? '<div class="ot">' + (r.tier === "ok" ? "✓ نجح القرار" : r.tier === "mid" ? "◐ نجح جزئياً" : "✗ انقلب القرار") + ' <span class="tiny">(' + esc(num(r.roll.p)) + "% متوقع · الرمية " + esc(num(r.roll.r)) + ")</span></div>" : '<div class="ot">نُفّذ القرار</div>';
      h += '<div class="card"><h2>النتيجة</h2><div class="outcome ' + tcls + '">' + head + "<div>" + rich(r.txt) + '</div><div class="effs">' + effPills(r.eff) + "</div></div>" +
        (lastRes.decree ? '<div class="reality"><div class="rt">مرسوم اضطراري</div>رصيدك السياسي لم يكن يكفي هذا القرار فمرَّ بمرسوم: ارتفع الاحتقان وتآكلت الشرعية المؤسساتية بمقدار العجز (' + esc(num(lastRes.decree)) + ').</div>' : "") +
        (lastEv.real ? '<div class="reality"><div class="rt">السياق المرجعي — ليس نتيجة قرارك</div>' + rich(lastEv.real) + "</div>" : "") +
        '<div class="nextrow"><div class="tiny">' + pendingHint() + '</div><button class="btn" id="nextBtn">' + (S.month === SY.MONTHS_TOTAL - 1 ? 'عرض حصيلة الجولة' : 'الشهر التالي') + '</button></div></div>';
    }

    var nb = newsFor(S.month);
    if (nb.length || notes.length) {
      h += '<details class="news"><summary>نشرة الشهر والتطورات <span>' + (nb.length + notes.length) + '</span></summary><div class="news-body">';
      nb.forEach(function (n) { h += '<div class="note ' + (n.k === "warnc" ? "warnc" : n.k === "goodc" ? "goodc" : "infoc") + '">' + rich(n.t) + "</div>"; });
      notes.forEach(function (n) { h += '<div class="note">' + esc(n.t) + ": " + esc(n.x) + "</div>"; });
      h += "</div></details>";
    }
    h += "</main>"; // مساحة القرار

    /* --- الشريط الجانبي --- */
    h += '<aside class="side" id="statePanel" aria-label="مؤشرات الدولة"' + (sideOpen ? '' : ' hidden') + '>' + sidebar() + '</aside>';
    h += "</div></div>";

    document.getElementById("app").innerHTML = h;
    bind();
    if (sideOpen && tab === "chart") drawChart();
    window.scrollTo(0, 0);
    if (handoff) { var target = lastRes ? document.getElementById("nextBtn") : document.querySelector(".opt"); if (target) target.focus(); }
  }

  function pendingHint() {
    var n = S.delay.filter(function (d) { return d.at <= S.month + 4; }).length;
    var q = S.queue.length;
    var pr = S.promises || [];
    var bits = [];
    if (n) bits.push("‏" + n + " أثراً متأجلاً سيظهر خلال 4 أشهر");
    if (q) bits.push("‏" + q + " حدثاً مفتوحاً بقرارك");
    pr.forEach(function (x) {
      bits.push("وعد: " + esc(nameOf(x.metric)) + " ≥ " + esc(x.target) + " في " + esc(SY.monthLabel(x.due)) +
                " (" + Math.round(SY.getVal(S, x.metric)) + " الآن)");
    });
    if (S.st.press > 70) bits.push("⚠ الضغط الإسرائيلي يستنزف السيادة والاقتصاد شهرياً");
    if (S.thr.isis > 65) bits.push("⚠ نشاط داعش مرتفع");
    if (S.res.cap < 25) bits.push("⚠ رصيدك السياسي شبه نفد");
    return bits.join(" · ") || "لا التزامات معلّقة";
  }

  function newsFor(m) {
    return (D.news || []).filter(function (n) { return n.at === m; });
  }

  /* ============================ الشريط الجانبي ============================ */
  function sidebar() {
    var h = '<div class="tabs">' +
      [["gauges", "المؤشرات"], ["state", "حالة الدولة"], ["chart", "المنحنى"], ["arch", "الأرشيف"]].map(function (t) {
        return '<button class="tab ' + (tab === t[0] ? "on" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>";
      }).join("") + "</div>";
    if (tab === "gauges") h += panelGauges();
    else if (tab === "state") h += panelState();
    else if (tab === "chart") h += '<div class="card"><h2>تطور المؤشرات</h2><canvas id="chart"></canvas><div class="legend" id="legend"></div></div>';
    else h += panelArchive();
    return h;
  }

  function panelGauges() {
    var prev = S.line.length > 1 ? S.line[S.line.length - 1] : null;
    function g(k, neg) {
      var v = S.st[k];
      var d = prev ? Math.round(v - (prev[k] || 0)) : 0;
      var axis = !!SY.AXIS[k];
      var dlab = d === 0 ? "" : '<span class="gd ' + (axis ? "neu" : (d > 0 ? "up" : "dn")) + '">' + (d > 0 ? "▲" : "▼") + Math.abs(d) + "</span>";
      var barColor = neg ? "linear-gradient(90deg,#7a2b2b,#e8615f)" : "linear-gradient(90deg," + colorOf(k) + "88," + colorOf(k) + ")";
      var meta = SY.STATS[k] || SY.NEG[k] || SY.AXIS[k] || {};
      return '<div class="g ' + (neg ? "neg " : "") + (axis ? "axis" : "") + '" title="' + esc(meta.s || "") + '">' +
        '<div class="gl"><span>' + (meta.ic || "") + " " + esc(nameOf(k)) + "</span><span>" + dlab + '<span class="gv">' + Math.round(v) + "</span></span></div>" +
        '<div class="gbar"><i style="width:' + esc(v) + '%;background:' + barColor + '"></i></div></div>';
    }
    var h = '<div class="card tight"><div class="gauges">' +
      Object.keys(SY.STATS).map(function (k) { return g(k, false); }).join("") +
      Object.keys(SY.NEG).map(function (k) { return g(k, true); }).join("") +
      Object.keys(SY.AXIS).map(function (k) { return g(k, false); }).join("") +
      "</div>" +
      '<div class="axisnote">🕌 <b>محور الهوية محايد</b>: ليس ربْحاً ولا خسارة في حدّ ذاته. صعوده يرضي مقاتلي «الجيل القديم» وشارعاً سنياً محافظاً، ويُقلق العلويين والدروز والمسيحيين والمانحين الأوروبيين؛ ونزوله يفعل العكس. التاريخ يقول إن الوعد لم يُلغَ ولم يُنفَّذ كاملاً — الخيار لك.</div>' +
      '<div class="resrow"><div class="res ' + (S.res.cash < 1 ? "warn" : "") + '"><b>' + S.res.cash.toFixed(1) + "</b><span>خزينة (مليار $)</span></div>" +
      '<div class="res ' + (S.res.cap < 25 ? "warn" : "") + '"><b>' + Math.round(S.res.cap) + "</b><span>رصيد سياسي</span></div></div>" +
      '<div class="tiny" style="margin-top:8px">المؤشرات الحمراء: الأعلى فيها أسوأ. مرّر الفأرة على أي مؤشر لترى معناه.</div></div>';
    return h;
  }

  function bar(v, cls) {
    return '<span class="mini ' + cls + '"><i style="width:' + esc(v) + '%"></i></span>';
  }
  function panelState() {
    var f = Object.keys(S.flags).filter(function (k) { return S.flags[k] > 0; });
    var h = '<div class="card tight"><h3 style="margin-top:0">العلاقات الخارجية</h3><div class="rows">' +
      Object.keys(SY.REL).map(function (k) {
        return '<div class="row"><span class="rn">' + SY.REL[k] + '</span>' + bar(S.rel[k], "") + '<span class="val">' + esc(num(S.rel[k])) + "</span></div>";
      }).join("") + "</div>" +
      "<h3>ثقة المكونات</h3><div class='rows'>" +
      Object.keys(SY.POP).map(function (k) {
        return '<div class="row"><span class="rn">' + SY.POP[k] + "</span>" + bar(S.pop[k], "pop") + '<span class="val">' + esc(num(S.pop[k])) + "</span></div>";
      }).join("") + "</div>" +
      "<h3>بؤر التهديد</h3><div class='rows'>" +
      Object.keys(SY.THR).map(function (k) {
        return '<div class="row"><span class="rn">' + SY.THR[k] + "</span>" + bar(S.thr[k], "thr") + '<span class="val">' + esc(num(S.thr[k])) + "</span></div>";
      }).join("") + "</div>" +
      '<h3>مسارات فتحتها قراراتك</h3><div>' + (f.length ? f.map(function (x) { return '<span class="tag" style="margin:2px">' + esc(flagName(x)) + "</span>"; }).join(" ") : '<span class="tiny">لا شيء بعد</span>') + "</div></div>";
    return h;
  }
  function flagName(x) {
    var m = {
      massacre: "ملف مجازر مفتوح", sdfdeal: "اتفاق مع قسد", sdfwar: "جبهة شرقية", federal: "فيدرالية",
      trials: "محاكمات", pressys: "دستور رئاسي", sweidacrisis: "أزمة السويداء", sweidasoft: "تهدئة السويداء",
      sweidawar: "حرب السويداء", resist: "مقاومة جنوبية", isrdeal: "اتفاق مع إسرائيل", mega: "ميجا مشاريع",
      necam: "حسم الشمال الشرقي", nepol: "تفاوض شرقي", newar: "حرب شرقية", kurdfull: "حزمة كردية كاملة",
      aleppoop: "عملية حلب", tuclose: "تحالف مع أنقرة", tulimit: "تحجيم أنقرة", pcindirect: "برلمان غير مباشر",
      doc_security: "عقيدة أمنية", doc_bread: "عقيدة معيشة", doc_consensus: "عقيدة توافق", doc_sovereign: "عقيدة سيادة",
      doc_sharia: "عقيدة المرجعية أولاً", fiqh_code: "تقنين الفقه", sharia_criminal: "تطبيق الحدود",
      personal_status_reform: "إصلاح قانون الأسر", deferred_family_law: "تأجيل قانون الأسر",
      fighters_pledge: "وعد المقاتلين قائم", jihadi_revolt: "تمرد الحاضنة الجهادية",
      sharia_council_state: "مأسسة المرجعية الدينية", awqaf_purged: "ضبط مؤسسة الأوقاف",
      minority_pact: "عقد المكونات", salafist_split: "انشقاق السلفيين", justice_void: "فراغ عدلي",
      sweida_statelet: "سويداء شبه مستقلّة", kurd_open: "جبهة كردية مفتوحة", coast_open: "جبهة ساحلية",
      warlord_badiya: "أمراء بادية", indefinite_transition: "انتظار مفتوح", transition_done: "انتقال منجز"
    };
    if (m[x]) return m[x];
    var event = D.events.filter(function (e) { return e.options.some(function (o) { return (o.flags || []).indexOf(x) >= 0 || Object.keys(o.out || {}).some(function (t) { return ((o.out[t] || {}).flags || []).indexOf(x) >= 0; }); }); })[0];
    if (event) return event.title;
    return "أثر قرار إضافي";
  }
  function panelArchive() {
    if (!S.log.length) return '<div class="card tight"><span class="tiny">لم تتخذ قراراً بعد.</span></div>';
    var items = S.log.slice().reverse().map(function (l) {
      var tg = l.tier ? '<span class="tiertag ' + esc(l.tier) + '">' + (l.tier === "ok" ? "نجح" : l.tier === "mid" ? "جزئي" : "انقلب") + " " + esc(num(l.p)) + "%</span>" : "";
      return '<div class="li"><div class="lh"><span>' + esc(l.month) + " · " + esc(l.cat || "") + "</span>" + tg + "</div>" +
        '<div class="lt">' + esc(l.ev) + '</div><div class="lo">← ' + esc(l.opt) + '</div><div class="lx">' + esc(l.txt) + '</div><div class="effs">' + effPills(l.eff) + "</div></div>";
    }).join("");
    return '<div class="card tight"><h3 style="margin-top:0">أرشيف القرارات (' + S.log.length + ")</h3><div class=\"log\">" + items + "</div></div>";
  }

  /* ============================ الرسم ============================ */
  function drawChart() {
    var c = document.getElementById("chart");
    if (!c) return;
    var dpr = window.devicePixelRatio || 1;
    var W = c.clientWidth, H = 210;
    c.width = W * dpr; c.height = H * dpr;
    var x = c.getContext("2d"); x.scale(dpr, dpr);
    x.clearRect(0, 0, W, H);
    x.strokeStyle = "#1c2634"; x.lineWidth = 1;
    for (var i = 0; i <= 4; i++) { var y = (H / 4) * i; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    var pts = S.line;
    if (view === "end") {
      pts = pts.slice();
      var terminal = Object.assign({ m: S.month }, S.st);
      if (pts.length && pts[pts.length - 1].m === S.month) pts[pts.length - 1] = terminal;
      else pts.push(terminal);
    }
    if (pts.length < 2) { x.fillStyle = "#63768c"; x.fillText("لا بيانات كافية", 10, 30); return; }
    function X(i) { return W - (i / (SY.MONTHS_TOTAL - 1)) * W; } // RTL: الزمن من اليمين
    var keys = ["leg", "coh", "eco", "sov", "mil", "press", "shr"];
    keys.forEach(function (k) {
      x.beginPath(); x.strokeStyle = (k === "press") ? "#e8615f" : colorOf(k); x.lineWidth = 1.8;
      x.setLineDash(k === "shr" ? [6, 4] : []);
      pts.forEach(function (p, i) { var px = X(p.m), py = H - (p[k] / 100) * H; if (i === 0) x.moveTo(px, py); else x.lineTo(px, py); });
      x.stroke();
    });
    x.setLineDash([]);
    var lg = document.getElementById("legend");
    if (lg) lg.innerHTML = keys.map(function (k) {
      return "<span><i style='background:" + (k === "press" ? "#e8615f" : colorOf(k)) + "'></i>" + nameOf(k) + "</span>";
    }).join("");
  }

  /* ============================ الأحداث والقرارات ============================ */
  function choose(i) {
    if (view !== "play" || !lastEv || lastRes) return;
    var o = lastEv.options[i];
    if (!o) return;
    if (o.cost && o.cost.cap && S.res.cap + o.cost.cap < 0 && !confirm("رصيدك السياسي لا يكفي لهذا القرار. تريد المضي رغم ذلك؟")) return;
    lastRes = SY.resolve(S, lastEv, o);
    view = "result";
    stats("choice", lastEv.id, o.statsId);
    render([], true);
    save();
  }
  function bind() {
    var withdraw = document.getElementById("withdrawStats"); if (withdraw) withdraw.onclick = function () { stats("consent", false); render([]); };
    var toggle = document.getElementById("sideToggle");
    if (toggle) toggle.onclick = function () {
      sideOpen = !sideOpen;
      document.getElementById("statePanel").hidden = !sideOpen;
      document.getElementById("decisionLayout").classList.toggle("side-closed", !sideOpen);
      toggle.setAttribute("aria-expanded", String(sideOpen));
      toggle.textContent = sideOpen ? "طي المؤشرات" : "عرض المؤشرات";
      if (sideOpen && tab === "chart") drawChart();
    };
    Array.prototype.forEach.call(document.querySelectorAll(".opt"), function (b) { b.onclick = function () { choose(+b.getAttribute("data-i")); }; });
    var n = document.getElementById("nextBtn"); if (n) n.onclick = function () { if (view !== "result") return; view = "play"; lastRes = null; nextMonth(false); };
    var s = document.getElementById("saveBtn"); if (s) s.onclick = function () { if (save()) s.textContent = "✓ حُفظ"; };
    var rp = document.getElementById("reportBtn"); if (rp) rp.onclick = downloadReport;
    var rb = document.getElementById("restartBtn"); if (rb) rb.onclick = function () { if (confirm("بدء جولة جديدة؟")) showStart(); };
    var hb = document.getElementById("helpBtn"); if (hb) hb.onclick = function () { showStart(); };
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.onclick = function () { tab = t.getAttribute("data-tab"); render([]); var buttons = document.querySelectorAll(".tab"); Array.prototype.forEach.call(buttons, function (b) { if (b.getAttribute("data-tab") === tab) b.focus(); }); };
    });
  }

  /* ============================ تقرير ============================ */
  function reportText() {
    var sc = SY.score(S), L = [];
    L.push("محاكي قرار سوريا — تقرير القيادة");
    L.push("الجولة: 8 ديسمبر 2024 ← " + SY.monthLabel(S.month) + "   |   البذرة: " + S.seed + "   |   الصعوبة: " + difficultyName(S.diff));
    L.push("العقيدة: " + (S.doctrine ? S.doctrine.t : "-") + "   المستشارون: " + S.cabinet.map(function (a) { return a.t; }).join("، "));
    L.push("");
    L.push("=== المحصلة ===");
    L.push("التقدير: " + sc.grade + "  (" + num(sc.final) + "/100)");
    Object.keys(SY.STATS).forEach(function (k) { L.push(nameOf(k) + ": " + num(S.st[k])); });
    Object.keys(SY.NEG).forEach(function (k) { L.push(nameOf(k) + ": " + num(S.st[k])); });
    Object.keys(SY.AXIS).forEach(function (k) { L.push(nameOf(k) + ": " + num(S.st[k]) + " (محور محايد)"); });
    L.push("الخزينة: " + num(S.res.cash) + " مليار $   الرصيد السياسي: " + Math.round(S.res.cap));
    L.push("");
    L.push("=== القرارات (" + S.log.length + ") ===");
    S.log.forEach(function (l, i) {
      L.push("\n" + (i + 1) + ") [" + l.month + "] " + l.ev + "  (" + (l.cat || "") + ")");
      L.push("   القرار: " + l.opt + (l.tier ? "  — نتيجة: " + (l.tier === "ok" ? "نجح" : l.tier === "mid" ? "جزئي" : "انقلب") + " (فرصة " + num(l.p) + "%)" : ""));
      L.push("   الأثر: " + Object.keys(l.eff || {}).map(function (k) { return nameOf(k) + " " + (l.eff[k] > 0 ? "+" : "") + num(l.eff[k]); }).join(" | "));
      L.push("   ما جرى: " + l.txt);
    });
    if (S.over && S.over.id && S.over.id.indexOf("X_") === 0) { L.push(S.month < SY.MONTHS_TOTAL - 1 ? "\n=== نهاية مبكرة ===" : "\n=== انهيار ==="); L.push(S.over.t + " — " + S.over.d); }
    L.push("\n" + pendingEnd());
    return L.join("\n");
  }
  function downloadReport() {
    var b = new Blob([reportText()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "تقرير-قرارات-سوريا.txt";
    document.body.appendChild(a); a.click(); a.remove();
    if (URL.revokeObjectURL) setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ============================ النهاية ============================ */
  function finish() {
    var end = S.over || SY.ending(S, D.endings).end;
    if (end) stats("end", end.id);
    showEnd(); document.getElementById("again").focus(); save();
  }
  function pendingEnd() {
    return "التزامات معلّقة بعد الجولة: " + S.delay.length + " آثار متأجلة، " + S.queue.length + " أحداث، " + S.promises.length + " وعود.";
  }
  function showEnd() {
    view = "end";
    var sc = SY.score(S);
    var early = S.over && S.over.id && S.over.id.indexOf("X_") === 0;
    var e = early ? { title: S.over.t, desc: S.over.d } : SY.ending(S, D.endings).end;
    var realNote = "هذه حصيلة قواعد المحاكاة واختياراتك، وليست تقييمًا علميًا للواقع أو حكمًا على مجتمع أو اتجاه سياسي. الأوزان والاحتمالات افتراضات قابلة للمراجعة، والسيناريوهات المستقبلية ليست وقائع.";
    var h = '<div class="wrap"><div class="card finalhead">' +
      '<div class="chip">' + (early ? (S.month < SY.MONTHS_TOTAL - 1 ? "نهاية مبكرة — " : "انهيار — ") + SY.monthLabel(S.month) : "النهاية — ديسمبر 2027") + "</div>" +
      '<div class="big">' + esc(e.title) + "</div>" +
      '<p style="max-width:820px;margin:0 auto">' + rich(e.desc) + "</p>" +
      '<div class="scorebox"><div><b>' + sc.grade + "</b><span>التقدير</span></div>" +
      "<div><b>" + num(sc.final) + "</b><span>النتيجة من 100</span></div>" +
      "<div><b>" + num(sc.avg) + "</b><span>متوسط المؤشرات</span></div>" +
      "<div><b>" + esc(num(S.st.press)) + "</b><span>الضغط الإسرائيلي</span></div>" +
      "<div><b>" + Math.round(sc.compAvg) + "</b><span>ثقة المكونات</span></div></div>" +
      '<div class="reality" style="max-width:820px;margin:0 auto"><div class="rt">خط المرجع</div>' + realNote + "</div><p>" + esc(pendingEnd()) + "</p>" +
      '<div style="margin-top:16px"><button class="btn" id="again">جولة جديدة</button> <button class="btn ghost" id="dl">تحميل تقرير قراراتي</button>' +
      (stats("enabled") ? ' <button class="btn ghost" id="withdrawStats">سحب موافقة الإحصاءات</button>' : '') + '</div></div>';

    h += '<div class="two"><div class="card"><h2>لوحة الحالة النهائية</h2>' +
      Object.keys(SY.STATS).map(function (k) { return '<div class="kv"><span>' + nameOf(k) + "</span><b>" + esc(num(S.st[k])) + "</b></div>"; }).join("") +
      Object.keys(SY.NEG).map(function (k) { return '<div class="kv"><span>' + nameOf(k) + "</span><b>" + esc(num(S.st[k])) + "</b></div>"; }).join("") +
      Object.keys(SY.AXIS).map(function (k) { return '<div class="kv"><span>' + nameOf(k) + "</span><b>" + esc(num(S.st[k])) + "</b></div>"; }).join("") +
      '<div class="kv"><span>الخزينة</span><b>' + esc(num(S.res.cash)) + " مليار $</b></div>" +
      '<div class="kv"><span>ما فتحته من مسارات</span><b>' + Object.keys(S.flags).filter(function (x) { return S.flags[x] > 0; }).length + "</b></div></div>" +
      '<div class="card"><h2>تطور المؤشرات عبر 37 شهراً</h2><canvas id="chart"></canvas><div class="legend" id="legend"></div>' +
      '<div class="tiny" style="margin-top:8px">الزمن يتقدم من اليمين إلى اليسار. الخط الأحمر = الضغط الإسرائيلي.</div></div></div>';

    h += '<div class="card"><h2>سجل القرارات (' + S.log.length + ")</h2><div class=\"log\">" +
      S.log.map(function (l, i) {
        var tg = l.tier ? '<span class="tiertag ' + esc(l.tier) + '">' + (l.tier === "ok" ? "نجح" : l.tier === "mid" ? "جزئي" : "انقلب") + "</span>" : "";
        return '<div class="li"><div class="lh"><span>#' + (i + 1) + " · " + esc(l.month) + " · " + esc(l.cat || "") + "</span>" + tg + '</div><div class="lt">' + esc(l.ev) + '</div><div class="lo">← ' + esc(l.opt) + '</div><div class="lx">' + esc(l.txt) + "</div></div>";
      }).join("") + "</div></div></div>";

    document.getElementById("app").innerHTML = h;
    document.getElementById("again").onclick = showStart;
    document.getElementById("dl").onclick = downloadReport;
    var withdraw = document.getElementById("withdrawStats"); if (withdraw) withdraw.onclick = function () { stats("consent", false); showEnd(); };
    drawChart();
    window.scrollTo(0, 0);
  }

  /* ============================ إقلاع ============================ */
  function boot(data) {
    D = data;
    D.byId = Object.create(null);
    (D.events || []).forEach(function (e) { D.byId[e.id] = e; });
    var RISK = { "مرتفع": 1, "متوسط": 1, "منخفض": 1 };
    (D.events || []).forEach(function (e) {
      if (!RISK[e.risk]) e.risk = (String(e.risk || "").indexOf("عال") === 0) ? "مرتفع" : "متوسط";
    });
    document.addEventListener("keydown", function (e) {
      if (e.repeat || (e.target && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(e.target.tagName) || e.target.isContentEditable || (e.target.closest && e.target.closest('input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"]'))))) return;
      if (view === "play" && !lastRes) {
        var k = String(e.key || "").replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); });
        if (["1", "2", "3", "4", "5"].indexOf(k) >= 0) choose(+k - 1);
        if (["a", "b", "c", "d"].indexOf(k.toLowerCase()) >= 0) choose("abcd".indexOf(k.toLowerCase()));
      } else if (view === "result" && lastRes && e.key === "Enter") { view = "play"; lastRes = null; nextMonth(false); }
    });
    showStart();
  }
  return { boot: boot };
})();
if (typeof SY_DATA !== "undefined") UI.boot(SY_DATA);
