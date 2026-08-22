"""프레임 렌더링부터 영상 조립까지 담당하는 로컬 파이프라인."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .job import ShortsJob, load_job, missing_assets
from .renderer import render_segment_frame


SHORTS_FACTORY_HOME = Path("/home/paks11299958/shorts-factory")


class MissingAssetsError(RuntimeError):
    pass


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def prepare(job_path: str | Path) -> ShortsJob:
    job = load_job(job_path)
    job.work_dir.mkdir(parents=True, exist_ok=True)
    missing = missing_assets(job)
    _write_json(job.work_dir / "image-tasks.json", [row for row in missing if row["kind"] == "image"])
    _write_json(
        job.work_dir / "status.json",
        {
            "jobId": job.job_id,
            "status": "awaiting_assets" if missing else "ready",
            "missing": missing,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    if missing:
        raise MissingAssetsError(
            f"입력 파일 {len(missing)}개가 없습니다. {job.work_dir / 'status.json'}을 확인하세요."
        )
    return job


def render_frames(job: ShortsJob) -> list[Path]:
    frames: list[Path] = []
    layouts: list[dict[str, object]] = []
    for index, segment in enumerate(job.segments):
        frame = job.work_dir / f"seg{index}.png"
        layout = render_segment_frame(job, segment, index, frame)
        frames.append(frame)
        layouts.append(
            {
                "segment": index,
                "card": {"top": layout.card.top, "bottom": layout.card.bottom},
                "caption": {"top": layout.caption.top, "bottom": layout.caption.bottom},
                "narration": {"top": layout.narration.top, "bottom": layout.narration.bottom},
                "gap": layout.narration.top - layout.caption.bottom,
            }
        )
    _write_json(job.work_dir / "layouts.json", layouts)
    return frames


def _clip_is_current(clip: Path, frame: Path, audio: Path, duration: float, probe) -> bool:
    if not clip.is_file() or clip.stat().st_size < 1024:
        return False
    if clip.stat().st_mtime < max(frame.stat().st_mtime, audio.stat().st_mtime):
        return False
    try:
        return abs(probe(clip) - duration) < 0.05
    except Exception:
        return False


def _output_is_current(output: Path, clips: list[Path], duration: float, probe) -> bool:
    if not output.is_file() or output.stat().st_size < 1024:
        return False
    if output.stat().st_mtime < max(clip.stat().st_mtime for clip in clips):
        return False
    try:
        return abs(probe(output) - duration) < 0.05
    except Exception:
        return False


def build(job_path: str | Path, *, render_only: bool = False, force: bool = False) -> Path:
    job = prepare(job_path)
    frames = render_frames(job)
    if render_only:
        return job.work_dir

    sys.path.insert(0, str(SHORTS_FACTORY_HOME))
    from make_short import audio_duration, build_segment_clip, concat_clips_with_transitions

    clips: list[Path] = []
    for index, (segment, frame) in enumerate(zip(job.segments, frames)):
        duration = audio_duration(segment.audio) + segment.tail_padding
        clip = job.work_dir / f"seg{index}.mp4"
        if force or not _clip_is_current(clip, frame, segment.audio, duration, audio_duration):
            build_segment_clip(frame, segment.audio, duration, clip, index)
        clips.append(clip)

    expected_duration = sum(audio_duration(clip) for clip in clips)
    if force or not _output_is_current(job.output, clips, expected_duration, audio_duration):
        duration = concat_clips_with_transitions(clips, job.output, job.work_dir)
    else:
        duration = expected_duration
    _write_json(
        job.work_dir / "status.json",
        {
            "jobId": job.job_id,
            "status": "completed",
            "output": str(job.output),
            "duration": duration,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    return job.output
