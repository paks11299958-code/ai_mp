import tempfile
import unittest
from pathlib import Path

from PIL import Image

from shorts_factory_v2.job import Segment, ShortsJob
from shorts_factory_v2.renderer import render_segment_frame


class RendererRegressionTests(unittest.TestCase):
    def test_reported_caption_and_narration_render_without_overlap(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "scene.png"
            Image.new("RGB", (900, 1600), (110, 90, 70)).save(image)
            segment = Segment(
                caption="가지 말라고 하자니 치사하고... 나만 이상한가요?",
                text=(
                    "가지 말라고 대놓고 말하면 치사해 보이고, 보내주자니 기분이 "
                    "씁쓸하고... 나는 대체 남편에게 몇 번째 순위일까?"
                ),
                image=image,
                audio=root / "unused.mp3",
            )
            job = ShortsJob(
                job_id="layout-regression",
                title="layout regression",
                brand="AI 놀이터 · aichat.dbzone.kr",
                character_bible="",
                segments=(segment,),
                source=root / "job.json",
            )
            output = root / "frame.png"

            layout = render_segment_frame(job, segment, 0, output)

            self.assertTrue(output.is_file())
            with Image.open(output) as rendered:
                self.assertEqual(rendered.size, (1080, 1920))
            self.assertGreaterEqual(layout.narration.top - layout.caption.bottom, 24)
            self.assertEqual(layout.caption_lines, 2)
            self.assertEqual(layout.narration_lines, 3)


if __name__ == "__main__":
    unittest.main()
