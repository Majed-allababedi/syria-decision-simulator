/* =========================================================================
   محاكي قرار سوريا — المحرك (v2)
   من 8 ديسمبر 2024 (سقوط النظام) حتى ديسمبر 2027
   المحرك مستقل عن البيانات: كل الأحداث في src/data/*.json
   ========================================================================= */
"use strict";
var SY = (function () {

  /* ---------- 1) قاموس المؤشرات ---------- */
  // مؤشرات إيجابية (0-100، الأعلى أفضل)
  var STATS = {
    leg:  { n: "شرعية الحكم",        s: "ثقة الشارع والمؤسسات بقرار القيادة", ic: "🏛️" },
    coh:  { n: "التماسك الوطني",     s: "وحدة المكونات ومنع الانفلات الأهلي",   ic: "🤝" },
    sec:  { n: "الأمن واحتكار السلاح", s: "أمان الشارع وسيطرة الدولة على السلاح", ic: "🚓" },
    eco:  { n: "الاقتصاد",           s: "نمو، تشغيل، قدرات شرائية، استثمار",    ic: "📈" },
    srv:  { n: "الخدمات والبنية",    s: "كهرباء، ماء، صحة، تعليم، نقل",        ic: "💡" },
    mil:  { n: "الجاهزية العسكرية",  s: "جيش منضبط ودفاع جوي ومسيرات",         ic: "🛡️" },
    sov:  { n: "السيادة",            s: "حضور الدولة على كامل الأرض والقرار",    ic: "🗺️" },
    dip:  { n: "الرصيد الدبلوماسي",   s: "واشنطن، الخليج، أوروبا، الأمم المتحدة", ic: "🌐" },
    dem:  { n: "الشرعية المؤسساتية", s: "دستور، برلمان مفوَّض، قضاء مستقل",     ic: "⚖️" }
  };
  // مؤشرات سالبة (0-100، الأعلى أسوأ)
  var NEG = {
    press: { n: "الضغط الإسرائيلي", s: "غارات وتوغل وتهديد وقضم أرض", ic: "🔥" },
    frag:  { n: "الاحتقان والانفلات", s: "قابلية الانفجار الأهلي والأمني", ic: "💥" }
  };
  var RES = {
    cash: { n: "الخزينة", u: "مليار $", max: 60, s: "ما تملكه الدولة فعلياً للإنفاق" },
    cap:  { n: "الرصيد السياسي", u: "/100", max: 100, s: "ما تستطيع إنفاقه على قرارات مؤلمة" }
  };
  // محور هوية: محايد — لا يُكسِب ولا يُخسِر في حد ذاته، بل يقرّر مَن يرضى ومَن يغضب.
  // لا يدخل في متوسط النتيجة، لكنه يغيّر ديناميكا المكونات والتمويل وسخط المقاتلين.
  var AXIS = {
    shr: {
      n: "مرجعية الشريعة في التشريع", ic: "🕌",
      s: "موضع الدين من التشريع والقضاء — وعد القيادة لمقاتليها قبل النصر وبعده",
      lo: "دولة مدنية بقانون", hi: "تحكيم كامل للشريعة"
    }
  };
  var REL = {
    us:   "واشنطن", eu: "أوروبا", gulf: "الخليج", tr: "أنقرة",
    ru:   "موسكو",  il: "تل أبيب", ir: "طهران",   arab: "العرب والأمم"
  };
  var POP = {
    sunn: "القاعدة السنية", alaw: "العلويون", druze: "الدروز",
    kurd: "الكرد", christ: "المسيحيون", trib: "العشائر"
  };
  var THR = { isis: "داعش", rem: "فلول النظام", war: "فصائل خارج السيطرة" };

  var START_MONTH = { y: 2024, m: 12 };
  var MONTHS_TOTAL = 37; // ديسمبر 2024 ... ديسمبر 2027

  var MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  /* ---------- 2) أدوات ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rngFactory(seed) {
    var s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5; s >>>= 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function monthLabel(i) {
    var idx = START_MONTH.m - 1 + i;
    var y = START_MONTH.y + Math.floor(idx / 12);
    return MONTHS_AR[idx % 12] + " " + y;
  }

  /* ---------- 3) الحالة الابتدائية ----------
     القيم مأخوذة من وقائع ديسمبر 2024: جيش مُدمَّر (70-80% من السلاح
     الاستراتيجي ضُرب)، سيادة ناقصة (احتلال المنطقة العازلة)، سيولة صفرا،
     شرعية نصر عالية جداً، تفاؤل خارجي حذر. */
  function initialState(seed) {
    return {
      seed: seed,
      month: 0,
      diff: "واقعي",
      difficulty: 1.0,
      st: {
        leg: 74, coh: 46, sec: 34, eco: 22, srv: 18, mil: 20, sov: 30, dip: 40, dem: 12,
        press: 78, frag: 62,
        shr: 48   // الوعد قائم (الفقه «مصدر رئيسي» في الإعلان الدستوري) والتنفيذ مؤجَّل
      },
      res: { cash: 0.6, cap: 70 },
      rel: { us: 22, eu: 30, gulf: 55, tr: 72, ru: 38, il: 8, ir: 10, arab: 45 },
      pop: { sunn: 72, alaw: 22, druze: 30, kurd: 30, christ: 35, trib: 48 },
      thr: { isis: 55, rem: 62, war: 66 },
      cabinet: [],
      doctrine: null,
      flags: {},
      shrHigh: 48,   // أعلى مستوى بلغه محور الشريعة (لسُلّم التراجع)
      used: {},
      queue: [],        // أحداث مجدولة: {id, at}
      delay: [],        // آثار مؤجلة: {at, eff, txt, from}
      log: [],          // سجل القرارات
      line: [],         // لقطات المؤشرات لرسم المنحنى
      seen: [],
      notes: {},        // ملاحظات الحالة لكل شهر
      over: null,
      rng: rngFactory(seed || 1)
    };
  }

  /* ---------- 4) تطبيق الآثار ---------- */
  function applyEff(S, eff) {
    if (!eff) return;
    for (var k in eff) {
      var v = eff[k];
      if (k in S.st) S.st[k] = clamp(S.st[k] + v, 0, 100);
      else if (k in S.res) {
        if (k === "cash") S.res.cash = Math.max(-5, +(S.res.cash + v).toFixed(2));
        else S.res.cap = clamp(S.res.cap + v, 0, 100);
      }
      else if (k.indexOf("r_") === 0) { var a = k.slice(2); if (a in S.rel) S.rel[a] = clamp(S.rel[a] + v, 0, 100); }
      else if (k.indexOf("p_") === 0) { var b = k.slice(2); if (b in S.pop) S.pop[b] = clamp(S.pop[b] + v, 0, 100); }
      else if (k.indexOf("t_") === 0) { var c = k.slice(2); if (c in S.thr) S.thr[c] = clamp(S.thr[c] + v, 0, 100); }
    }
  }
  function addFlags(S, list) { (list || []).forEach(function (f) { S.flags[f] = (S.flags[f] || 0) + 1; }); }
  function has(S, f) { return !!S.flags[f]; }

  /* ---------- 5) شروط ظهور الأحداث ---------- */
  function condOK(S, w) {
    if (!w) return true;
    var i;
    if (w.flagAll) for (i = 0; i < w.flagAll.length; i++) if (!has(S, w.flagAll[i])) return false;
    if (w.flagAny && w.flagAny.length) {
      var any = false;
      for (i = 0; i < w.flagAny.length; i++) if (has(S, w.flagAny[i])) any = true;
      if (!any) return false;
    }
    if (w.flagNone) for (i = 0; i < w.flagNone.length; i++) if (has(S, w.flagNone[i])) return false;
    if (w.min) for (var k in w.min) if (getVal(S, k) < w.min[k]) return false;
    if (w.max) for (var k2 in w.max) if (getVal(S, k2) > w.max[k2]) return false;
    if (w.monthMin && S.month < w.monthMin) return false;
    if (w.monthMax && S.month > w.monthMax) return false;
    return true;
  }
  function getVal(S, k) {
    if (k in S.st) return S.st[k];
    if (k === "cash") return S.res.cash;
    if (k === "cap") return S.res.cap;
    if (k.indexOf("r_") === 0) return S.rel[k.slice(2)] || 0;
    if (k.indexOf("p_") === 0) return S.pop[k.slice(2)] || 0;
    if (k.indexOf("t_") === 0) return S.thr[k.slice(2)] || 0;
    return 0;
  }

  /* ---------- 6) احتمال نجاح الخيار ---------- */
  function chance(S, opt) {
    if (!opt.prob) return null;
    var base = opt.prob.base;
    var mods = opt.prob.mods || {};
    var adj = 0;
    for (var k in mods) adj += getVal(S, k) * mods[k];
    var cabinetMod = 0;
    (S.cabinet || []).forEach(function (c) { if (c.cat && opt.cat && c.cat === opt.cat) cabinetMod += (c.v || 0); });
    if (S.doctrine && opt.cat && S.doctrine.bonusCat === opt.cat) cabinetMod += 6;
    var p = base + adj + cabinetMod;
    // عقوبات الحالة الحرجة: إفلاس، احتقان حرج، نفاد رصيد سياسي
    if (S.res.cash < -2) p -= 4;
    if (S.st.frag > 75) p -= Math.min(6, (S.st.frag - 75) * 0.24);
    if (S.res.cap < 15) p -= 4;
    // الصعوبة غير متماثلة: السهل يرفع كل الاحتمالات، القاسي يخفضها (بلا قلب للاتجاه)
    if (S.diff === "easy") p += (100 - p) * 0.14;
    else if (S.diff === "hard") p -= p * 0.16;
    return clamp(Math.round(p), 14, 94);
  }

  /* ---------- 7) اختيار حدث الشهر ---------- */
  function pickEvent(S, data) {
    // (أ) أحداث مجدولة مستحقة
    var due = [], keep = [];
    S.queue.forEach(function (q) { if (q.at <= S.month) due.push(q.id); else keep.push(q); });
    S.queue = keep;
    var ev = null;
    for (var i = 0; i < due.length && !ev; i++) {
      var c = data.byId[due[i]];
      if (c && !S.used[c.id] && condOK(S, c.when)) ev = c;
    }
    // (ب) أحداث الشهر المؤهلة: أولوية + ضغط استحقاق (المهلة ترفع الوزن)
    if (!ev) {
      var cands = [];
      data.events.forEach(function (e) {
        if (S.used[e.id]) return;
        if (e.month > S.month) return;
        if (e.ttl && S.month > e.month + e.ttl) return;                // انتهت صلاحية
        if (e.shock) return;
        if (condOK(S, e.when)) cands.push(e);
      });
      cands.forEach(function (e) { e._urg = urgency(S, e) + S.rng() * 4; });
      cands.sort(function (a, b) {
        var d = (b._urg * 6 + (b.pri || 0) * 1.5) - (a._urg * 6 + (a.pri || 0) * 1.5);
        if (d) return d;
        return (a.month - b.month);
      });
      ev = cands[0] || null;
    }
    // (ج) صدمة عشوائية — مقيّدة بنافذتها الزمنية هي أيضاً
    if (!ev || S.rng() < shockChance(S)) {
      var shocks = data.events.filter(function (e) {
        if (!e.shock || S.used[e.id]) return false;
        var win = Math.max(1, e.ttl || 1);
        if (S.month < e.month - win || S.month > e.month + win) return false;
        return condOK(S, e.when);
      });
      if (shocks.length) ev = shocks[Math.floor(S.rng() * shocks.length)];
    }
    return ev;
  }
  // ضغط الاستحقاق: كلما اقترب موعد انتهاء صلاحية الحدث ارتفع وزنه ليصل 12 نقطة.
  function urgency(S, e) {
    var ttl = e.ttl || 1;
    var left = (e.month + ttl) - S.month;              // أشهر متبقية قبل السقوط
    var p = clamp((ttl - left + 1) / (ttl + 1), 0, 1); // 0 ← جديد … 1 ← آخر شهر
    return 12 * p * p;
  }
  function shockChance(S) {
    var f = 0.22 + (S.thr.isis - 40) * 0.004 + (S.thr.rem - 40) * 0.003 + (S.st.frag - 50) * 0.004 - (S.st.sec - 50) * 0.003;
    return clamp(f, 0.10, 0.50);
  }

  /* ---------- 8) انجراف شهري تلقائي (ديناميكا النظام) ---------- */
  function drift(S) {
    var out = {};
    var d = function (k, v) { if (v) out[k] = (out[k] || 0) + v; };
    var st = S.st;
    // الاحتلال يستنزف السيادة والاقتصاد والشرعية
    if (st.press > 70) { d("sov", -(st.press - 70) * 0.06); d("eco", -0.8); d("leg", -0.6); d("frag", +0.5); }
    else if (st.press < 45) { d("eco", +0.6); d("sov", +0.4); }
    // الاقتصاد: نمو إن كانت السيادة والضغط مقبولين + رصيد دبلوماسي
    var growth = 0.45 + (st.dip - 40) * 0.02 + (st.sec - 45) * 0.015 - (st.frag - 50) * 0.018 - Math.max(0, st.press - 60) * 0.012;
    d("eco", growth);
    // الخدمات تتآكل بلا إنفاق
    d("srv", -0.35 + (S.res.cash > 6 ? 0.3 : 0));
    // الرصيد السياسي يتآكل مع الإخفاق الاقتصادي
    d("cap", (st.eco > 55 ? 0.6 : (st.eco < 25 ? -0.7 : 0.05)));
    // التهديدات
    d("t_isis", (S.thr.war > 50 ? 0.8 : 0) + (st.sec < 45 ? 0.7 : -0.5) + (S.rel.us > 60 ? -0.4 : 0));
    d("t_rem", (st.sec < 40 ? 0.6 : -0.3) + (getVal(S, "p_alaw") > 55 ? -0.5 : 0));
    d("t_war", (st.sec < 40 ? 0.45 : -0.50) + (has(S, "factions_kept") ? 0.35 : 0) - (st.mil > 45 ? 0.25 : 0));
    // الضغط الإسرائيلي يرتفع بالعجز الدبلوماسي وينخفض بالمسار السياسي والقوة العسكرية
    d("press", (st.dip > 60 ? -0.30 : (st.dip < 40 ? 0.25 : 0)) + (st.mil > 55 ? -0.15 : 0) + (st.sov < 25 ? 0.20 : 0));
    // تراكم قدرات الاحتكار الأمني مع الزمن (إن لم تكن في حرب مفتوحة)
    d("sec", (S.thr.war > 70 ? -0.30 : 0.30) + (st.mil > 45 ? 0.20 : -0.10) + (S.st.frag > 80 ? -0.20 : 0));
    // الاحتقان: مزيج ثقة المكونات + اقتصاد + تهديدات
    var compAvg = (S.pop.sunn + S.pop.alaw + S.pop.druze + S.pop.kurd + S.pop.christ + S.pop.trib) / 6;
    d("frag", (50 - compAvg) * 0.008 + (40 - st.eco) * 0.008 + (S.thr.isis - 45) * 0.008 + (S.thr.war - 45) * 0.007 - (st.srv - 45) * 0.014 - (st.coh - 50) * 0.008);
    // الشرعية تنزح مع الخدمات والاقتصاد
    d("leg", (st.srv - 45) * 0.012 + (st.eco - 45) * 0.012 - (st.frag - 50) * 0.01);
    // هجرة الكفاءات ورساميل عند ارتفاع الاحتقان
    d("cash", st.frag > 65 ? -0.10 : (st.eco > 45 ? 0.20 : 0.08));
    // ===== محور تحكيم الشريعة: سوق ضغط ذو اتجاهين =====
    var shrPress = (52 - st.shr) * 0.012;   // انجذاب طبيعي إلى «صيغة الوسط» الدستورية
    if (has(S, "fighters_pledge")) shrPress += 0.35;          // بيعة/وعد للمقاتلين قائم
    if (has(S, "sharia_council_state")) shrPress += 0.25;     // مأسسة المرجعية داخل الدولة
    if (has(S, "salafist_split")) shrPress += 0.30;           // منافسة السلفيين على الشارع الديني
    if (has(S, "minority_pact")) shrPress -= 0.30;            // عقد مع المكونات غير السنية
    if (has(S, "awqaf_purged")) shrPress -= 0.20;             // ضبط المؤسسة الدينية بيدها
    if (st.shr > 70) shrPress -= 0.25;                        // كلفة خارجية/مؤسساتية تدفع للتراجع
    if (st.shr < 32) shrPress += 0.22;                        // ضغط القاعدة يعيد رفع السقف
    d("shr", shrPress);
    // كلفة الانزياح: النزول يُغضب المقاتلين، والصعود يُقلق المكونات والمانحين
    if (st.shr < 32) { d("t_war", 0.22); d("p_sunn", -0.12); d("frag", 0.10); }
    if (st.shr > 72) { d("p_alaw", -0.22); d("p_christ", -0.18); d("p_druze", -0.12); d("r_eu", -0.10); }
    if (st.shr >= 45 && st.shr <= 62 && st.dem > 45) { d("coh", 0.10); d("r_gulf", 0.06); }
    // ===== عدوى المكونات: إهمال مكوّن أقلّي يُعاقَب شهرياً =====
    var bleed = 0;
    ["alaw", "druze", "kurd", "christ"].forEach(function (c) {
      var v = S.pop[c];
      if (v < 20) bleed += (20 - v) / 20;               // 0 … 1 لكل مكوّن خارج العقد
    });
    if (bleed) { d("coh", -0.6 * bleed); d("frag", +0.5 * bleed); d("t_war", +0.4 * bleed); }
    return out;
  }
  // سُلّم الشريعة: عتبات مقفلة — التراجع بعد عبور عتبة يكلف انشقاقاً
  var LADDER = [{ at: 35, cap: -6, frag: 5 }, { at: 60, cap: -12, frag: 10 }, { at: 80, cap: -18, frag: 16 }];
  function ladderCost(S, prevShr) {
    var back = 0;
    LADDER.forEach(function (t, i) { if (S.shrHigh >= t.at && S.st.shr < t.at - 8) back = Math.max(back, i + 1); });
    if (!back) return null;
    var key = "ladder_back" + back;
    if (S.flags[key]) return null;
    S.flags[key] = 1;
    var t = LADDER[back - 1];
    return { cap: t.cap, frag: t.frag, t_war: 4, txt: "التراجع عن استحقاق تشريعي سبق إقراره: المقاتلون يعدّونه نكثاً، والمتشددون يعدّونه ضعفاً." };
  }

  /* ---------- 9) حالات الانهيار ---------- */
  function collapse(S) {
    var st = S.st;
    if (S.month < 2) return null;
    if (st.sec < 10 && st.frag > 80) return { id: "X_collapse", t: "انهار احتكار السلاح", d: "تفككت الأجهزة وباتت ميليشيات وقطاع طرق يديرون المحافظات. الدولة اسم على خريطة." };
    if (st.leg < 12) return { id: "X_legitimacy", t: "انفجر الشارع", d: "شرعية انهارت في الشارع بعد وعود لم تُنفَّذ؛ حراك شعبي يجبر القيادة على الرحيل أو المواجهة الدموية." };
    if (st.mil < 8 && st.press > 82) return { id: "X_deterrence", t: "سقوط الردع", d: "بلا جيش وبلا ضغط منخفض: الجنوب يُبتلع، ودمشق تتفاوض تحت النار على كل شيء." };
    if (S.res.cash < -3 && st.eco < 20) return { id: "X_bankrupt", t: "إفلاس الدولة", d: "رواتب معطلة، ليرة تنهار، مستشفيات تقفل. الانهيار القادم اجتماعي لا عسكري." };
    if (st.coh < 15 && (S.pop.alaw < 12 || S.pop.druze < 12 || S.pop.kurd < 12)) return { id: "X_balkan", t: "تفكك فعلي", d: "مكونات خرجت من العقد الوطني، وخطوط تماس داخلية دائمة: ثلاث سوريات لا دولة واحدة." };
    if (S.month > 6 && st.frag > 94 && st.sec < 28 && (S.thr.war > 72 || S.thr.isis > 76)) return { id: "X_chaos", t: "فوضى عامة", d: "اقتتال في ثلاث مناطق في شهر واحد، واغتيالات بالجملة، والجيش منشغل بنفسه." };
    if (st.shr > 74 && S.pop.alaw < 22 && st.coh < 38) return { id: "X_theo", t: "الهوية قبل العقد", d: "تشريعات سريعة بلا عقد وطني: مكونات حليفة انسحبت من الدولة، وحاضنة المقاتلين وحدها في الشارع." };
    if (st.shr < 26 && S.thr.war > 68 && st.leg < 48) return { id: "X_breach", t: "تمرد الحاضنة", d: "جيل المقاتلين الذين بيعوا على «كتاب الله» خرج على الدولة: خلايا، اعتصامات مسلحة، وخطباء يصفون القصر بالمرتدّ." };
    return null;
  }

  /* ---------- 10) تنفيذ القرار ---------- */
  function resolve(S, ev, opt) {
    var res = { txt: "", eff: {}, roll: null, tier: "ok" };
    var cost = opt.cost || {};
    // كلفة فورية — وإن نفد الرصيد السياسي يمر القرار «بمرسوم» بثمن أعلى
    var deficit = (cost.cap && S.res.cap + cost.cap < 0) ? -(S.res.cap + cost.cap) : 0;
    applyEff(S, cost);
    if (deficit > 0) applyEff(S, { frag: +(deficit * 0.7).toFixed(1), dem: -Math.round(deficit * 0.4), leg: -Math.round(deficit * 0.2) });

    var p = chance(S, opt);
    var tier = "ok";
    if (p !== null) {
      var r = S.rng() * 100;
      res.roll = { p: p, r: Math.round(r), hit: r < p };
      if (r < p) tier = "ok";
      else if (r < p + (100 - p) * 0.45) tier = "mid";
      else tier = "bad";
      res.tier = tier;
    }
    var o = (opt.out && opt.out[tier]) ? opt.out[tier] : null;
    var eff = o ? o.eff : opt.eff;
    res.txt = o ? o.txt : (opt.txt || "تم تنفيذ القرار.");
    res.eff = eff || {};
    res.decree = deficit;
    res.flags = (o && o.flags ? o.flags : []).concat(opt.flags || []);
    applyEff(S, eff);
    addFlags(S, res.flags);
    // آثار مؤجلة
    (opt.delay || []).forEach(function (dl) {
      S.delay.push({ at: S.month + (dl.in || 1), eff: dl.eff, txt: dl.txt, flags: dl.flags });
    });
    // أحداث مقفلة بموعد
    (opt.unlocks || []).forEach(function (id) {
      S.queue.push({ id: id, at: S.month + (opt.unlockIn || 1) });
    });
    S.log.push({
      month: monthLabel(S.month), dateIdx: S.month, cat: ev.cat, ev: ev.title,
      opt: opt.t, tier: p === null ? null : tier, p: p, eff: res.eff, txt: res.txt
    });
    return res;
  }

  /* ---------- 11) التقدم شهر ---------- */
  // حزم دعم/تمويل عالمية وصلت فعلاً في هذه الأشهر (مرة واحدة)
  var SUPPORT = { 4: 0.5, 11: 1.0, 12: 0.8, 14: 1.2, 16: 0.5, 22: 1.0, 26: 0.6, 30: 0.5 };
  function advance(S) {
    S.month++;
    var msgs = [];
    // آثار مؤجلة مستحقة
    var due = [], keep = [];
    S.delay.forEach(function (d) { if (d.at <= S.month) due.push(d); else keep.push(d); });
    S.delay = keep;
    due.forEach(function (d) { applyEff(S, d.eff); addFlags(S, d.flags); if (d.txt) msgs.push({ t: "أثر متأخر", x: d.txt }); });
    // دعم مانحين مستحق في هذا الشهر (مرونة مالية لا قرار سياسي)
    if (SUPPORT[S.month]) { S.res.cash = Math.round((S.res.cash + SUPPORT[S.month]) * 100) / 100; msgs.push({ t: "تمويل خارجي", x: "حزمة دعم/اتفاقيات تضيف " + SUPPORT[S.month] + " مليار $ للخزينة (مرتبطة بمسار رفع العقوبات)." }); }
    // انجراف
    var dr = drift(S);
    applyEff(S, dr);
    // سُلّم الشريعة: كلفة التراجع عن عتبة سبق عبورها
    var lb = ladderCost(S, S.shrHigh);
    if (lb) { applyEff(S, { cap: lb.cap, frag: lb.frag, t_war: lb.t_war }); msgs.push({ t: "نكث تشريعي", x: lb.txt }); }
    if (S.st.shr > S.shrHigh) S.shrHigh = S.st.shr;
    // لقطات للمنحنى
    S.line.push({
      m: S.month, leg: S.st.leg, coh: S.st.coh, eco: S.st.eco, mil: S.st.mil,
      sov: S.st.sov, dip: S.st.dip, sec: S.st.sec, dem: S.st.dem, srv: S.st.srv,
      press: S.st.press, frag: S.st.frag, shr: S.st.shr, cash: S.res.cash
    });
    return { drift: dr, msgs: msgs };
  }

  /* ---------- 12) التقييم والنهايات ---------- */
  function score(S) {
    var st = S.st;
    var w = { leg: 1.0, coh: 1.25, sec: 1.0, eco: 1.15, srv: 0.9, mil: 0.8, sov: 1.15, dip: 0.8, dem: 0.7 };
    var sum = 0, wsum = 0;
    for (var k in w) { sum += st[k] * w[k]; wsum += w[k]; }
    var avg = sum / wsum;
    var penalty = Math.max(0, st.press - 50) * 0.18 + Math.max(0, st.frag - 50) * 0.22;
    var compAvg = (S.pop.sunn + S.pop.alaw + S.pop.druze + S.pop.kurd + S.pop.christ + S.pop.trib) / 6;
    var final = clamp(avg - penalty + (compAvg - 45) * 0.08, 0, 100);
    return {
      avg: Math.round(avg), final: Math.round(final), penalty: Math.round(penalty),
      grade: final >= 82 ? "أ" : final >= 72 ? "ب" : final >= 62 ? "ج" : final >= 52 ? "د" : final >= 42 ? "هـ" : "و",
      compAvg: Math.round(compAvg)
    };
  }
  function specificity(w) {
    if (!w) return 0;
    var n = 0;
    ["flagAll", "flagAny", "flagNone"].forEach(function (k) { if (w[k]) n += w[k].length; });
    if (w.min) n += Object.keys(w.min).length;
    if (w.max) n += Object.keys(w.max).length;
    if (w.monthMin) n++; if (w.monthMax) n++;
    return n;
  }
  function ending(S, endings) {
    var sc = score(S), best = null, bestScore = -1e9;
    for (var i = 0; i < endings.length; i++) {
      var e = endings[i];
      if (!condOK(S, e.when)) continue;
      // الأشروطُ الأدقّ تسبق الأوسع، والنهاية الافتراضية (بلا شروط) تبقى أخيرة
      var sp = specificity(e.when) * 10 - i;
      if (sp > bestScore) { bestScore = sp; best = e; }
    }
    return { end: best, score: sc };
  }

  /* ---------- 13) واجهة المحرك ---------- */
  var api = {
    STATS: STATS, NEG: NEG, AXIS: AXIS, RES: RES, REL: REL, POP: POP, THR: THR,
    MONTHS_TOTAL: MONTHS_TOTAL, monthLabel: monthLabel, clamp: clamp,
    initialState: initialState, applyEff: applyEff, addFlags: addFlags, has: has,
    condOK: condOK, getVal: getVal, chance: chance, pickEvent: pickEvent,
    drift: drift, collapse: collapse, resolve: resolve, advance: advance,
    score: score, ending: ending, shockChance: shockChance
  };

  /* ---------- 14) لاعب آلي (للاختبار والموازنة) ---------- */
  // mode: "random" | "greedy" (يختار الخيار الأعلى مكسباً مرجحاً)
  function autoRun(S, data, mode, stopAt) {
    var guard = 0;
    while (S.month < (stopAt || MONTHS_TOTAL - 1) && !S.over && guard++ < 400) {
      var ev = pickEvent(S, data);
      if (!ev) { advance(S); continue; }
      S.used[ev.id] = 1;
      S.seen.push(ev.id);
      var opts = ev.options;
      var oi = 0;
      if (mode === "random") oi = Math.floor(S.rng() * opts.length);
      else {
        var bestv = -1e9;
        opts.forEach(function (o, idx) {
          if (o.cost && (o.cost.cap || 0) < 0 && S.res.cap + (o.cost.cap || 0) < 0) { return; }
          var p = chance(S, o);
          function valOf(eff) {
            var v = 0;
            for (var k in eff) {
              var neg = (k === "press" || k === "frag" || k.indexOf("t_") === 0);
              var wgt = (k in STATS ? 1 : k in AXIS ? 0 : k === "cash" ? 3 : k === "cap" ? 0.6 : (k.indexOf("r_") === 0 ? 0.4 : k.indexOf("p_") === 0 ? 0.9 : neg ? -0.9 : 0.8));
              v += eff[k] * wgt * (neg ? -1 : 1);
            }
            return v;
          }
          var eff = (o.out && o.out.ok) ? o.out.ok.eff : (o.eff || {});
          var v = valOf(eff);
          if (p !== null && o.out) {
            var pmid = (100 - p) * 0.45, pbad = (100 - p) * 0.55;
            v = (valOf(o.out.ok.eff || {}) * p + valOf((o.out.mid || {}).eff || {}) * pmid + valOf((o.out.bad || {}).eff || {}) * pbad) / 100;
          }
          if (v > bestv) { bestv = v; oi = idx; }
        });
      }
      resolve(S, ev, opts[oi]);
      var c = collapse(S);
      if (c) { S.over = c; break; }
      advance(S);
    }
    if (!S.over) S.over = null;
    return S;
  }

  api.autoRun = autoRun;
  return api;
})();
if (typeof module !== "undefined" && module.exports) module.exports = SY;
