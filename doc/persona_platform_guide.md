# AI Persona 플랫폼 뼈대 — 개발 지침서

- 작성: 2026-07-31 (사장 지시 — "나중에 Marketplace가 될 수 있는 뼈대를 지금부터 심는다")
- 대상 독자: 나중 세션의 Claude(Opus 등). **이 문서만 읽고 착수 가능**하도록 씀.
- 전제: 코드 검토 결과 제안 구조의 70~80%는 이미 구현돼 있음. 이 문서는 **남은 공백**과
  **개발 시 지켜야 할 방향**을 기록한다.

---

## 0. 전략 요약 (왜 이 뼈대인가)

- 지금 Marketplace를 만드는 게 아니다. **나중에 Marketplace가 될 수 있는 구조로
  작은 서비스를 계속 쌓는 단계**다 (닭-달걀 문제 회피: 판매자·구매자 둘 다 없는
  상태에서 플랫폼을 열면 안 됨).
- 사용자에게는 "AI 쇼츠 만들기", "AI 생일 영상" 같은 **개별 상품**으로 보이지만,
  내부는 `User → Persona → Engine(기능) → Template → Output` 축으로 설계한다.
- 단계:
  - **1단계(현재)**: 운영자(사장)가 직접 만든 Persona를 상품화. creator = 나 하나.
  - **2단계**: 사용자 수요가 생기면 Persona Builder(제작 도구) 오픈.
  - **3단계(2~3년 뒤)**: 외부 제작자 등록·검수·수익 배분 → Marketplace.
- 핵심 원칙: **1단계 코드를 짤 때도 creator_id가 "외부 제작자"로 바뀔 수 있는
  구조를 유지**한다. 나중에 뜯어고치지 않게.

---

## 1. 현재 구조 진단 (2026-07-31 기준) — 이미 돼 있는 것

새로 만들지 말 것. 아래는 **이미 있다.**

| 뼈대 요소 | 현재 구현 | 위치 |
|---|---|---|
| Persona 테이블 | id·name·jobTitle·description·systemInstruction(=prompt)·identityPrompt·categoryId(FK)·**createdBy(=creator_id, User FK)**·features·isVisible·adminOnly | shared-api `prisma/schema.prisma` model Persona (ai_mp 쪽 스키마는 사본) |
| 카테고리 | 별도 Category 테이블 FK | 〃 |
| Engine 분리 | 페르소나↔기능이 `features` JSON 키 배열로 N:N 연결. 같은 엔진(기능)을 여러 페르소나가 공유 가능, 어드민 체크박스로 관리 | `ai_mp/frontend/personaFeatures.ts` (FEATURE_REGISTRY, 22키) + shared-api `routes/aimp/*.ts` (62라우트) |
| 판매 기록(sales) | PointTransaction에 **personaId 연결됨** → 페르소나 단위 매출 집계 지금도 가능 | schema.prisma model PointTransaction |
| 후원 | Star(페르소나별 별풍선) | 〃 model Star |
| 과금 기반 | User.paidPoints/bonusPoints + MenuLimit(기능×역할 단위 pointsCost·dailyLimit) + MenuUsageLog | 〃 |
| 수수료 개념 | referralCommission.ts (추천인 커미션) | shared-api `lib/referralCommission.ts` |

**결론**: Persona/Engine/판매기록 축은 완성. 공백은 아래 2절의 4개.

---

## 2. 부족한 것 — 개발 과제 (우선순위 순)

### 과제 A. NAME_FALLBACK 제거 — 완전 데이터 주도화 ★첫 번째로 할 것

**현상**: `ai_mp/frontend/personaFeatures.ts`의 `NAME_FALLBACK`에 페르소나 **이름**
하드코딩 폴백이 9명분 남아 있다('서아'·'윤채원'·'이아린' 등). 이름은 표시용 라벨이라
바뀌면 기능이 조용히 사라진다. 마켓플레이스 구조(데이터가 기능을 결정)와 정면 상충하는
유일한 잔재. `isGolf()`의 이름/직함 문자열 판별도 같은 부류다.

**작업 순서**:
1. DB에서 features가 비어 있는 페르소나 목록 확인:
   `SELECT id, name, features FROM "Persona" WHERE features IS NULL OR features = '' OR features = '[]';`
2. NAME_FALLBACK·isGolf 로직이 주던 키를 각 페르소나의 `features` 컬럼에 채운다
   (어드민 페르소나 편집 화면에서 체크박스로 저장하거나, 일회성 UPDATE SQL).
