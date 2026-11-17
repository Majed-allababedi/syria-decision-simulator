#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — يجمع المحرك + البيانات + الواجهة في ملف index.html واحد يعمل دون إنترنت.
الاستخدام:  python3 build.py
"""
import base64, json, io, os, sys, re, math, tempfile, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
DATA_DIR = os.path.join(SRC, "data")
FONTS_DIR = os.path.join(SRC, "fonts")
OUT = os.path.join(ROOT, "index.html")

# رموز CSS التي يستبدلها البناء بمحتوى الخط base64 (تكتبها style.css)
FONT_TOKENS = {
    "__FONT_REGULAR__": "IBMPlexSansArabic-Regular.ttf",
    "__FONT_SEMIBOLD__": "IBMPlexSansArabic-SemiBold.ttf",
}

METRIC_KEYS = set("""leg coh sec eco srv mil sov dip dem press frag shr cash cap""".split())
WHEN_KEYS = set("min max flagAll flagAny flagNone monthMin monthMax".split())


def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()


def _strict_pairs(pairs):
    seen = set()
    for k, _ in pairs:
        if k in seen:
            raise ValueError("مفتاح JSON مكرر: " + k)
        seen.add(k)
    return dict(pairs)


def load_data(data_dir=None):
    files = sorted(os.listdir(data_dir or DATA_DIR))
    events, endings, news = [], [], []
    meta = {}
    for fn in files:
        if not fn.endswith(".json"):
            continue
        p = os.path.join(data_dir or DATA_DIR, fn)
        try:
            obj = json.loads(read(p), object_pairs_hook=_strict_pairs)
        except ValueError as ex:
            raise ValueError("%s: %s" % (fn, ex))
        events += obj.get("events", [])
        endings += obj.get("endings", [])
        news += obj.get("news", [])
        meta.update(obj.get("meta", {}))
    ids = {}
    for e in events:
        if e["id"] in ids:
            raise ValueError("معرّف مكرر: " + e["id"])
        ids[e["id"]] = 1
    news.sort(key=lambda n: n.get("at", 0))
    return {"events": events, "endings": endings, "news": news, "meta": meta}


def embed_fonts(css, fonts_dir=None):
    """يستبدل رموز الخط في CSS بـ base64؛ يرفع النظام بخطأ واضح إذا غاب الملف."""
    fonts_dir = fonts_dir or FONTS_DIR
    for tok, fn in FONT_TOKENS.items():
        if tok not in css:
            continue
        p = os.path.join(fonts_dir, fn)
        if not os.path.isfile(p):
            raise SystemExit("ملف الخط مفقود: %s — الرمز %s في style.css يحتاجه البناء." % (p, tok))
        with open(p, "rb") as f:
            css = css.replace(tok, base64.b64encode(f.read()).decode("ascii"))
    return css


def font_license(fonts_dir=None):
    p = os.path.join(fonts_dir or FONTS_DIR, "OFL.txt")
    if not os.path.isfile(p):
        raise FileNotFoundError("ترخيص الخط مفقود: " + p)
    text = "\n".join(line.rstrip() for line in read(p).splitlines()).replace("</script", "<\\/script")
    return '<script type="text/plain" id="font-license">\n%s\n</script>' % text


def validate(data):
    errs = []
    for name in ("events", "endings", "news"):
        if not isinstance(data.get(name), list) or not data[name]:
            errs.append("مجموعة مفقودة أو فارغة: " + name)
    data = dict(data, **{name: data.get(name) if isinstance(data.get(name), list) else [] for name in ("events", "endings", "news")})
    keys = set("""leg coh sec eco srv mil sov dip dem press frag shr cash cap""".split())
    for p in ["r_us", "r_eu", "r_gulf", "r_tr", "r_ru", "r_il", "r_ir", "r_arab",
              "p_sunn", "p_alaw", "p_druze", "p_kurd", "p_christ", "p_trib",
              "t_isis", "t_rem", "t_war"]:
        keys.add(p)
    def number(value):
        return type(value) in (int, float) and math.isfinite(value)

    def effects(who, value):
        if not isinstance(value, dict):
            errs.append("%s: أثر ليس كائناً" % who)
            return
        for k, v in value.items():
            if k not in keys or not number(v):
                errs.append("%s: مفتاح أثر أو قيمة غير صالحة: %s" % (who, k))
    seen_ids = set()
    flat_flags = {"doc_security", "doc_bread", "doc_consensus", "doc_sovereign", "doc_sharia", "promise_kept", "promise_broken", "ladder_back1", "ladder_back2", "ladder_back3"}
    for e in data["events"]:
        for f in ("id", "month", "title", "brief", "options"):
            if f not in e:
                errs.append("%s: ناقص %s" % (e.get("id", "?"), f))
        if not isinstance(e.get("month"), int) or e.get("month", 0) < 0 or e.get("month", 0) > 36:
            errs.append("%s: month خارج المدى 0..36" % e.get("id", "?"))
        if len(e.get("options", [])) < 2:
            errs.append("%s: أقل من خيارين" % e.get("id", "?"))
        stats_ids = set()
        for o in e.get("options", []):
            stats_id = o.get("statsId")
            if not isinstance(stats_id, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", stats_id) or stats_id in stats_ids:
                errs.append("%s: statsId مفقود أو غير صالح أو مكرر" % e.get("id"))
            else:
                stats_ids.add(stats_id)
            if "t" not in o:
                errs.append("%s: خيار بلا عنوان" % e.get("id"))
            has_det = "eff" in o and "txt" in o
            has_prob = "prob" in o and "out" in o
            if "prob" in o and "out" not in o:
                errs.append("%s: خيار باحتمال بلا مخارج (prob بلا out)" % e.get("id"))
            if not has_det and not has_prob:
                errs.append("%s: خيار بلا (eff+txt) ولا (prob+out)" % e.get("id"))
            if has_prob:
                for tier in ("ok", "mid", "bad"):
                    if tier not in o["out"]:
                        errs.append("%s: خيارات %s بلا نتيجة %s" % (e.get("id"), o["t"][:18], tier))
            if "prob" in o:
                prob = o["prob"]
                if not isinstance(prob, dict) or not number(prob.get("base")):
                    errs.append("%s: prob.base غير صالح" % e.get("id"))
                if isinstance(prob, dict) and "mods" in prob:
                    effects(e.get("id"), prob["mods"])
            for src in [o.get("eff", {})] + [(o.get("out") or {}).get(t, {}).get("eff", {}) for t in ("ok", "mid", "bad")] + \
                       [(d.get("eff", {})) for d in (o.get("delay") or [])] + [o.get("cost", {})]:
                effects(e.get("id"), src)
            for d in (o.get("delay") or []):
                if "in" not in d:
                    errs.append("%s: delay بلا in" % e.get("id"))
                elif not number(d["in"]):
                    errs.append("%s: delay.in غير صالح" % e.get("id"))
            pr = o.get("promise")
            if pr:
                for f in ("metric", "target", "in"):
                    if f not in pr:
                        errs.append("%s: promise بلا %s" % (e.get("id"), f))
                if pr.get("metric") not in keys:
                    errs.append("%s: promise.metric مجهول: %s" % (e.get("id"), pr.get("metric")))
                if not number(pr.get("target")) or not number(pr.get("in")) or not (1 <= pr["in"] <= 18):
                    errs.append("%s: promise في غير المدى (target/in)" % e.get("id"))
                for sub in (pr.get("reward", {}), pr.get("penalty", {})):
                    effects(e.get("id"), sub)
            for u in (o.get("unlocks") or []):
                seen_ids.add((e["id"], u))
            for fl in _flags(o):
                flat_flags.add(fl)
    all_ids = set(e["id"] for e in data["events"])
    for (a, b) in seen_ids:
        if b not in all_ids:
            errs.append("%s يفتح حدثاً غير موجود: %s" % (a, b))
    for e in data["events"]:
        errs.extend(_when_errs(e.get("id", "?"), e.get("when"), keys, flat_flags))
    for en in data["endings"]:
        for f in ("id", "when", "title", "desc"):
            if f not in en:
                errs.append("%s: نهاية ناقصة %s" % (en.get("id", "?"), f))
        for fl in _flags(en):
            flat_flags.add(fl)
        errs.extend(_when_errs(en.get("id", "?"), en.get("when"), keys, flat_flags))
    for n in data["news"]:
        if "at" not in n or "t" not in n:
            errs.append("خبر ناقص: %r" % n)
        elif not isinstance(n["at"], int) or not 0 <= n["at"] <= 36:
            errs.append("خبر at خارج المدى 0..36: %r" % n)
    return errs


def _flags(obj):
    out = set(obj.get("flags") or [])
    for tier in (obj.get("out") or {}).values():
        out |= set(tier.get("flags") or [])
    for delayed in (obj.get("delay") or []):
        out |= set(delayed.get("flags") or [])
    return out


def _when_errs(who, when, keys, known_flags):
    """`when` يقبل min/max/flags فقط، بمفاتيح أثر وأعلام معروفة."""
    if when is None:
        return []
    errs = []
    for k in when:
        if k not in WHEN_KEYS:
            errs.append("%s: when مفتاح غير معروف: %s" % (who, k))
    for side in ("min", "max"):
        for k in (when.get(side) or {}):
            if k not in keys:
                errs.append("%s: when.%s مفتاح أثر مجهول: %s" % (who, side, k))
    for k in ("flagAll", "flagAny", "flagNone"):
        for fl in (when.get(k) or []):
            if fl not in known_flags:
                errs.append("%s: when.%s علم غير موجود: %s" % (who, k, fl))
    return errs


TPL = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>محاكي قرار سوريا — غرفة القرار</title>
<meta name="description" content="لعبة محاكاة قرارات بسياق تاريخي وسيناريوهات افتراضية: من سقوط نظام الأسد في 8 ديسمبر 2024 حتى ديسمبر 2027. تعمل دون إنترنت.">
<style>
__CSS__
</style>
</head>
<body>
<div id="app"></div>
<noscript><p style="padding:30px">هذه اللعبة تحتاج تفعيل جافاسكربت في المتصفح.</p></noscript>
<script>
__ENGINE__
</script>
<script>
var SY_DATA = __DATA__;
</script>
<script>
__UI__
</script>
__FONT_LICENSE__
<footer style="padding:18px;text-align:center;color:#b7d3ce;font-size:13px">خصوصيتك: تستخدم النسخة المنشورة إحصاءات زيارات عبر GoatCounter دون ملفات تعريف ارتباط؛ لا تُرسل القرارات إلا بموافقتك الاختيارية للنشر المجمّع، ولا يُرسل الحفظ. <a href="stats.html" style="color:inherit">الإحصاءات العامة</a> · <a href="https://www.goatcounter.com/help/privacy" style="color:inherit" target="_blank" rel="noopener noreferrer">سياسة الخصوصية</a></footer>
<script>
__ANALYTICS__
</script>
</body>
</html>
"""


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    data = load_data()
    errs = validate(data)
    if errs:
        print("أخطاء في البيانات (%d):" % len(errs))
        for e in errs[:60]:
            print("  -", e)
        if not os.environ.get("FORCE"):
            return 1
    if "--check" in argv:
        print("✓ التحقق ناجح: %d حدثاً · %d نهاية · %d خبراً" %
              (len(data["events"]), len(data["endings"]), len(data["news"])))
        return 0
    html = (TPL
            .replace("__CSS__", embed_fonts(read(os.path.join(SRC, "css", "style.css"))))
            .replace("__ENGINE__", read(os.path.join(SRC, "engine.js")))
            .replace("__UI__", read(os.path.join(SRC, "ui.js")))
            .replace("__ANALYTICS__", read(os.path.join(SRC, "analytics.js")))
            .replace("__FONT_LICENSE__", font_license())
            .replace("__DATA__", json.dumps(data, ensure_ascii=False).replace("</", "<\\/")))
    early = re.findall(r'id: "(X_[^"]+)", t: "([^"]+)"', read(os.path.join(SRC, "engine.js")))
    stats_data = {"events": [{"id": e["id"], "title": e["title"], "options": [{"title": o["t"], "statsId": o["statsId"]} for o in e["options"]]} for e in data["events"]],
                  "endings": [{"id": e["id"], "title": e["title"]} for e in data["endings"]] + [{"id": i, "title": t} for i, t in early]}
    stats_html = (read(os.path.join(SRC, "stats.html"))
                  .replace("__CSS__", embed_fonts(read(os.path.join(SRC, "css", "style.css"))))
                  .replace("__FONT_LICENSE__", font_license())
                  .replace("__STATS_JS__", read(os.path.join(SRC, "stats.js")))
                  .replace("__STATS_DATA__", json.dumps(stats_data, ensure_ascii=False).replace("</", "<\\/")))
    outputs = [(OUT, html), (os.path.join(ROOT, "stats.html"), stats_html)]
    staged, backups, replaced = [], [], []
    try:
        for path, content in outputs:
            fd, temp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".build-")
            staged.append(temp)
            with io.open(fd, "w", encoding="utf-8", newline="\n") as f:
                f.write(content)
            if os.path.exists(path):
                fd, backup = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".build-backup-")
                os.close(fd)
                backups.append(backup)
                shutil.copyfile(path, backup)
            else:
                backups.append(None)
        for (path, _), temp in zip(outputs, staged):
            os.replace(temp, path)
            replaced.append(path)
    except BaseException:
        for path, backup in reversed(list(zip(replaced, backups))):
            if backup:
                backups.remove(backup)
                os.replace(backup, path)
            else:
                os.unlink(path)
        raise
    finally:
        for temp in staged + [b for b in backups if b]:
            if os.path.exists(temp):
                os.unlink(temp)
    nev = len(data["events"])
    nshock = len([e for e in data["events"] if e.get("shock")])
    print("✓ index.html  ·  %d حدثاً (%d صدمة)  ·  %d نهاية  ·  %d خبراً شهرياً  ·  %.1f ك.ب" %
          (nev, nshock, len(data["endings"]), len(data["news"]), os.path.getsize(OUT) / 1024.0))
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
