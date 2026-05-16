# Vercel 배포 가이드

> 최종 업데이트: 2026-05-16

---

## 배포 구조

| 항목 | 값 |
|------|-----|
| 프로젝트명 | ai-mp |
| Vercel Org | park-kwang-seorks-projects |
| Production Branch | `master` |
| Custom Domain | `aichat.dbzone.kr` |
| Output Directory | `frontend/dist` |

---

## 코드 푸시 방법

로컬은 `main` 브랜치에서 작업 후 `master`로 푸시:

```bash
git push origin main:master
```

- `master` → Vercel Production 배포 트리거
- `main` 단독 푸시 → Preview 배포만 됨 (도메인 반영 안 됨)

---

## ⚠️ 커스텀 도메인 반영 방법 (중요)

이 프로젝트는 **custom domain auto-assignment가 비활성화**되어 있음.  
git push 또는 대시보드 Redeploy 후 반드시 수동으로 도메인 연결 확인 필요.

### 배포 후 도메인 반영 절차

1. Vercel 대시보드 → `ai-mp` 프로젝트 → **Deployments** 탭
2. 최신 배포 옆 **`···`** 클릭
3. **"Promote to Production"** 클릭
4. `aichat.dbzone.kr`이 새 배포에 연결됨

### 정상 상태 확인

- Redeploy 화면에서 **"Assigned domains: aichat.dbzone.kr"** 표시 → ✅ 자동 연결됨
- **"Custom domains won't be assigned—auto-assignment is disabled"** 경고 → ❌ Promote to Production 필요

---

## Vercel 라우팅 구조

```
/api/luxury-verify  →  rewrite  →  /api/router?d=luxury-verify
/api/personas       →  rewrite  →  /api/router?d=personas
/api/:d/:s1         →  rewrite  →  /api/router?d=:d&s1=:s1
```

- 모든 `/api/*` 요청은 `vercel.json` rewrites → `api/router.ts`로 처리
- `api/[...path].ts` 파일은 삭제됨 (라우팅 충돌 원인이었음)
- `vercel.json` functions 설정에 없는 파일은 Prisma 바이너리 미포함 → 런타임 오류 발생 가능

---

## 빌드 캐시 이슈

Vercel이 frontend 빌드를 캐시해서 새 파일이 반영 안 될 수 있음.

강제 재빌드 방법:
- Vercel 대시보드 → Deployments → 최신 배포 `···` → **Redeploy**
- **"Use existing Build Cache"** 체크 해제 후 Redeploy

---

## MANAGE 역할

- `role = 'MANAGE'`: 모든 기능 사용 가능, 일일 제한 없음, 어드민 패널 미표시
- 어드민 패널에서 사용자 role 변경 가능 (USER / MANAGE / ADMIN)
- 명품 감정, 주식 분석 등 일일 제한 기능 모두 무제한
