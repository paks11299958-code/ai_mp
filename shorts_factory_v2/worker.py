"""백그라운드 렌더 진입점 — 실패도 반드시 status.json에 기록한다."""
from __future__ import annotations

import json
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

from .job import load_job
from .pipeline import build


def _write_status(job_path: Path, payload: dict) -> None:
    work_dir = job_path.parent / '_work'
    work_dir.mkdir(parents=True, exist_ok=True)
    target = work_dir / 'status.json'
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(target)


def run(job_path: str | Path) -> int:
    source = Path(job_path).resolve()
    job_id = source.stem
    try:
        job_id = load_job(source).job_id
        _write_status(source, {
            'jobId': job_id, 'status': 'rendering',
            'updatedAt': datetime.now(timezone.utc).isoformat(),
        })
        build(source)
        return 0
    except Exception as exc:
        _write_status(source, {
            'jobId': job_id, 'status': 'failed', 'error': str(exc)[:1000],
            'updatedAt': datetime.now(timezone.utc).isoformat(),
        })
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('사용법: python -m shorts_factory_v2.worker JOB.json', file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(run(sys.argv[1]))
