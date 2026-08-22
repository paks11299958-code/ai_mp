import json
import tempfile
import unittest
from pathlib import Path

from shorts_factory_v2.job import JobValidationError, load_job, missing_assets


class JobTests(unittest.TestCase):
    def test_missing_image_becomes_codex_image_task(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            audio = root / "voice.mp3"
            audio.write_bytes(b"placeholder")
            source = root / "job.json"
            source.write_text(
                json.dumps(
                    {
                        "id": "sample",
                        "characterBible": "같은 한국인 부부",
                        "segments": [
                            {
                                "caption": "갈등",
                                "text": "서운한 마음을 말합니다.",
                                "audio": "voice.mp3",
                                "image": "assets/scene0.png",
                                "imagePrompt": "저녁 식탁의 부부",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            job = load_job(source)
            missing = missing_assets(job)

            self.assertEqual(len(missing), 1)
            self.assertEqual(missing[0]["kind"], "image")
            self.assertEqual(missing[0]["prompt"], "저녁 식탁의 부부")
            self.assertEqual(missing[0]["characterBible"], "같은 한국인 부부")

    def test_invalid_job_id_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "job.json"
            source.write_text(
                json.dumps({"id": "잘못된 id", "segments": [{}]}), encoding="utf-8"
            )
            with self.assertRaises(JobValidationError):
                load_job(source)


if __name__ == "__main__":
    unittest.main()
