"""쇼츠 공장 v2 명령행 인터페이스."""

from __future__ import annotations

import argparse

from .job import JobValidationError
from .layout import LayoutOverflowError
from .pipeline import MissingAssetsError, build, prepare


def main() -> int:
    parser = argparse.ArgumentParser(description="GCP3 없는 쇼츠 공장 v2")
    parser.add_argument("job", help="작업 JSON 경로")
    parser.add_argument("--prepare", action="store_true", help="입력과 이미지 준비 상태만 확인")
    parser.add_argument("--render-only", action="store_true", help="PNG 프레임까지만 생성")
    parser.add_argument("--force", action="store_true", help="장면 캐시를 무시하고 다시 인코딩")
    args = parser.parse_args()
    try:
        if args.prepare:
            job = prepare(args.job)
            print(f"준비 완료: {job.job_id}")
        else:
            output = build(args.job, render_only=args.render_only, force=args.force)
            print(f"완료: {output}")
        return 0
    except (JobValidationError, MissingAssetsError, LayoutOverflowError) as exc:
        print(f"실패: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
