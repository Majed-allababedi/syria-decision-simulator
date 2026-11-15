#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — يجمع المحرك + البيانات + الواجهة في ملف index.html واحد يعمل دون إنترنت.
الاستخدام:  python3 build.py
"""
import json, io, os, sys, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
DATA_DIR = os.path.join(SRC, "data")
OUT = os.path.join(ROOT, "index.html")


def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()


def load_data():
    files = sorted(os.listdir(DATA_DIR))
    events, endings, news = [], [], []
    meta = {}
    for fn in files:
        if not fn.endswith(".json"):
            continue
        p = os.path.join(DATA_DIR, fn)
        obj = json.loads(read(p))
        events += obj.get("events", [])
        endings += obj.get("endings", [])
        news += obj.get("news", [])
        meta.update(obj.get("meta", {}))
    ids = {}
    for e in events:
        if e["id"] in ids:
            raise SystemExit("معرّف مكرر: " + e["id"])
        ids[e["id"]] = 1
    news.sort(key=lambda n: n.get("at", 0))
    return {"events": events, "endings": endings, "news": news, "meta": meta}


def validate(data):
    errs = []
    keys = set("""leg coh sec eco srv mil sov dip dem press frag shr cash cap""".split())
    for p in ["r_us", "r_eu", "r_gulf", "r_tr", "r_ru", "r_il", "r_ir", "r_arab",
              "p_sunn", "p_alaw", "p_druze", "p_kurd", "p_christ", "p_trib",
              "t_isis", "t_rem", "t_war"]:
        keys.add(p)
    seen_ids = set()
    for e in data["events"]:
        for f in ("id", "month", "title", "brief", "options"):
            if f not in e:
                errs.append("%s: ناقص %s" % (e.get("id", "?"), f))
        if not isinstance(e.get("month"), int) or e.get("month", 0) < 0 or e.get("month", 0) > 36:
            errs.append("%s: month خارج المدى 0..36" % e.get("id", "?"))
        if len(e.get("options", [])) < 2:
            errs.append("%s: أقل من خيارين" % e.get("id", "?"))
        for o in e.get("options", []):
            if "t" not in o:
                errs.append("%s: خيار بلا عنوان" % e.get("id"))
            has_det = "eff" in o and "txt" in o
            has_prob = "prob" in o and "out" in o
            if not has_det and not has_prob:
                errs.append("%s: خيار بلا (eff+txt) ولا (prob+out)" % e.get("id"))
            if has_prob:
                for tier in ("ok", "mid", "bad"):
                    if tier not in o["out"]:
                        errs.append("%s: خيارات %s بلا نتيجة %s" % (e.get("id"), o["t"][:18], tier))
            for src in [o.get("eff") or {}] + [(o.get("out") or {}).get(t, {}).get("eff") or {} for t in ("ok", "mid", "bad")] + \
                       [(d.get("eff") or {}) for d in (o.get("delay") or [])] + [o.get("cost") or {}]:
                for k in src:
                    if k not in keys:
                        errs.append("%s: مفتاح أثر غير معروف: %s" % (e.get("id"), k))
            for d in (o.get("delay") or []):
                if "in" not in d:
                    errs.append("%s: delay بلا in" % e.get("id"))
            pr = o.get("promise")
            if pr:
                for f in ("metric", "target", "in"):
                    if f not in pr:
                        errs.append("%s: promise بلا %s" % (e.get("id"), f))
                if pr.get("metric") not in keys:
                    errs.append("%s: promise.metric مجهول: %s" % (e.get("id"), pr.get("metric")))
                if not isinstance(pr.get("target"), (int, float)) or not (1 <= pr.get("in", 0) <= 18):
                    errs.append("%s: promise في غير المدى (target/in)" % e.get("id"))
                for sub in (pr.get("reward") or {}, pr.get("penalty") or {}):
                    for k in sub:
                        if k not in keys:
                            errs.append("%s: promise مفتاح أثر مجهول: %s" % (e.get("id"), k))
            for u in (o.get("unlocks") or []):
                seen_ids.add((e["id"], u))
    all_ids = set(e["id"] for e in data["events"])
    for (a, b) in seen_ids:
        if b not in all_ids:
            errs.append("%s يفتح حدثاً غير موجود: %s" % (a, b))
    for n in data["news"]:
        if "at" not in n or "t" not in n:
            errs.append("خبر ناقص: %r" % n)
    return errs


TPL = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>محاكي قرار سوريا — من التحرير إلى 2027</title>
<meta name="description" content="لعبة محاكاة قرارات مبنية على وقائع موثقة: من سقوط نظام الأسد في 8 ديسمبر 2024 حتى ديسمبر 2027. تعمل دون إنترنت.">
<style>
__CSS__
</style>
</head>
<body>
<div id="app"></div>
<noscript><p style="padding:30px">هذه اللعبة تحتاج JavaScript.</p></noscript>
<script>
__ENGINE__
</script>
<script>
var SY_DATA = __DATA__;
</script>
<script>
__UI__
</script>
</body>
</html>
"""


def main():
    data = load_data()
    errs = validate(data)
    if errs:
        print("أخطاء في البيانات (%d):" % len(errs))
        for e in errs[:60]:
            print("  -", e)
        if not os.environ.get("FORCE"):
            return 1
    html = (TPL
            .replace("__CSS__", read(os.path.join(SRC, "css", "style.css")))
            .replace("__ENGINE__", read(os.path.join(SRC, "engine.js")))
            .replace("__UI__", read(os.path.join(SRC, "ui.js")))
            .replace("__DATA__", json.dumps(data, ensure_ascii=False)))
    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    nev = len(data["events"])
    nshock = len([e for e in data["events"] if e.get("shock")])
    print("✓ index.html  ·  %d حدثاً (%d صدمة)  ·  %d نهاية  ·  %d خبراً شهرياً  ·  %.1f ك.ب" %
          (nev, nshock, len(data["endings"]), len(data["news"]), os.path.getsize(OUT) / 1024.0))
    return 0


if __name__ == "__main__":
    sys.exit(main())
