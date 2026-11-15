"""اختبارات التكامل بين بيانات النهايات والأعلام التي تنتجها الواجهة."""
import importlib.util
import json
import unittest
import tempfile
import shutil
from unittest.mock import patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build', ROOT / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

class Integration(unittest.TestCase):
    def test_build_preflights_stats_and_escapes_inline_json(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'src', root / 'src')
            index, stats = root / 'index.html', root / 'stats.html'
            for target in (index, stats):
                target.write_text('previous', encoding='utf-8')
            with patch.object(build, 'ROOT', str(root)), patch.object(build, 'SRC', str(root / 'src')), \
                 patch.object(build, 'DATA_DIR', str(root / 'src' / 'data')), \
                 patch.object(build, 'FONTS_DIR', str(root / 'src' / 'fonts')), patch.object(build, 'OUT', str(index)):
                for filename in ('stats.html', 'stats.js'):
                    path = root / 'src' / filename
                    saved = path.read_bytes()
                    path.unlink()
                    with self.assertRaises(FileNotFoundError):
                        build.main([])
                    self.assertEqual(index.read_text(encoding='utf-8'), 'previous')
                    self.assertEqual(stats.read_text(encoding='utf-8'), 'previous')
                    path.write_bytes(saved)
                datafile = root / 'src' / 'data' / '80-news.json'
                data = json.loads(datafile.read_text(encoding='utf-8'))
                data['news'][0]['t'] = '</ScRiPt><script>alert(1)</script>'
                datafile.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
                self.assertEqual(build.main([]), 0)
                html = index.read_text(encoding='utf-8')
                self.assertIn('<\\/ScRiPt><script>alert(1)<\\/script>', html)
                self.assertNotIn(b'\r\n', index.read_bytes())
                self.assertNotIn(b'\r\n', stats.read_bytes())
                index.write_text('old index', encoding='utf-8')
                stats.write_text('old stats', encoding='utf-8')
                real_replace = build.os.replace
                def fail_second(src, dst):
                    if dst == str(stats):
                        raise OSError('simulated replacement failure')
                    return real_replace(src, dst)
                with patch.object(build.os, 'replace', side_effect=fail_second):
                    with self.assertRaises(OSError):
                        build.main([])
                self.assertEqual(index.read_text(encoding='utf-8'), 'old index')
                self.assertEqual(stats.read_text(encoding='utf-8'), 'old stats')
                self.assertEqual(list(root.glob('.build-*')), [])

    def test_missing_license_stops_build(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):
                build.font_license(directory)

    def test_runtime_doctrine_flag_is_valid(self):
        data = build.load_data()
        data['endings'][0]['when']['flagAny'] = ['doc_sharia']
        self.assertEqual(build.validate(data), [])

    def test_identity_ending_keeps_doctrine_route(self):
        data = build.load_data()
        end = next(e for e in data['endings'] if e['id'] == 'T1_reference_state')
        self.assertIn('doc_sharia', end['when']['flagAny'])

    def test_default_ending_does_not_claim_real_world_measurement(self):
        data = build.load_data()
        end = next(e for e in data['endings'] if e['id'] == 'N15_default')
        self.assertNotIn('54/100', end['desc'])

if __name__ == '__main__':
    unittest.main()