3. **채운 뒤 실화면에서 각 페르소나의 기능 버튼이 그대로 나오는지 확인**하고 나서
   NAME_FALLBACK·isGolf 폴백 코드를 삭제한다. (순서 주의 — 코드부터 지우면
   폴백에 의존하던 페르소나의 기능이 전부 사라진다.)
4. `getPersonaFeatureKeys()`는 features만 신뢰하는 단순 함수로 축소.

**완료 기준**: 폴백 삭제 후 9명 페르소나 전원의 기능 버튼이 기존과 동일하게 노출.

### 과제 B. Template 시스템 씨앗 — 유일하게 완전히 없는 부분

**현상**: 쇼츠 파이프라인은 단일 스타일. DB에 Template 모델 자체가 없다.
"감성형/광고형/뉴스형/프리미엄형" 같은 선택지는 영상 상품화의 핵심이고, 장기적으로는
외부 디자이너가 템플릿을 판매하는 축이 된다.

**설계 방향** (쇼츠 상품화 착수 시점에 함께):
```prisma
model Template {
  id          Int      @id @default(autoincrement())
  engineKey   String   // FeatureKey. 예: 'shorts-maker' — 어느 엔진용 템플릿인가
  name        String   // '감성형', '광고형' …
  configJson  String   // 엔진이 해석할 파라미터(BGM·자막 스타일·전환효과·프롬프트 힌트 등)
  previewUrl  String?  // 미리보기 영상/이미지 (GCS)
  creatorId   Int?     // ★Persona.createdBy와 같은 원칙 — 지금은 운영자, 나중엔 외부 디자이너
  price       Int      @default(0)
  isVisible   Boolean  @default(true)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
}
```
- **범용 Template 테이블 1개 + engineKey 구분**을 권함(ShortsTemplate 같은 기능별
  테이블 금지 — "기능별 서비스 테이블로 쪼개지 말라"는 뼈대 원칙과 동일).
- configJson의 해석은 각 엔진(워커) 책임. 템플릿 시스템은 "선택지 저장소"만 담당.
- 사용자 신청 테이블(예: 쇼츠 요청)에 `templateId` 컬럼을 추가해 연결.
- Persona에 templateId를 직접 박지 않는다 — 페르소나:템플릿은 1:1이 아니라
  "페르소나가 쓰는 엔진의 템플릿 중 사용자가 고른 것"이므로 신청 단위에 붙는 게 맞다.
- DB 변경은 **서버1 raw SQL CREATE + prisma generate** (`db push` 금지 — 프로젝트 규칙).

**완료 기준**: 쇼츠 신청 화면에서 템플릿 2개 이상을 고를 수 있고, 고른 템플릿에 따라
결과물 스타일이 실제로 달라짐(적용값 실측 — "코드 넣음"≠"효과 있음").

### 과제 C. 페르소나 단위 가격 — ★사장 결정 필요 (착수 전 반드시 물어볼 것)

**현상**: 가격이 MenuLimit(기능×역할 단위 pointsCost)에만 있다. Persona에는 price가
없다. 제안서의 "persona.price"와 현 구조가 갈리는 지점.

**갈림길** (착수 전 사장에게 이 두 안을 그대로 보여주고 결정받을 것):
- **1안 — 기능 단위 가격 유지(현행)**: 같은 엔진이면 어느 페르소나로 쓰든 같은 가격.
  구현 변경 없음. 단, "프리미엄 페르소나"(같은 쇼츠라도 전문가 페르소나는 더 비싸게)
  같은 상품 전략이 불가능.
- **2안 — 페르소나 단위 가격 도입**: Persona에 `price`(또는 PersonaPricing 테이블)를
  추가하고, 과금 지점(`checkMenuAccess`/`deductMenuPoints`, shared-api `lib/menuAccess.ts`·
  `lib/points.ts`)에서 personaId 기준 가격을 우선 적용, 없으면 MenuLimit 폴백.
  Marketplace의 "입점 상품마다 가격" 모델과 정합. 대신 과금 경로 전수 회귀 테스트 필요.

**권고**: 1단계(운영자 페르소나만 있는 동안)는 1안 유지가 현실적. 단 2안으로 갈 것이
확실하므로, **새 과금 코드를 짤 때 personaId를 과금 함수까지 항상 전달**해 두면
나중에 스위치만 켜면 된다(PointTransaction.personaId가 이미 그 역할을 하고 있음).

