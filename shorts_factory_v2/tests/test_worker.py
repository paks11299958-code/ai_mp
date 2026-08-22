import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from shorts_factory_v2.worker import run


class WorkerTests(unittest.TestCase):
    def test_render_failure_is_persisted(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'job.json'
            source.write_text(json.dumps({
                'id': 'failed-job',
                'segments': [{
                    'caption': '장면', 'text': '내레이션', 'cardText': '카드',
                    'audio': 'missing.mp3',
                }],
            }), encoding='utf-8')
            with patch('shorts_factory_v2.worker.build', side_effect=RuntimeError('render exploded')), \
                    patch('shorts_factory_v2.worker.traceback.print_exc'):
                code = run(source)

            status = json.loads((Path(directory) / '_work' / 'status.json').read_text(encoding='utf-8'))
            self.assertEqual(code, 1)
            self.assertEqual(status['status'], 'failed')
            self.assertIn('render exploded', status['error'])


if __name__ == '__main__':
    unittest.main()
