"""اختبارات التكامل بين بيانات النهايات والأعلام التي تنتجها الواجهة."""
import importlib.util
import json
import unittest
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build', ROOT / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

class Integration(unittest.TestCase):
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
