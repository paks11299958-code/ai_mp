import unittest

from shorts_factory_v2.layout import LayoutOverflowError, compute_vertical_layout


class VerticalLayoutTests(unittest.TestCase):
    def test_reported_two_line_caption_does_not_overlap_three_line_narration(self):
        layout = compute_vertical_layout(caption_lines=2, narration_lines=3)

        self.assertGreaterEqual(layout.narration.top - layout.caption.bottom, 24)
        self.assertEqual(layout.caption_lines, 2)
        self.assertEqual(layout.narration_lines, 3)

    def test_three_line_caption_keeps_all_three_narration_lines(self):
        layout = compute_vertical_layout(caption_lines=3, narration_lines=3)

        self.assertGreaterEqual(layout.narration.top - layout.caption.bottom, 24)
        self.assertEqual(layout.narration_lines, 3)
        self.assertGreaterEqual(layout.card.height, 560)

    def test_impossible_layout_fails_instead_of_silently_dropping_text(self):
        with self.assertRaises(LayoutOverflowError):
            compute_vertical_layout(caption_lines=5, narration_lines=4)


if __name__ == "__main__":
    unittest.main()
