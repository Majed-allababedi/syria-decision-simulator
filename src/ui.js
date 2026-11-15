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
  var tab = "gauges";
  var LS = "syria_sim_v2_save";

  var ADVISERS = [
    { id: "tech",  t: "مصرفي تقنوقراطي",  d: "خصم من كلفة القرارات الاقتصادية +5% نجاحاً فيها", cat: "اقتصادي", v: 6 },
    { id: "hawk",  t: "ضابط أمني صارم",   d: "+6% نجاح في القرارات الأمنية والعسكرية", cat: "أمني", v: 6 },
    { id: "dipl",  t: "دبلوماسي مخضرم",   d: "+6% نجاح في القرارات الدبلوماسية", cat: "دبلوماسي", v: 6 },
    { id: "shaykh",t: "مستشار ديني مؤثر", d: "+6% في قرارات المجتمع والهوية (بما فيها مسار الشريعة والأحوال الشخصية)", cat: "مجتمع", v: 6 },
    { id: "kurd",  t: "وسيط مكونات (كردي/درزي)", d: "+6% في قرارات المكونات والثقة العامة", cat: "مكونات", v: 6 },
    { id: "econ",  t: "وزير إعادة إعمار",  d: "+1.2 مليار $ بدايةً، لكن أثرها على الخدمات أعلى", cash: 1.2 }
  ];
  var DOCTRINES = [
    { id: "security", t: "الأمن أولاً", d: "+3 أمن و+3 جيش بدايةً، −3 شرعية مؤسساتية", eff: { sec: 3, mil: 3, dem: -3 }, bonusCat: "أمني" },
    { id: "bread",    t: "الخبز أولاً", d: "+3 خدمات و+2 اقتصاد، −2 جيش", eff: { srv: 3, eco: 2, mil: -2 }, bonusCat: "اقتصادي" },
    { id: "consensus",t: "التوافق أولاً", d: "+4 تماسك و+3 شرعية، −2 أمن", eff: { coh: 4, leg: 3, sec: -2 }, bonusCat: "مكونات" },
    { id: "sovereign",t: "السيادة أولاً", d: "+4 سيادة و+2 رصيد دبلوماسي، −3 مع أنقرة", eff: { sov: 4, dip: 2, r_tr: -3 }, bonusCat: "دبلوماسي" },
    { id: "sharia",   t: "المرجعية أولاً", d: "+12 مرجعية الشريعة و+2 شرعية، −3 تماسك و−3 مع أوروبا", eff: { shr: 12, leg: 2, coh: -3, r_eu: -3 }, bonusCat: "مجتمع" }
  ];

  /* ---------- أدوات عرض ---------- */
  function esc(x) { return String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function nameOf(k) {
    if (SY.STATS[k]) return SY.STATS[k].n;
    if (SY.NEG[k]) return SY.NEG[k].n;
    if (SY.AXIS[k]) return SY.AXIS[k].n;
    if (k === "cash") return "الخزينة";
    if (k === "cap") return "الرصيد السياسي";
    if (k.indexOf("r_") === 0) return "علاقة: " + (SY.REL[k.slice(2)] || k.slice(2));
    if (k.indexOf("p_") === 0) return "ثقة: " + (SY.POP[k.slice(2)] || k.slice(2));
    if (k.indexOf("t_") === 0) return "تهديد: " + (SY.THR[k.slice(2)] || k.slice(2));
    return k;
  }
  function isNeg(k) { return (k === "press" || k === "frag" || k.indexOf("t_") === 0); }
  function colorOf(k) {
    return "var(--r-" + (k.indexOf("r_") === 0 ? "dip" : k.indexOf("p_") === 0 ? "sov" : k.indexOf("t_") === 0 ? "press" : k) + ")";
  }
  function effPills(eff) {
    var keys = Object.keys(eff || {});
    if (!keys.length) return '<span class="eff nu">بلا أثر رقمي مباشر</span>';
    return keys.map(function (k) {
      var v = eff[k];
      var neg = isNeg(k);
      var good = neg ? v < 0 : v > 0;
      var cls = SY.AXIS[k] ? "ax" : (v === 0 ? "nu" : good ? "up" : "dn");
      var val = k === "cash" ? (v > 0 ? "+" : "") + v + " مليار$" : (v > 0 ? "+" : "") + v;
      return '<span class="eff ' + cls + '">' + esc(nameOf(k)) + " " + val + "</span>";
    }).join("");
  }

  /* ============================ شاشة البداية ============================ */
  function showStart() {
    view = "start";
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) {}
    var evCount = D.events.length, hist = D.events.filter(function (e) { return !e.shock; }).length;
    var html = '<div class="hero">' +
      '<h1>محاكي قرار سوريا<span style="color:#fff;font-weight:300"> — من التحرير إلى 2027</span></h1>' +
      '<div class="tag">سبعة وثلاثون شهراً، ' + evCount + ' حدثاً مبنية على وقائع موثّقة حتى نوفمبر 2026. أنت من يمسك القلم في دمشق.</div>' +
      '<div class="flagline"><span class="chip">8 ديسمبر 2024 → ديسمبر 2027</span>' +
      '<span class="chip cat">' + hist + ' حدثاً تاريخياً</span>' +
      '<span class="chip shock">' + (evCount - hist) + ' صدمة محتملة</span>' +
      '<span class="chip">يعمل دون إنترنت</span></div>' +
      '<div class="stat3">' +
      '<div class="mini-card"><b>الورثة الثقيلة</b>جيش مفكك (70–80% من السلاح الاستراتيجي دُمّر)، خزينة شبه فارغة، 90% تحت خط الفقر، واحتلال للمنطقة العازلة.</div>' +
      '<div class="mini-card"><b>أربع جبهات معاً</b>الجولان المحتل، والسويداء، والملف الكردي، وإعادة بناء الدولة — لا يمكن كسب واحدة بخسارة البقية.</div>' +
      '<div class="mini-card"><b>معيارك</b>لا "نصر" مطلق: تُقيَّم بعدد السوريين الذين يعيشون بكرامة وأمان في ديسمبر 2027.</div>' +
      '</div></div>';

    html += '<div class="card"><h2>⚙️ إعداد الجولة</h2>' +
      '<div class="pickers">' +
      '<div class="pick"><h4>مستوى الصعوبة</h4>' +
      '<label><input type="radio" name="diff" value="easy"> سهل<span class="pd">احتمالات أنجح وأثر الانجراف الأخف</span></label>' +
      '<label><input type="radio" name="diff" value="normal" checked> واقعي<span class="pd">معايرة على وقائع 2024–2026</span></label>' +
      '<label><input type="radio" name="diff" value="hard"> قاسٍ<span class="pd">القرارات الحادة تنقلب غالباً</span></label>' +
      '</div>' +
      '<div class="pick"><h4>مستشارو المرحلة (اثنان)</h4>' +
      ADVISERS.map(function (a) { return '<label><input type="checkbox" name="adv" value="' + a.id + '"> ' + esc(a.t) + '<span class="pd">' + esc(a.d) + "</span></label>"; }).join("") +
      "</div>" +
      '<div class="pick"><h4>عقيدة الحكم</h4>' +
      DOCTRINES.map(function (d) { return '<label><input type="radio" name="doc" value="' + d.id + '"> ' + esc(d.t) + '<span class="pd">' + esc(d.d) + "</span></label>"; }).join("") +
      "</div></div>" +
      '<div class="nextrow"><div class="tiny">بذرة عشوائية للنتائج: <span class="hl" id="seedlab">' + (Math.floor(Math.random() * 99999) + 1) + "</span> — يمكن استئناف الجولة لاحقاً.</div>" +
      "<div>" + (saved ? '<button class="btn ghost" id="resume">استئناف جولة محفوظة</button> ' : "") +
      '<button class="btn" id="go">ابدأ — 8 ديسمبر 2024</button></div></div></div>';

    html += helpCard();
    document.getElementById("app").innerHTML = '<div class="wrap">' + html + "</div>";
    document.getElementById("go").onclick = start;
    var r = document.getElementById("resume"); if (r) r.onclick = resume;
  }

  function helpCard() {
    return '<div class="two"><div class="card"><h2>🎮 كيف تلعب</h2><ul style="padding-right:20px">' +
      '<li>كل شهر حدث واحد (أو صدمة). لك <b>37 شهراً</b> حتى ديسمبر 2027.</li>' +
      '<li>اختر بـ <span class="chip">1 2 3 4</span> أو بالفأرة، ثم <span class="chip">Enter</span> للمتابعة.</li>' +
      '<li>بعض القرارات تكلّف <b>خزينة</b> أو <b>رصيداً سياسياً</b>؛ الرصيد هو ما تملكه من ثقة لتشتري به قراراً مؤلماً.</li>' +
      '<li>الاحتمال المعروض يُحسب من مؤشراتك: الجاهزية والأمن يرفعان نجاح الحسم، والاحتقان يخفضه.</li>' +
      '<li>لكل قرار <b>ثلاثة مستويات نتيجة</b> (نجح / نصف نجاح / انقلب) — لا شيء مضمون.</li>' +
      '<li>مربّع <span style="color:var(--green)">الواقع</span> يخبرك بما جرى فعلاً في هذا التاريخ، لتقارن قرارك بالتاريخ.</li>' +
      '<li>الانجراف الشهري حقيقي: ضغط إسرائيلي مرتفع ينهش السيادة، والفقـر ينهش الشرعية.</li></ul></div>' +
      '<div class="card"><h2>📊 المؤشرات ومحور الهوية</h2><div class="rows">' +
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
    S = SY.initialState(seed);
    var dv = document.querySelector('input[name=diff]:checked');
    S.diff = dv ? dv.value : "normal";
    S.difficulty = { easy: 1.18, normal: 1.0, hard: 0.84 }[S.diff];
    var advs = Array.prototype.slice.call(document.querySelectorAll('input[name=adv]:checked')).slice(0, 2).map(function (i) {
      return ADVISERS.filter(function (a) { return a.id === i.value; })[0];
    }).filter(Boolean);
    if (advs.length < 2) { alert("اختر مستشارين اثنين على الأقل."); return; }
    S.cabinet = advs;
    advs.forEach(function (a) { if (a.cash) S.res.cash += a.cash; });
    var dcv = document.querySelector('input[name=doc]:checked');
    var doc = DOCTRINES.filter(function (x) { return x.id === dcv.value; })[0];
    S.doctrine = doc; SY.applyEff(S, doc.eff); SY.addFlags(S, ["doc_" + doc.id]);
    S.line.push({ m: 0, leg: S.st.leg, coh: S.st.coh, eco: S.st.eco, mil: S.st.mil, sov: S.st.sov, dip: S.st.dip, sec: S.st.sec, dem: S.st.dem, srv: S.st.srv, press: S.st.press, frag: S.st.frag, shr: S.st.shr, cash: S.res.cash });
    nextMonth(true);
  }
  function resume() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS));
      if (!raw) return;
      S = raw;
      S.rng = (function (seed) {
        var s = seed >>> 0;
        return function () { s += 0x6D2B79F5; s >>>= 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      })(S.seed + S.month * 977);
      showPlay();
    } catch (e) { alert("تعذّر استئناف الجولة."); }
  }
  function showPlay() {
    var ev = SY.pickEvent(S, D);
    if (!ev) return nextMonth(false);
    S.used[ev.id] = 1; S.seen.push(ev.id);
    lastEv = ev; lastRes = null;
    view = "play";
    render([]);
    save();
  }
  function save() {
    if (!S) return;
    try {
      var c = JSON.parse(JSON.stringify(S));
      delete c.rng;
      localStorage.setItem(LS, JSON.stringify(c));
    } catch (e) {}
  }

  /* ============================ دورة اللعب ============================ */
  function nextMonth(first) {
    var notes = [];
    if (!first) {
      var a = SY.advance(S);
      notes = a.msgs || [];
      var col = SY.collapse(S);
      if (col) { S.over = col; return showEnd(); }
      if (S.month >= SY.MONTHS_TOTAL - 1) return showEnd();
    }
    var ev = SY.pickEvent(S, D);
    if (!ev) {
      // شهر بلا حدث: أثر انجراف فقط
      S.month++;
      SY.applyEff(S, SY.drift(S));
      return nextMonth(false);
    }
    S.used[ev.id] = 1;
    S.seen.push(ev.id);
    lastEv = ev; lastRes = null;
    view = "play";
    render(notes);
    save();
  }

  function render(notes) {
    var st = S.st;
    var ev = lastEv;
    var riskCls = ev.risk === "مرتفع" ? "risk-high" : ev.risk === "متوسط" ? "risk-med" : "risk-low";
    var h = "";

    /* --- شريط علوي --- */
    h += '<div class="top"><div class="wrap" style="padding:0"><div class="topin">' +
      '<div class="brand"><div class="logo">🇸🇾</div><div><h1>محاكي قرار سوريا</h1><small>' + (S.doctrine ? esc(S.doctrine.t) : "") + " · مستشارون: " + esc(S.cabinet.map(function (a) { return a.t; }).join("، ")) + "</small></div></div>" +
      '<div class="monthbox"><div><div class="mt">' + SY.monthLabel(S.month) + '</div><div class="mn">الشهر ' + (S.month + 1) + " / " + SY.MONTHS_TOTAL + " · " + esc(S.diff === "easy" ? "سهل" : S.diff === "hard" ? "قاسٍ" : "واقعي") + "</div></div>" +
      '<div style="width:150px"><div class="gbar"><i style="width:' + Math.round((S.month / (SY.MONTHS_TOTAL - 1)) * 100) + '%;background:linear-gradient(90deg,#c99b2e,#e7bf5c)"></i></div></div></div>' +
      '<div class="topbtns">' +
      '<button class="btn ghost sm" id="saveBtn">حفظ</button>' +
      '<button class="btn ghost sm" id="reportBtn">تقرير قراراتي</button>' +
      '<button class="btn ghost sm" id="helpBtn">مساعدة</button>' +
      '<button class="btn danger sm" id="restartBtn">جولة جديدة</button>' +
      "</div></div></div></div>";

    h += '<div class="wrap"><div class="grid"><div class="main">';

    /* --- نشرة الشهر --- */
    var nb = newsFor(S.month);
    if (nb.length || notes.length) {
      h += '<div class="card tight">';
      nb.forEach(function (n) { h += '<div class="note ' + (n.k === "warnc" ? "warnc" : n.k === "goodc" ? "goodc" : "infoc") + '">' + esc(n.t) + "</div>"; });
      notes.forEach(function (n) { h += '<div class="note">' + esc(n.t) + ": " + esc(n.x) + "</div>"; });
      h += "</div>";
    }

    /* --- الحدث --- */
    h += '<div class="card"><div class="eventhead">' +
      '<span class="chip cat">' + esc(ev.cat || "عام") + "</span>" +
      '<span class="chip ' + riskCls + '">خطورة: ' + esc(ev.risk || "متوسطة") + "</span>" +
      (ev.shock ? '<span class="chip shock">⚡ صدمة غير متوقعة</span>' : "") +
      (SY.START_MONTH && S.month >= 24 ? '<span class="chip">مسار متوقع — لم يحدث بعد (تاريخ الجلسة: نوفمبر 2026)</span>' : "") +
      (ev.real ? '<span class="chip">موثّق تاريخياً</span>' : "") +
      (ev.verified === "needs-second-source" ? '<span class="chip shock">مصدر واحد — يحتاج تأكيداً</span>' : "") +
      "</div><h2>" + esc(ev.title) + "</h2>" +
      '<div class="brief">' + ev.brief + "</div>" +
      (ev.facts && ev.facts.length ? '<ul class="facts">' + ev.facts.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>" : "") +
      "</div>";

    /* --- النتيجة أو الخيارات --- */
    if (!lastRes) {
      h += '<div class="opts">' + ev.options.map(function (o, i) {
        var p = SY.chance(S, o);
        var cost = [];
        if (o.cost) {
          if (o.cost.cash) cost.push('<span class="pill cost">' + (o.cost.cash > 0 ? "+" : "") + o.cost.cash + " مليار $</span>");
          if (o.cost.cap) cost.push('<span class="pill cost">' + (o.cost.cap > 0 ? "+" : "") + o.cost.cap + " رصيد سياسي</span>");
        }
        var pcls = p === null ? "lock" : p >= 65 ? "p-hi" : p >= 42 ? "p-md" : "p-lo";
        return '<button class="opt" data-i="' + i + '"><span class="key">' + (i + 1) + "</span><b>" + esc(o.t) + "</b><small>" + (o.d || "") + "</small>" +
          '<div class="optmeta">' +
          (p === null ? '<span class="pill lock">بلا مقامرة — النتيجة حتمية</span>' : '<span class="pill ' + pcls + '">فرصة النجاح: ' + p + "%</span>") +
          cost.join("") + "</div></button>";
      }).join("") + "</div>";
    } else {
      var r = lastRes;
      var tcls = "t-" + (r.tier === "ok" ? "ok" : r.tier === "mid" ? "mid" : "bad");
      var head = r.roll ? '<div class="ot">' + (r.tier === "ok" ? "✓ نجح القرار" : r.tier === "mid" ? "◐ نجح جزئياً" : "✗ انقلب القرار") + ' <span class="tiny">(' + r.roll.p + "% متوقع · الرمية " + r.roll.r + ")</span></div>" : '<div class="ot">نُفّذ القرار</div>';
      h += '<div class="card"><h2>النتيجة</h2><div class="outcome ' + tcls + '">' + head + "<div>" + r.txt + '</div><div class="effs">' + effPills(r.eff) + "</div></div>" +
        (lastRes.decree ? '<div class="reality"><div class="rt">مرسوم اضطراري</div>رصيدك السياسي لم يكن يكفي هذا القرار فمرَّ بمرسوم: ارتفع الاحتقان وتآكلت الشرعية المؤسساتية بمقدار العجز (' + lastRes.decree + ').</div>' : "") +
        (lastEv.real ? '<div class="reality"><div class="rt">الواقع — ما جرى فعلاً</div>' + lastEv.real + "</div>" : "") +
        '<div class="nextrow"><div class="tiny">' + pendingHint() + '</div><button class="btn" id="nextBtn">الشهر التالي ←</button></div></div>';
    }

    h += "</div>"; // main

    /* --- الشريط الجانبي --- */
    h += '<div class="side">' + sidebar() + "</div>";
    h += "</div></div>";

    document.getElementById("app").innerHTML = h;
    bind();
    if (tab === "chart") drawChart();
    window.scrollTo(0, 0);
  }

  function pendingHint() {
    var n = S.delay.filter(function (d) { return d.at <= S.month + 4; }).length;
    var q = S.queue.length;
    var pr = S.promises || [];
    var bits = [];
    if (n) bits.push("‏" + n + " أثراً متأجلاً سيظهر خلال 4 أشهر");
    if (q) bits.push("‏" + q + " حدثاً مفتوحاً بقرارك");
    pr.forEach(function (x) {
      bits.push("وعد: " + nameOf(x.metric) + " ≥ " + x.target + " في " + SY.monthLabel(x.due) +
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
        '<div class="gl"><span>' + (meta.ic || "") + " " + esc(nameOf(k)) + "</span><span>" + dlab + '<span class="gv">' + v + "</span></span></div>" +
        '<div class="gbar"><i style="width:' + v + '%;background:' + barColor + '"></i></div></div>';
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
    return '<span class="mini ' + cls + '"><i style="width:' + v + '%"></i></span>';
  }
  function panelState() {
    var f = Object.keys(S.flags).filter(function (k) { return S.flags[k] > 0; });
    var h = '<div class="card tight"><h3 style="margin-top:0">العلاقات الخارجية</h3><div class="rows">' +
      Object.keys(SY.REL).map(function (k) {
        return '<div class="row"><span class="rn">' + SY.REL[k] + '</span>' + bar(S.rel[k], "") + '<span class="val">' + S.rel[k] + "</span></div>";
      }).join("") + "</div>" +
      "<h3>ثقة المكونات</h3><div class='rows'>" +
      Object.keys(SY.POP).map(function (k) {
        return '<div class="row"><span class="rn">' + SY.POP[k] + "</span>" + bar(S.pop[k], "pop") + '<span class="val">' + S.pop[k] + "</span></div>";
      }).join("") + "</div>" +
      "<h3>بؤر التهديد</h3><div class='rows'>" +
      Object.keys(SY.THR).map(function (k) {
        return '<div class="row"><span class="rn">' + SY.THR[k] + "</span>" + bar(S.thr[k], "thr") + '<span class="val">' + S.thr[k] + "</span></div>";
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
    return x.replace(/_/g, " ");
  }
  function panelArchive() {
    if (!S.log.length) return '<div class="card tight"><span class="tiny">لم تتخذ قراراً بعد.</span></div>';
    var items = S.log.slice().reverse().map(function (l) {
      var tg = l.tier ? '<span class="tiertag ' + l.tier + '">' + (l.tier === "ok" ? "نجح" : l.tier === "mid" ? "جزئي" : "انقلب") + " " + l.p + "%</span>" : "";
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
    if (!lastEv || lastRes) return;
    var o = lastEv.options[i];
    if (!o) return;
    if (o.cost && o.cost.cap && S.res.cap + o.cost.cap < 0 && !confirm("رصيدك السياسي لا يكفي لهذا القرار. تريد المضي رغم ذلك؟")) return;
    lastRes = SY.resolve(S, lastEv, o);
    view = "result";
    render([]);
    save();
  }
  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll(".opt"), function (b) { b.onclick = function () { choose(+b.getAttribute("data-i")); }; });
    var n = document.getElementById("nextBtn"); if (n) n.onclick = function () { lastRes = null; nextMonth(false); };
    var s = document.getElementById("saveBtn"); if (s) s.onclick = function () { save(); s.textContent = "✓ حُفظ"; };
    var rp = document.getElementById("reportBtn"); if (rp) rp.onclick = downloadReport;
    var rb = document.getElementById("restartBtn"); if (rb) rb.onclick = function () { if (confirm("بدء جولة جديدة؟")) { localStorage.removeItem(LS); showStart(); } };
    var hb = document.getElementById("helpBtn"); if (hb) hb.onclick = function () { showStart(); };
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.onclick = function () { tab = t.getAttribute("data-tab"); render([]); };
    });
  }

  /* ============================ تقرير ============================ */
  function reportText() {
    var sc = SY.score(S), L = [];
    L.push("محاكي قرار سوريا — تقرير القيادة");
    L.push("الجولة: 8 ديسمبر 2024 ← " + SY.monthLabel(S.month) + "   |   البذرة: " + S.seed + "   |   الصعوبة: " + S.diff);
    L.push("العقيدة: " + (S.doctrine ? S.doctrine.t : "-") + "   المستشرون: " + S.cabinet.map(function (a) { return a.t; }).join("، "));
    L.push("");
    L.push("=== المحصلة ===");
    L.push("التقدير: " + sc.grade + "  (" + sc.final + "/100)");
    Object.keys(SY.STATS).forEach(function (k) { L.push(nameOf(k) + ": " + S.st[k]); });
    Object.keys(SY.NEG).forEach(function (k) { L.push(nameOf(k) + ": " + S.st[k]); });
    Object.keys(SY.AXIS).forEach(function (k) { L.push(nameOf(k) + ": " + S.st[k] + " (محور محايد)"); });
    L.push("الخزينة: " + S.res.cash + " مليار $   الرصيد السياسي: " + Math.round(S.res.cap));
    L.push("");
    L.push("=== القرارات (" + S.log.length + ") ===");
    S.log.forEach(function (l, i) {
      L.push("\n" + (i + 1) + ") [" + l.month + "] " + l.ev + "  (" + (l.cat || "") + ")");
      L.push("   القرار: " + l.opt + (l.tier ? "  — نتيجة: " + (l.tier === "ok" ? "نجح" : l.tier === "mid" ? "جزئي" : "انقلب") + " (فرصة " + l.p + "%)" : ""));
      L.push("   الأثر: " + Object.keys(l.eff || {}).map(function (k) { return nameOf(k) + " " + (l.eff[k] > 0 ? "+" : "") + l.eff[k]; }).join(" | "));
      L.push("   ما جرى: " + l.txt);
    });
    if (S.over && S.over.id && S.over.id.indexOf("X_") === 0) { L.push("\n=== نهاية مبكرة ==="); L.push(S.over.t + " — " + S.over.d); }
    return L.join("\n");
  }
  function downloadReport() {
    var b = new Blob([reportText()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "تقرير-قرارات-سوريا.txt";
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ============================ النهاية ============================ */
  function showEnd() {
    view = "end";
    var sc = SY.score(S);
    var early = S.over && S.over.id && S.over.id.indexOf("X_") === 0;
    var e = early ? { title: S.over.t, desc: S.over.d } : SY.ending(S, D.endings).end;
    var realNote = "في الواقع (بلا تدخل قرارك): وصلت سوريا إلى نوفمبر 2026 بشرعية أداء جيدة، سيادة منقوصة في الجنوب، اقتصاد ينمو ~10% مع فقر 90%، وبرلمان بانتخاب غير مباشر. التقدير المرجعي للواقع: 54/100.";
    var h = '<div class="wrap"><div class="card finalhead">' +
      '<div class="chip">' + (early ? "نهاية مبكرة — " + SY.monthLabel(S.month) : "النهاية — ديسمبر 2027") + "</div>" +
      '<div class="big">' + esc(e.title) + "</div>" +
      '<p style="max-width:820px;margin:0 auto">' + e.desc + "</p>" +
      '<div class="scorebox"><div><b>' + sc.grade + "</b><span>التقدير</span></div>" +
      "<div><b>" + sc.final + "</b><span>النتيجة من 100</span></div>" +
      "<div><b>" + sc.avg + "</b><span>متوسط المؤشرات</span></div>" +
      "<div><b>" + S.st.press + "</b><span>الضغط الإسرائيلي</span></div>" +
      "<div><b>" + Math.round(sc.compAvg) + "</b><span>ثقة المكونات</span></div></div>" +
      '<div class="reality" style="max-width:820px;margin:0 auto"><div class="rt">خط المرجع</div>' + realNote + "</div>" +
      '<div style="margin-top:16px"><button class="btn" id="again">جولة جديدة</button> <button class="btn ghost" id="dl">تحميل تقرير قراراتي</button></div></div>';

    h += '<div class="two"><div class="card"><h2>لوحة الحالة النهائية</h2>' +
      Object.keys(SY.STATS).map(function (k) { return '<div class="kv"><span>' + nameOf(k) + "</span><b>" + S.st[k] + "</b></div>"; }).join("") +
      Object.keys(SY.NEG).map(function (k) { return '<div class="kv"><span>' + nameOf(k) + "</span><b>" + S.st[k] + "</b></div>"; }).join("") +
      Object.keys(SY.AXIS).map(function (k) { return '<div class="kv"><span>' + nameOf(k) + "</span><b>" + S.st[k] + "</b></div>"; }).join("") +
      '<div class="kv"><span>الخزينة</span><b>' + S.res.cash + " مليار $</b></div>" +
      '<div class="kv"><span>ما فتحته من مسارات</span><b>' + Object.keys(S.flags).filter(function (x) { return S.flags[x] > 0; }).length + "</b></div></div>" +
      '<div class="card"><h2>تطور المؤشرات عبر 37 شهراً</h2><canvas id="chart"></canvas><div class="legend" id="legend"></div>' +
      '<div class="tiny" style="margin-top:8px">الزمن يتقدم من اليمين إلى اليسار. الخط الأحمر = الضغط الإسرائيلي.</div></div></div>';

    h += '<div class="card"><h2>سجل القرارات (' + S.log.length + ")</h2><div class=\"log\">" +
      S.log.map(function (l, i) {
        var tg = l.tier ? '<span class="tiertag ' + l.tier + '">' + (l.tier === "ok" ? "نجح" : l.tier === "mid" ? "جزئي" : "انقلب") + "</span>" : "";
        return '<div class="li"><div class="lh"><span>#' + (i + 1) + " · " + esc(l.month) + " · " + esc(l.cat || "") + "</span>" + tg + '</div><div class="lt">' + esc(l.ev) + '</div><div class="lo">← ' + esc(l.opt) + '</div><div class="lx">' + esc(l.txt) + "</div></div>";
      }).join("") + "</div></div></div>";

    document.getElementById("app").innerHTML = h;
    document.getElementById("again").onclick = function () { localStorage.removeItem(LS); showStart(); };
    document.getElementById("dl").onclick = downloadReport;
    drawChart();
    window.scrollTo(0, 0);
  }

  /* ============================ إقلاع ============================ */
  function boot(data) {
    D = data;
    var RISK = { "مرتفع": 1, "متوسط": 1, "منخفض": 1 };
    (D.events || []).forEach(function (e) {
      if (!RISK[e.risk]) e.risk = (String(e.risk || "").indexOf("عال") === 0) ? "مرتفع" : "متوسط";
    });
    document.addEventListener("keydown", function (e) {
      if (view === "play" && !lastRes) {
        var k = e.key;
        if (["1", "2", "3", "4", "5"].indexOf(k) >= 0) choose(+k - 1);
        if (["a", "b", "c", "d"].indexOf(k.toLowerCase()) >= 0) choose("abcd".indexOf(k.toLowerCase()));
      } else if (lastRes && e.key === "Enter") { lastRes = null; nextMonth(false); }
    });
    showStart();
  }
  return { boot: boot };
})();
if (typeof SY_DATA !== "undefined") UI.boot(SY_DATA);