### 과제 D. 기능 키 등록처 분산 정리 (선택 — 새 엔진 추가가 잦아지면)

**현상**: 새 기능(엔진) 하나를 붙이려면 4곳을 등록해야 한다 — ①기능 카드
(`MainPageNew.tsx` FEATURES_GRID) ②진입 경로(`App.tsx` 클릭 핸들러)
③공유 라벨 ④검색어(FEATURE_SYNONYMS) + `personaFeatures.ts`의 FeatureKey·FEATURE_REGISTRY.
하나만 빠져도 딥링크가 조용히 채팅으로 폴백한다(과거 실사고, memory 참조).

**방향**: 페르소나 50개·엔진 수십 개로 늘리는 게 1단계 목표이므로, 등록처를
personaFeatures.ts 한 곳(메타데이터 확장)으로 모으고 나머지가 그걸 읽게 리팩터링하면
"페르소나 10개 상품화"가 훨씬 빨라진다. 다만 App.tsx 클릭 핸들러는 상태 setter에
묶여 있어 완전 통합은 어려울 수 있음 — 최소한 **키 누락을 빌드 타임에 잡는 검사**
(레지스트리 대조 assert)라도 넣을 것.

---

## 3. 지금 하지 말 것 (2~3단계로 미룸)

착수 요청이 와도 이 문서를 근거로 "아직 단계가 아니다"라고 답할 것:

- ❌ 외부 판매자(creator) 등록 화면·검수 플로우
- ❌ 정산 시스템·revenue_rate (creator 테이블 신설 포함)
- ❌ Marketplace 스토어 UI (판매자 목록·입점 신청)
- ❌ 복잡한 권한 관리 (현행 USER/MANAGE/ADMIN role로 충분)
- ❌ Persona Builder(사용자 제작 도구) — 2단계. "나도 만들고 싶다"는 수요가
  실제로 생긴 뒤에.

단, **씨앗은 유지**: 새 테이블을 만들 때 소유자 개념이 필요하면 반드시
`creatorId Int?` (User FK) 패턴으로 — Persona.createdBy·Template.creatorId와 동일 원칙.

---

## 4. 1단계 목표 (상품화 방향)

> aichat.dbzone.kr 안에서 **운영자 제작 Persona 10개를 상품처럼 보이게** 진열·판매.

- 후보(제안서 원안): 상품 쇼츠 / 생일 영상 / 블로그 / 사업계획서 / 광고 카피 / SNS /
  자기소개서 / 여행 플래너 / 부동산 홍보 / 고객상담 전문가.
- 기존 엔진 재사용이 원칙: shorts-maker·marketing·ebook·homepage 등 이미 있는 22개
  기능 키에 페르소나(프롬프트+features 조합)만 새로 얹으면 되는 것부터.
  **새 엔진 개발이 필요한 페르소나는 뒤로** 미룬다.
- 페르소나 신설은 코드 작업이 아니라 **어드민 데이터 작업**이어야 정상이다.
  코드를 고쳐야만 새 페르소나가 만들어진다면 과제 A/D가 덜 끝난 것.

---

## 5. 개발 시 반드시 지킬 프로젝트 규칙 (요약)

- **DB 변경**: 스키마는 서버1 DB에 raw SQL로 적용 + `prisma generate`.
  `prisma db push` 금지. ai_mp와 shared-api 양쪽 schema.prisma 동기화 유지.
- **배포 검증**: 빌드 통과≠완료. `npm run check`(배포 전) + `npm run smoke`(배포 후
  운영 렌더) 통과까지가 "완료". 프론트 로직 수정은 커밋 전 빌드 번들 실행까지.
- **push는 master 브랜치만** (Vercel Production Branch = master). 배포 후
  "Promote to Production" 확인.
- **효과 실측**: "코드 넣음"≠"효과 있음". computed 값·실화면·프레임 추출로 검증.
- 서버 구성·이력은 `~/work_index.md` §1~13 + `~/work_lessons.md` 선독.

---

## 6. 관련 문서

- 페르소나 기능 연결 구조: `ai_mp/frontend/personaFeatures.ts` (파일 상단 주석이 설계 의도)
- 포인트·과금: `ai_mp/doc/points_payment.md`
- DB 스키마: `ai_mp/doc/db_schema.md`, shared-api `prisma/schema.prisma`(정본)
- 쇼츠 파이프라인: `ai_mp/doc/features/shorts_maker.md` (Template 과제 B의 대상)
- 진행 중 할 일 전반: memory `project_todo.md`
