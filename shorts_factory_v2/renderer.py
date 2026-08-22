"""새 이미지에서 자막까지 매번 다시 그리는 쇼츠 프레임 렌더러."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from .job import Segment, ShortsJob
from .layout import VerticalLayout, compute_vertical_layout


W, H = 1080, 1920
CARD_W = 920
PURPLE = (142, 111, 183)
WHITE = (245, 244, 248)
GREY = (180, 176, 190)
FONT_ROOT = Path("/home/paks11299958/shorts-factory/assets")
FONT_EXTRA_BOLD = FONT_ROOT / "Pretendard-ExtraBold.otf"
FONT_MEDIUM = FONT_ROOT / "Pretendard-Medium.otf"


def _font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_EXTRA_BOLD if bold else FONT_MEDIUM), size)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    paragraphs = text.splitlines() or [""]
    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = ""
        for word in words:
            trial = f"{current} {word}".strip()
            if draw.textlength(trial, font=font) <= max_width:
                current = trial
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines or [""]


def _gradient() -> Image.Image:
    image = Image.new("RGB", (W, H))
    pixels = image.load()
    top, bottom = (18, 16, 24), (34, 27, 48)
    for y in range(H):
        ratio = y / (H - 1)
        color = tuple(int(a + (b - a) * ratio) for a, b in zip(top, bottom))
        for x in range(W):
            pixels[x, y] = color
    return image.convert("RGBA")


def _rounded(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, image.width - 1, image.height - 1), radius=radius, fill=255
    )
    result = image.convert("RGBA")
    result.putalpha(mask)
    return result


def _paste_shadowed(background: Image.Image, card: Image.Image, x: int, y: int) -> None:
    shadow = Image.new("RGBA", background.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x + 8, y + 16, x + card.width + 8, y + card.height + 16),
        radius=48,
        fill=(0, 0, 0, 140),
    )
    background.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)))
    background.alpha_composite(card, (x, y))


def _draw_brand(draw: ImageDraw.ImageDraw, brand: str) -> None:
    if not brand:
        return
    font = _font(40)
    width = int(draw.textlength(brand, font=font)) + 72
    x, y, height = (W - width) // 2, 96, 88
    draw.rounded_rectangle(
        (x, y, x + width, y + height),
        radius=44,
        fill=(255, 255, 255, 22),
        outline=(*PURPLE, 160),
        width=2,
    )
    draw.text((W / 2, y + height / 2), brand, font=font, fill=GREY, anchor="mm")


def _draw_card(background: Image.Image, segment: Segment, layout: VerticalLayout) -> None:
    if segment.image is not None:
        source = Image.open(segment.image).convert("RGB")
        card = ImageOps.fit(
            source,
            (CARD_W, layout.card.height),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
    else:
        card = Image.new("RGB", (CARD_W, layout.card.height), (28, 23, 40))
    card = _rounded(card, 48)
    _paste_shadowed(background, card, (W - CARD_W) // 2, layout.card.top)

    if segment.image is None:
        draw = ImageDraw.Draw(background)
        font = _font(92, bold=True)
        lines = wrap_text(draw, segment.card_text, font, CARD_W - 160)
        line_height = 116
        start = layout.card.top + (layout.card.height - len(lines) * line_height) / 2
        for index, line in enumerate(lines):
            draw.text(
                (W / 2, start + index * line_height + line_height / 2),
                line,
                font=font,
                fill=WHITE,
                anchor="mm",
            )


def render_segment_frame(job: ShortsJob, segment: Segment, index: int, output: Path) -> VerticalLayout:
    background = _gradient()
    draw = ImageDraw.Draw(background)
    _draw_brand(draw, job.brand)

    caption_font = _font(76, bold=True)
    narration_font = _font(56)
    caption_lines = wrap_text(draw, segment.caption, caption_font, W - 160)
    narration_lines = wrap_text(draw, segment.text, narration_font, W - 200)
    layout = compute_vertical_layout(
        len(caption_lines),
        len(narration_lines),
        preferred_card_height=620 if segment.image is None else 940,
        minimum_card_height=500 if segment.image is None else 560,
    )

    _draw_card(background, segment, layout)

    for line_index, line in enumerate(caption_lines):
        y = layout.caption.top + line_index * 104 + 52
        draw.text((W / 2 + 2, y + 3), line, font=caption_font, fill=(0, 0, 0, 160), anchor="mm")
        draw.text((W / 2, y), line, font=caption_font, fill=WHITE, anchor="mm")

    if narration_lines:
        max_width = max(draw.textlength(line, font=narration_font) for line in narration_lines)
        chip = (
            W / 2 - max_width / 2 - 28,
            layout.narration.top,
            W / 2 + max_width / 2 + 28,
            layout.narration.bottom,
        )
        draw.rounded_rectangle(chip, radius=20, fill=(0, 0, 0, 180))
        for line_index, line in enumerate(narration_lines):
            y = layout.narration.top + 10 + line_index * 76 + 38
            draw.text((W / 2, y), line, font=narration_font, fill=(232, 229, 240), anchor="mm")

    dot_y, gap = H - 140, 36
    start_x = W / 2 - (len(job.segments) - 1) * gap / 2
    for dot_index in range(len(job.segments)):
        color = PURPLE if dot_index == index else (90, 86, 104)
        radius = 10 if dot_index == index else 7
        x = start_x + dot_index * gap
        draw.ellipse((x - radius, dot_y - radius, x + radius, dot_y + radius), fill=color)

    output.parent.mkdir(parents=True, exist_ok=True)
    buffer = BytesIO()
    background.convert("RGB").save(buffer, "PNG", optimize=True)
    rendered = buffer.getvalue()
    if not output.is_file() or output.read_bytes() != rendered:
        output.write_bytes(rendered)
    return layout
