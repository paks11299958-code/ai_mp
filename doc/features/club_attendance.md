# 모임(출첵) 시스템

> 추가일: 2026-05-27  
> 진입점: 지우 페르소나 → **🤝 모임(출첵)** 버튼 (로그인 필요)

---

## 개요

모임(동호회) 단위로 QR 코드 출석체크를 관리하는 기능.  
관리자(OWNER)는 모임을 만들고 출석부(QR)를 생성, 출석자는 QR 찍으면 앱 가입 없이 출석 가능.

---

## 구성 요소

### 프론트엔드
| 파일 | 역할 |
|------|------|
| `frontend/components/ClubBoard.tsx` | 모임 관리 모달 (관리자용) |
| `frontend/components/AttendPage.tsx` | QR 출석 페이지 (공개, 모바일) |
| `frontend/index.tsx` | `/attend/:uuid` 경로 감지 → AttendPage 렌더링 |

### 백엔드 (shared-api)
| 파일 | 역할 |
|------|------|
| `routes/aimp/clubs.ts` | 모임/회원/출석부/공지 CRUD (JWT 필요) |
| `routes/aimp/attendance.ts` | QR 출석 체크 (공개, 인증 불필요) |

---

## API 목록

### clubs.ts (JWT 필요)
```
POST   /api/clubs                              모임 생성 (OWNER 자동 등록)
GET    /api/clubs                              내 모임 목록
GET    /api/clubs/:id                          모임 상세
PATCH  /api/clubs/:id                          모임 수정 (OWNER)
DELETE /api/clubs/:id                          모임 삭제 (OWNER, cascade)
GET    /api/clubs/:id/members                  회원 명부 + 출석 횟수 (OWNER)
POST   /api/clubs/:id/sheets                   출석부 생성 (OWNER)
GET    /api/clubs/:id/sheets                   출석부 목록
GET    /api/clubs/:id/sheets/:sid/records      출석 명단 (OWNER)
GET    /api/clubs/:id/notices                  공지 목록 (멤버)
POST   /api/clubs/:id/notices                  공지 작성 (OWNER)
DELETE /api/clubs/:id/notices/:nid             공지 삭제 (OWNER)
```

### attendance.ts (공개)
```
GET  /api/attendance/:sheetUuid         출석부 정보 (UUID 형식 검증 필수)
POST /api/attendance/:sheetUuid/check   출석 체크
  body: { phone }          → 기존 회원: 즉시 출석 or 이미출석
  body: { phone, nickname } → 신규 회원: ClubMember 생성 + 출석
```

### user.ts (JWT 필요)
```
PATCH /api/user/phone   전화번호 등록 → ClubMember 자동 연결
```

---

## QR 출석 흐름

```
관리자: 출석부 생성 → qrUuid 발급 → QR 이미지 화면에 표시
출석자: QR 찍기 → /attend/:sheetUuid → 폰번호 입력
  ├─ 기존 회원 → 출석 완료 → "이 창을 닫아주세요" 표시
  ├─ 이미 출석 → 중복 안내 → "이 창을 닫아주세요" 표시
  └─ 신규 → 이름 입력 → ClubMember 생성 + 출석 완료
```

---

## 회원 연결 흐름

```
QR 출석 → ClubMember(userId=null, phone=xxx) 생성
       ↓
앱 가입(폰번호) 또는 프로필에서 폰번호 등록
       ↓
updateMany({ phone: xxx, userId: null } → { userId: 나 })
       ↓
모임 목록에 자동으로 나타남
```

---

## 주요 트러블슈팅

| 문제 | 원인 | 해결 |
|------|------|------|
| 500 ReferenceError: Must call super | Prisma 7.8.0 + Node v24: 잘못된 UUID로 쿼리 시 에러 클래스 생성자 crash | 라우트에서 UUID 정규식 검증 먼저 수행 |
| BigInt 필드 오류 | Prisma 7.8.0 BigInt 비호환 | 모든 ID를 Int로 변경 |
| ClubNotice 500 | DB 컬럼 snake_case vs Prisma camelCase 불일치 | `@map("club_id")`, `@map("created_at")` 추가 |
| 스키마 변경 후 모델 없음 | 서버1에서 prisma generate 미실행 | 스키마 변경 시 반드시 서버1에서 generate 실행 |

---

## Vercel 라우팅 (vercel.json)

```json
{ "source": "/attend/:sheetUuid", "destination": "/index.html" }
{ "source": "/api/clubs", "destination": "http://서버1:3020/api/aimp/clubs" }
{ "source": "/api/clubs/:path*", "destination": "http://서버1:3020/api/aimp/clubs/:path*" }
{ "source": "/api/attendance/:path*", "destination": "http://서버1:3020/api/aimp/attendance/:path*" }
```
