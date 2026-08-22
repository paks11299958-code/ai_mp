"""쇼츠 작업 JSON 로딩과 입력 검증."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


class JobValidationError(ValueError):
    pass


@dataclass(frozen=True)
class Segment:
    caption: str
    text: str
    audio: Path
    image: Path | None = None
    image_prompt: str = ""
    card_text: str = ""
    tail_padding: float = 0.85


@dataclass(frozen=True)
class ShortsJob:
    job_id: str
    title: str
    brand: str
    character_bible: str
    segments: tuple[Segment, ...]
    source: Path

    @property
    def root(self) -> Path:
        return self.source.parent

    @property
    def work_dir(self) -> Path:
        return self.root / "_work"

    @property
    def output(self) -> Path:
        return self.root / f"{self.job_id}.mp4"


def _resolve(root: Path, value: object, field: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise JobValidationError(f"{field} 경로가 비어 있습니다")
    path = Path(value)
    return path if path.is_absolute() else (root / path).resolve()


def load_job(path: str | Path) -> ShortsJob:
    source = Path(path).resolve()
    try:
        raw = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise JobValidationError(f"작업 JSON을 읽을 수 없습니다: {exc}") from exc

    job_id = str(raw.get("id") or "").strip()
    if not job_id or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for ch in job_id):
        raise JobValidationError("id는 영문·숫자·하이픈·밑줄만 사용할 수 있습니다")

    rows = raw.get("segments")
    if not isinstance(rows, list) or not 1 <= len(rows) <= 10:
        raise JobValidationError("segments는 1~10개여야 합니다")

    segments: list[Segment] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise JobValidationError(f"segments[{index}]가 객체가 아닙니다")
        caption = str(row.get("caption") or "").strip()
        text = str(row.get("text") or "").strip()
        card_text = str(row.get("cardText") or "").strip()
        if not caption:
            raise JobValidationError(f"segments[{index}].caption이 비어 있습니다")
        if not text:
            raise JobValidationError(f"segments[{index}].text가 비어 있습니다")
        image_value = row.get("image")
        image = _resolve(source.parent, image_value, f"segments[{index}].image") if image_value else None
        if image is None and not card_text:
            raise JobValidationError(
                f"segments[{index}]는 image 또는 cardText 중 하나가 필요합니다"
            )
        try:
            tail_padding = float(row.get("tailPadding", 0.85))
        except (TypeError, ValueError) as exc:
            raise JobValidationError(f"segments[{index}].tailPadding이 숫자가 아닙니다") from exc
        if not 0 <= tail_padding <= 3:
            raise JobValidationError(f"segments[{index}].tailPadding은 0~3초여야 합니다")
        segments.append(
            Segment(
                caption=caption,
                text=text,
                audio=_resolve(source.parent, row.get("audio"), f"segments[{index}].audio"),
                image=image,
                image_prompt=str(row.get("imagePrompt") or "").strip(),
                card_text=card_text,
                tail_padding=tail_padding,
            )
        )

    return ShortsJob(
        job_id=job_id,
        title=str(raw.get("title") or job_id).strip(),
        brand=str(raw.get("brand") or "AI 놀이터 · aichat.dbzone.kr").strip(),
        character_bible=str(raw.get("characterBible") or "").strip(),
        segments=tuple(segments),
        source=source,
    )


def missing_assets(job: ShortsJob) -> list[dict[str, object]]:
    missing: list[dict[str, object]] = []
    for index, segment in enumerate(job.segments):
        if not segment.audio.is_file():
            missing.append({"segment": index, "kind": "audio", "path": str(segment.audio)})
        if segment.image is not None and not segment.image.is_file():
            missing.append(
                {
                    "segment": index,
                    "kind": "image",
                    "path": str(segment.image),
                    "prompt": segment.image_prompt,
                    "characterBible": job.character_bible,
                }
            )
    return missing
