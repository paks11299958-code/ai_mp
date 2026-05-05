---
name: prisma-migration
description: Prisma 마이그레이션 전 체크리스트를 실행하고 안전하게 마이그레이션을 진행합니다
disable-model-invocation: false
---

# Prisma Migration Skill

이 프로젝트에서 Prisma 마이그레이션 실수로 Vercel 배포 오류가 난 경험이 있습니다.
마이그레이션 전 아래 체크리스트를 순서대로 따르세요.

## 체크리스트

### 1. 스키마 변경 확인
```bash
git diff prisma/schema.prisma
```
변경 내용이 의도한 것인지 확인합니다.

### 2. 로컬 마이그레이션 생성 (이름 필수)
```bash
npx prisma migrate dev --name <변경_내용_설명>
```
예: `npx prisma migrate dev --name add_user_memory_table`

### 3. Prisma Client 재생성 확인
```bash
npx prisma generate
```
`src/generated/prisma/` 디렉토리가 업데이트되었는지 확인합니다.

### 4. generated 폴더 커밋에 포함 (필수!)
```bash
git status src/generated/prisma/
```
이 파일들이 커밋에 포함되지 않으면 Vercel 빌드가 실패합니다.

### 5. Vercel 환경변수 확인
- `DATABASE_URL` — Vercel 프로젝트 환경변수에 올바른 PostgreSQL URL이 설정되어 있는지 확인
- 로컬 `.env`와 Vercel 환경변수가 다를 수 있으니 반드시 Vercel 대시보드에서 확인

### 6. 배포 전 빌드 테스트
```bash
npx tsc --noEmit --skipLibCheck
```

## 주의사항
- `prisma migrate deploy`는 프로덕션용 — 로컬에서는 `migrate dev`를 사용
- 마이그레이션 파일(`prisma/migrations/`)은 절대 수동 수정하지 말 것
- `src/generated/prisma/`는 `.gitignore`에 없어야 함 (커밋 대상)
