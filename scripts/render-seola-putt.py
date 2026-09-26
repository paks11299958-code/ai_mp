"""Render deterministic Seola putting clips with Blender's video sequencer.

Run from the repository root:
  blender --background --python scripts/render-seola-putt.py
"""

from __future__ import annotations

import binascii
import math
import struct
import zlib
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "seola"
WORK_DIR = ROOT / ".render" / "seola-putt"
FPS = 30
LAST_FRAME = 150


def write_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", binascii.crc32(kind + data) & 0xFFFFFFFF)

    rows = b"".join(b"\x00" + pixels[y * width * 4 : (y + 1) * width * 4] for y in range(height))
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def make_ball_sprite(path: Path, size: int = 128) -> None:
    data = bytearray(size * size * 4)
    cx = cy = (size - 1) / 2
    radius = size * 0.42
    light = (-0.42, 0.5, 0.75)
    dimples = [(0.34, 0.2, 0.07), (-0.26, 0.35, 0.055), (0.05, -0.26, 0.06), (-0.4, -0.12, 0.045)]
    for y in range(size):
        for x in range(size):
            nx, ny = (x - cx) / radius, (cy - y) / radius
            d2 = nx * nx + ny * ny
            if d2 > 1:
                continue
            nz = math.sqrt(max(0.0, 1 - d2))
            shade = 0.72 + 0.28 * max(0.0, nx * light[0] + ny * light[1] + nz * light[2])
            for dx, dy, dr in dimples:
                dd = math.hypot(nx - dx, ny - dy)
                if dd < dr:
                    shade *= 0.78 + 0.22 * dd / dr
            edge = min(1.0, max(0.0, (1 - math.sqrt(d2)) * 12))
            value = int(246 * shade)
            i = (y * size + x) * 4
            data[i : i + 4] = bytes((value, value, min(255, value + 4), int(255 * edge)))
    write_png(path, size, size, bytes(data))


def make_shadow_sprite(path: Path, width: int = 160, height: int = 64) -> None:
    data = bytearray(width * height * 4)
    for y in range(height):
        for x in range(width):
            nx = (x - (width - 1) / 2) / (width * 0.42)
            ny = (y - (height - 1) / 2) / (height * 0.28)
            distance = nx * nx + ny * ny
            alpha = int(70 * max(0.0, 1.0 - distance) ** 2)
            i = (y * width + x) * 4
            data[i : i + 4] = bytes((12, 20, 14, alpha))
    write_png(path, width, height, bytes(data))


def add_still(editor, name: str, path: Path, channel: int, alpha_keys: list[tuple[int, float]]):
    strip = editor.strips.new_image(name, str(path), channel, 1)
    strip.frame_final_duration = LAST_FRAME
    strip.blend_type = "ALPHA_OVER"
    for frame, alpha in alpha_keys:
        strip.blend_alpha = alpha
        strip.keyframe_insert(data_path="blend_alpha", frame=frame)
    return strip


def add_motion_sprite(editor, name: str, path: Path, channel: int, start, end, scale_start, scale_end, *, shadow=False):
    source = editor.strips.new_image(name + " source", str(path), channel, 1)
    source.frame_final_duration = LAST_FRAME
    source.blend_type = "ALPHA_OVER"
    effect = editor.strips.new_effect(name, "TRANSFORM", channel + 1, 1, frame_end=LAST_FRAME + 1, input1=source)
    effect.blend_type = "ALPHA_OVER"
    effect.translation_unit = "PIXELS"
    effect.use_uniform_scale = False
    effect.interpolation = "BICUBIC"

    # Ease-out path: most speed follows impact, then the ball settles at the cup.
    keys = [
        (1, *start, scale_start, 0.0),
        (58, *start, scale_start, 0.0),
        (60, *start, scale_start, 1.0),
        (76, start[0] * 0.64 + end[0] * 0.36, start[1] * 0.64 + end[1] * 0.36, scale_start * 1.55, 1.0),
        (95, start[0] * 0.3 + end[0] * 0.7, start[1] * 0.3 + end[1] * 0.7, scale_start * 2.8, 1.0),
        (114, *end, scale_end, 1.0),
        (119, end[0], end[1] - (3 if shadow else 8), scale_end * (0.72 if shadow else 0.62), 0.0),
        (LAST_FRAME, end[0], end[1] - 8, scale_end * 0.6, 0.0),
    ]
    for frame, x, y, scale, alpha in keys:
        effect.translate_start_x = x
        effect.translate_start_y = y
        effect.scale_start_x = scale
        effect.scale_start_y = scale * (0.42 if shadow else 1.0)
        effect.rotation_start = 0 if shadow else -math.radians(max(0, frame - 58) * 10.5)
        effect.blend_alpha = alpha
        for prop in ("translate_start_x", "translate_start_y", "scale_start_x", "scale_start_y", "rotation_start", "blend_alpha"):
            effect.keyframe_insert(data_path=prop, frame=frame)
    return effect


def render_variant(name: str, width: int, height: int, start: tuple[float, float], end: tuple[float, float], ball_sizes: tuple[float, float]) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = LAST_FRAME
    scene.render.fps = FPS
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.ffmpeg.ffmpeg_preset = "GOOD"
    scene.render.ffmpeg.audio_codec = "NONE"
    scene.render.filepath = str(ASSET_DIR / f"seola-putt-{name}-v8.mp4")
    scene.view_settings.look = "AgX - Medium High Contrast"

    editor = scene.sequence_editor_create()
    suffix = "desktop" if name == "desktop" else "mobile"
    add_still(editor, "address", ASSET_DIR / f"putt-address-{suffix}-v7.webp", 1, [(1, 1), (150, 1)])
    add_still(editor, "backswing", ASSET_DIR / f"putt-back-{suffix}-v7.webp", 2, [(1, 0), (25, 0), (31, 1), (43, 1), (49, 0), (150, 0)])
    add_still(editor, "impact", ASSET_DIR / f"putt-thru-{suffix}-v7.webp", 3, [(1, 0), (43, 0), (49, 1), (61, 1), (69, 0), (150, 0)])
    add_still(editor, "follow", ASSET_DIR / f"putt-follow-{suffix}-v7.webp", 4, [(1, 0), (59, 0), (66, 1), (88, 1), (98, 0), (150, 0)])

    shadow_start = (start[0] + 4, start[1] - 6)
    shadow_end = (end[0] + 5, end[1] - 5)
    add_motion_sprite(editor, "ball shadow", WORK_DIR / "shadow.png", 5, shadow_start, shadow_end, ball_sizes[0] * 0.72, ball_sizes[1] * 0.72, shadow=True)
    add_motion_sprite(editor, "golf ball", WORK_DIR / "ball.png", 7, start, end, ball_sizes[0], ball_sizes[1])

    bpy.ops.wm.save_as_mainfile(filepath=str(WORK_DIR / f"seola-putt-{name}.blend"))
    bpy.ops.render.render(animation=True)


WORK_DIR.mkdir(parents=True, exist_ok=True)
make_ball_sprite(WORK_DIR / "ball.png")
make_shadow_sprite(WORK_DIR / "shadow.png")

# Coordinates are pixels relative to the frame center, with positive Y upward.
render_variant("desktop", 1672, 936, (189, -203), (-1, -378), (0.16, 0.77))
render_variant("mobile", 942, 1674, (16, -177), (-154, -592), (0.17, 1.10))
