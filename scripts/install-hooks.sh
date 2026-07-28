#!/bin/bash
# git hook 설치 — 커밋 시점에 자동 검증한다.
#
# 배경(2026-07-28): 코드를 고치고 빌드만 돌려보고 "됐다"고 판단해 커밋 → 배포 →
# 앱 전체가 백지가 됐다. 검증을 "기억해서 돌리는 것"에 맡기면 결국 안 돌린다.
# 커밋 훅은 기억과 무관하게 걸린다.
#
# 설치: bash scripts/install-hooks.sh   (레포당 1회, .git/hooks는 clone 시 안 따라옴)

set -e
HOOK_DIR="$(git rev-parse --git-dir)/hooks"
mkdir -p "$HOOK_DIR"

cat > "$HOOK_DIR/pre-commit" <<'HOOK'
#!/bin/bash
# 스테이징된 프론트엔드 코드가 있을 때만 검사한다(문서·설정만 고친 커밋은 그냥 통과).
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^frontend/.*\.(ts|tsx)$' || true)
[ -z "$STAGED" ] && exit 0

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

echo "▶ React 안전 검사 (커밋된 프론트 파일 $(echo "$STAGED" | wc -l)개)"
if ! node scripts/check-react-safety.cjs; then
    echo ""
    echo "✋ 커밋을 중단했습니다. 위 문제를 고친 뒤 다시 커밋하세요."
    echo "   (의도적으로 넘기려면: git commit --no-verify)"
    exit 1
fi

echo "▶ 타입 체크"
if ! (cd frontend && npx tsc --noEmit); then
    echo ""
    echo "✋ 타입 에러로 커밋을 중단했습니다."
    exit 1
fi

echo "✅ 커밋 전 검증 통과"
HOOK

chmod +x "$HOOK_DIR/pre-commit"
echo "✅ pre-commit 훅 설치됨: $HOOK_DIR/pre-commit"
echo "   프론트엔드 .ts/.tsx 커밋 시 React 안전검사 + 타입체크가 자동 실행됩니다."
