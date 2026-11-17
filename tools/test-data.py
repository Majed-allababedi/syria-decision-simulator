#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""اختبارات البيانات والبناء — تفشل قبل الإصلاح وتنجح بعده.

التشغيل:  python3 tools/test-data.py
"""
import base64
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
import copy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")

spec = importlib.util.spec_from_file_location("build", os.path.join(ROOT, "build.py"))
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def read_json(name):
    with io.open(os.path.join(DATA, name), "r", encoding="utf-8") as f:
        return json.load(f)


def write(dirpath, name, text):
    with io.open(os.path.join(dirpath, name), "w", encoding="utf-8") as f:
        f.write(text)


def event(evid):
    for name in sorted(os.listdir(DATA)):
        if not name.endswith(".json"):
            continue
        for e in read_json(name).get("events", []):
            if e["id"] == evid:
                return e
    raise AssertionError("حدث غير موجود: " + evid + " — هل تغيّر المعرّف؟")


class T1_Duplicates(unittest.TestCase):
    def test_strict_loader_rejects_duplicate_keys(self):
        tmp = tempfile.mkdtemp()
        write(tmp, "a.json", '{"events": [{"id": "E1", "eff": {"mil": -2, "mil": -1}}]}')
        with self.assertRaises(ValueError) as ctx:
            build.load_data(tmp)
        self.assertIn("مكرر", str(ctx.exception))
        self.assertIn("a.json", str(ctx.exception))

    def test_real_data_loads_strictly(self):
        data = build.load_data(DATA)
        self.assertEqual(len(data["events"]), 138)

    def test_E152_single_mil_keeps_effective_minus_one(self):
        eff = next(o["eff"] for o in event("E152_corps_merge")["options"] if o["t"] == "فيالق جهوية بصلاحيات واسعة")
        self.assertEqual(eff["mil"], -1)


class T2_OptionShapes(unittest.TestCase):
    def test_prob_without_out_is_rejected(self):
        data = {"events": [{"id": "E9", "month": 1, "title": "ت", "brief": "ب", "options": [
            {"t": "أ", "prob": {"base": 70}, "eff": {"sec": 1}, "txt": "ن"},
            {"t": "ب", "eff": {"sec": 1}, "txt": "ن"}]}], "endings": [], "news": []}
        errs = build.validate(data)
        self.assertTrue(any("بلا مخارج" in e for e in errs), errs)

    def test_real_data_has_no_prob_without_out(self):
        data = build.load_data(DATA)
        bad = [e["id"] for e in data["events"] for o in e.get("options", [])
               if "prob" in o and "out" not in o]
        self.assertEqual(bad, [])

    def test_X19_settlement_is_deterministic(self):
        opt = next(o for o in event("X19_armed_faction_riot")["options"] if o["t"] == "تسوية: ضمانات وأسماء جديدة وراتب")
        self.assertNotIn("prob", opt)
        self.assertIn("eff", opt)
        self.assertIn("txt", opt)


class T3_Metadata(unittest.TestCase):
    def test_stats_ids_must_be_present_safe_and_unique(self):
        data = build.load_data(DATA)
        for invalid in (None, "bad/path", "0"):
            with self.subTest(invalid=invalid):
                data["events"][0]["options"][0]["statsId"] = "0"
                data["events"][0]["options"][1]["statsId"] = invalid
                self.assertTrue(any("statsId" in err for err in build.validate(data)))

    def test_unknown_when_key_rejected(self):
        data = {"events": [], "news": [],
                "endings": [{"id": "Nx", "when": {"minus": {"leg": 5}}, "title": "ت", "desc": "د"}]}
        errs = build.validate(data)
        self.assertTrue(any("when" in e for e in errs), errs)

    def test_unknown_flag_in_when_rejected(self):
        data = {"events": [], "news": [],
                "endings": [{"id": "Nx", "when": {"flagAll": ["no_such_flag"]}, "title": "ت", "desc": "د"}]}
        errs = build.validate(data)
        self.assertTrue(any("no_such_flag" in e for e in errs), errs)

    def test_news_at_out_of_range_rejected(self):
        data = {"events": [], "endings": [], "news": [{"at": 99, "t": "خبر"}]}
        errs = build.validate(data)
        self.assertTrue(any("at" in e for e in errs), errs)

    def test_real_news_placement_matches_own_date(self):
        news = read_json("80-news.json")["news"]
        expected = {2: 0, 4: 1, 6: 2, 9: 5, 10: 5, 14: 7, 32: 14, 43: 20}
        for idx, at in expected.items():
            self.assertEqual(news[idx]["at"], at, "خبر 80-news[%d]" % idx)
        sharia = read_json("90-events-sharia-track.json")["news"]
        self.assertEqual(sharia[5]["at"], 20)


class T4_Facts(unittest.TestCase):
    def test_declaration_has_53_articles(self):
        blobs = []
        for name in ("90-events-sharia-track.json",):
            with io.open(os.path.join(DATA, name), "r", encoding="utf-8") as f:
                blobs.append(f.read())
        text = "\n".join(blobs)
        self.assertIn("53 مادة", text)
        self.assertNotIn("52 مادة", text)

    def test_article_three_wording_is_definite(self):
        with io.open(os.path.join(DATA, "90-events-sharia-track.json"), "r", encoding="utf-8") as f:
            text = f.read()
        self.assertIn("المصدر الرئيسي", text)
        self.assertNotIn("«الفقه الإسلامي مصدراً رئيسياً للتشريع»", text)

    def test_no_last_remnants_chemical_claim(self):
        for name in sorted(os.listdir(DATA)):
            if name.endswith(".json"):
                with io.open(os.path.join(DATA, name), "r", encoding="utf-8") as f:
                    self.assertNotIn("آخر بقايا", f.read(), name)

    def test_iaea_actor_is_board_not_syrian_complaint(self):
        text = json.dumps(event("E068_chem_iaea"), ensure_ascii=False)
        self.assertIn("الوكالة الدولية للطاقة الذرية", text)
        self.assertIn("لم تعد في حالة عدم امتثال", text)

    def test_bank_69_is_asset_share_not_bad_loans(self):
        data = read_json("96-events-deep-research.json")
        text = json.dumps(data, ensure_ascii=False)
        self.assertNotIn("أصول غير عاملة 69%", text)
        self.assertIn("69% من أصول القطاع", text)

    def test_no_golan_19_settlements(self):
        for name in sorted(os.listdir(DATA)):
            if name.endswith(".json"):
                with io.open(os.path.join(DATA, name), "r", encoding="utf-8") as f:
                    self.assertNotIn("19 مستوطنة جديدة في الجولان", f.read(), name)

    def test_corrected_records_carry_sources(self):
        for evid in ("E152_corps_merge", "E068_chem_iaea", "X19_armed_faction_riot"):
            e = event(evid)
            self.assertIn("source", e, evid)
            self.assertTrue(e["source"], evid)


class T5_Build(unittest.TestCase):
    def test_font_tokens_embed_base64(self):
        css = "a{src:url(data:font/ttf;base64,__FONT_REGULAR__)} b{src:url(data:font/ttf;base64,__FONT_SEMIBOLD__)}"
        out = build.embed_fonts(css, os.path.join(ROOT, "src", "fonts"))
        self.assertNotIn("__FONT_REGULAR__", out)
        self.assertNotIn("__FONT_SEMIBOLD__", out)
        with open(os.path.join(ROOT, "src", "fonts", "IBMPlexSansArabic-Regular.ttf"), "rb") as f:
            blob = base64.b64encode(f.read()).decode("ascii")
        self.assertIn(blob, out)

    def test_missing_font_gives_clear_error(self):
        tmp = tempfile.mkdtemp()
        with self.assertRaises(SystemExit) as ctx:
            build.embed_fonts("url(__FONT_REGULAR__)", tmp)
        self.assertIn("IBMPlexSansArabic-Regular.ttf", str(ctx.exception))

    def test_style_css_tokens_all_resolve(self):
        with io.open(os.path.join(ROOT, "src", "css", "style.css"), "r", encoding="utf-8") as f:
            css = f.read()
        out = build.embed_fonts(css, os.path.join(ROOT, "src", "fonts"))
        self.assertNotIn("__FONT_", out)

    def test_check_mode_returns_zero_on_valid_data(self):
        self.assertEqual(build.main(["--check"]), 0)

    def test_empty_or_missing_corpora_rejected(self):
        data = build.load_data(DATA)
        for name in ("events", "endings", "news"):
            for value in ([], None):
                bad = dict(data)
                if value is None:
                    del bad[name]
                else:
                    bad[name] = value
                with self.subTest(name=name, value=value):
                    self.assertTrue(build.validate(bad))

    def test_numeric_effects_and_probability_are_validated(self):
        data = build.load_data(DATA)
        for field, value in [("eff", {"leg": "bad"}), ("cost", {"leg": float('inf')}),
                             ("eff", {"unknown": 1}),
                             ("eff", []),
                             ("prob", {"base": "bad", "mods": {}}),
                             ("prob", {"base": float('nan'), "mods": {}}),
                             ("prob", {"base": 50, "mods": {"bad_key": 1}}),
                             ("prob", {"base": 50, "mods": {"leg": "bad"}}),
                             ("delay", [{"in": "bad", "eff": {"leg": 1}}]),
                             ("promise", {"metric": "leg", "target": 4, "in": 2, "reward": {"leg": "bad"}})]:
            bad = copy.deepcopy(data)
            opt = bad['events'][0]['options'][0]
            opt[field] = value
            if field == 'prob':
                opt['out'] = {k: {'eff': {}, 'txt': ''} for k in ('ok', 'mid', 'bad')}
            with self.subTest(field=field, value=value):
                self.assertTrue(build.validate(bad))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    unittest.main(verbosity=2)
