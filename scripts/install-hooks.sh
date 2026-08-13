#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# git hook 설치 — 커밋·푸시 시점에 자동 검증한다.
#
# 배경(2026-07-28): 코드를 고치고 빌드만 돌려보고 "됐다"고 판단해 커밋 → 배포 →
# 앱 전체가 백지가 됐다. 검증을 "기억해서 돌리는 것"에 맡기면 결국 안 돌린다.
# 커밋 훅은 기억과 무관하게 걸린다.
#
# 2026-08-14 개편: 훅 본체를 이 파일 안의 heredoc에서 scripts/hooks/ 로 분리했다.
#   - .git/hooks/ 는 git 추적이 안 돼 백업·클론이 되지 않는다
#   - 훅이 길어지면서 heredoc 안에서는 수정·리뷰가 어려워졌다
#   - pre-push 를 추가해 --no-verify 우회를 뒤에서 한 번 더 잡는다
#
# 설치: bash scripts/install-hooks.sh   (레포당 1회, .git/hooks는 clone 시 안 따라옴)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

SRC="scripts/hooks"
DST=".git/hooks"

for hook in pre-commit pre-push; do
    [ -f "$SRC/$hook" ] || { echo "⏭  $SRC/$hook 없음 — 건너뜀"; continue; }

    # 기존 훅이 있고 우리가 심은 게 아니면 백업해 둔다
    if [ -f "$DST/$hook" ] && ! cmp -s "$SRC/$hook" "$DST/$hook"; then
        if ! grep -q "scripts/hooks" "$DST/$hook" 2>/dev/null; then
            cp "$DST/$hook" "$DST/$hook.bak-$(date +%Y%m%d-%H%M%S)"
            echo "📦 기존 $hook 백업함"
        fi
    fi

    cp "$SRC/$hook" "$DST/$hook"
    chmod +x "$DST/$hook"
    echo "✅ $hook 설치됨"
done

echo ""
echo "설치 완료. 확인:  ls -l .git/hooks/pre-commit .git/hooks/pre-push"
