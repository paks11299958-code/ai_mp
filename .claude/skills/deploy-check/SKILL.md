---
name: deploy-check
description: Vercel 배포 전 체크리스트를 실행합니다. vercel.json, 환경변수, cron job, Prisma 설정을 점검합니다.
disable-model-invocation: false
---

# Deploy Check Skill

Vercel 배포 전 아래 항목들을 순서대로 점검합니다.

## 1. TypeScript 빌드 오류 확인
```bash
npx tsc --noEmit --skipLibCheck
```
오류가 있으면 배포 전에 반드시 수정합니다.

## 2. vercel.json 설정 점검
확인 항목:
- `functions["api/router.ts"].includeFiles`에 `src/generated/prisma/**`가 포함되어 있는지
- `rewrites` 경로가 실제 API 라우트와 일치하는지
- `crons` 경로(`/api/cron-cleanup`)가 실제 파일로 존재하는지

## 3. Prisma Generated 파일 커밋 확인
```bash
git status src/generated/prisma/
```
변경된 파일이 있으면 반드시 커밋에 포함합니다.

## 4. 환경변수 확인 항목
Vercel 대시보드에서 아래 변수들이 설정되어 있는지 확인:
- `DATABASE_URL` — PostgreSQL 연결 문자열
- `JWT_SECRET` — JWT 서명 키
- `GEMINI_API_KEY` — Google Gemini API 키
- `GCS_BUCKET_NAME` — Google Cloud Storage 버킷명
- `GOOGLE_SERVICE_ACCOUNT_KEY` — GCS 서비스 계정 JSON

## 5. 빌드 커맨드 확인
`vercel.json`의 `buildCommand`가 아래와 같은지 확인:
```
npm install && npx prisma generate && npm install --prefix frontend && npm run build --prefix frontend
```

## 6. Git 상태 확인
```bash
git status
git log --oneline -5
```
커밋되지 않은 변경사항이 없는지 확인합니다.

## 배포 실행
모든 체크 통과 후:
```bash
# Vercel CLI가 설치되어 있다면
vercel --prod

# 또는 Git push로 자동 배포
git push origin master
```
