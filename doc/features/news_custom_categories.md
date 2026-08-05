# 오늘의 뉴스 — 회원 맞춤 카테고리 (기획 뼈대)

상태: **설계만, 미구현**. 구현 담당은 오퍼스 예정. §7(정책 확정)에 사장 결정
반영 완료 — 이 문서만 보고 바로 착수 가능.

## 0. 지금 뭘 바꾸는가

지금 "오늘의 뉴스"는 **전체 회원 공통**이다. 서버2 크론이 밤 9시 딱 한 번 8개
고정 카테고리(국내/해외/경제증시/AI기술/AI신기능/부동산/스포츠/날씨)를 수집해
`agent-api/cache/news_YYYYMMDD.json` 파일 하나에 저장하고, 모든 회원이 그 파일을
공유해서 읽는다.

이번 기획은 이 공용 구조 위에 **회원별 개인화 레이어**를 얹는다.

1. 회원이 8개 공통 카테고리 중 보고 싶은 것만 켜고 끌 수 있다(온/오프 토글).
2. 회원이 직접 카테고리를 만들 수 있다 — 메뉴명 + 참고 URL(최대 3개) + 설명 텍스트를
   입력하면, 그걸 근거로 AI가 매일 밤 검색해서 그 회원 전용 뉴스 카드를 만들어준다.
3. 회원당 커스텀 카테고리는 **최대 3개**.
4. 완성된 카드 형식(`### 제목` + `**핵심 내용**` + `**출처**`)은 기존과 동일하게
   유지 — 프론트 렌더러(`parseNewsItems`)·TTS·`_is_bad_report` 판정을 그대로 재사용.

## 1. 왜 회원별로 완전히 갈라야 하는가

검토 초안에서는 "같은 URL+설명이면 여러 회원이 결과를 공유"하는 안(수집 1회,
비용 절감)도 있었지만 **기각했다**. 이유:

- 첫 등록자의 설명 문구가 이후 등록자에게도 영향을 주는 모호함이 생긴다.
- "내가 만든 카테고리"라는 감각 자체가 이 기능의 핵심 가치인데, 공유 풀이면
  "누군가 이미 만든 것 중에 고르는" 것과 다를 게 없어진다.

**확정: 회원마다 완전히 독립된 카테고리·수집·저장.** 비용은 회원 수에 선형
비례해 증가하지만(§6에서 다룸), 그 대신 개인화가 진짜 개인화가 된다.

## 2. 데이터 모델

기존 뉴스 파이프라인은 DB가 아니라 **파일 캐시**(`agent-api/cache/*.json`)를
쓰지만, 회원별 데이터는 그 방식이 안 맞는다(파일 수가 회원 수만큼 늘고, 회원
탈퇴·카테고리 삭제 시 정리가 지저분해진다). **회원 커스텀 카테고리와 그 결과는
DB(shared-api Prisma)에 저장**하고, 기존 8개 공통 카테고리는 지금처럼 파일
캐시를 그대로 쓴다 — 두 저장소가 공존하되 프론트에서는 하나로 합쳐 보여준다.

```prisma
// 회원이 설정한 "이 카테고리를 볼지 말지" — 공통 8개 카테고리 온/오프 토글용.
// 행이 없으면 기본 ON(지금처럼 전부 보임), 행이 있으면 그 값을 따른다.
model NewsCategoryPref {
  id         Int      @id @default(autoincrement())
  userId     Int
  categoryKey String  // 예: '국내뉴스', 'AI신기능' — agent-api NEWS_CATEGORIES의 key와 동일
  enabled    Boolean  @default(true)
  updatedAt  DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, categoryKey])
}

// 회원이 직접 만든 커스텀 카테고리 — 메뉴명 + 참고 URL 최대 3개 + 설명.
model UserNewsCategory {
  id          Int      @id @default(autoincrement())
  userId      Int
  name        String   // 회원이 지은 메뉴명, 예: "우리동네 부동산 경매"
  urlsJson    String   @default("[]") // 참고 URL 배열(최대 3개), JSON 문자열
  description String?  // 무엇을 찾아달라는 건지 간단한 설명(선택)
  isActive    Boolean  @default(true) // 포인트 부족 등으로 자동 비활성화될 때 false(회원이 직접 재활성화)
  pausedReason String? // 'INSUFFICIENT_POINTS' 등 — 비활성화 사유(회원 화면 안내용)
  deletedAt   DateTime? // 회원이 삭제 요청한 시각. null이 아니면 "삭제 예정"(7일 유예).
                        // 크론이 deletedAt+7일 지난 행을 실제로 delete. null이면 정상 사용 중.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user   User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  results UserNewsCategoryResult[]

  @@unique([userId, name]) // 같은 회원이 같은 이름으로 중복 생성 방지
}

// 매일 밤 수집 결과 — 회원 커스텀 카테고리 전용. 공통 카테고리는 기존 파일 캐시 그대로.
model UserNewsCategoryResult {
  id             Int      @id @default(autoincrement())
  categoryId     Int
  date           String   // 'YYYY-MM-DD'(KST)
  report         String?  // 마크다운 본문(### 제목 + 핵심내용 + 출처)
  sourcesCount   Int      @default(0)
  status         String   @default("pending") // pending | done | failed
  errorMessage   String?
  pointsCharged  Int?     // 이 날짜 수집으로 실제 차감된 포인트(실패 시 null)
  createdAt      DateTime @default(now())

  category UserNewsCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([categoryId, date]) // 하루 1건만(재시도해도 upsert)
}
```

**왜 결과를 카테고리당 최신 1건이 아니라 날짜별로 누적하는가**: 회원이 "어제
내용 다시 보고 싶다"고 할 수 있고, 정산 근거로도 날짜별 이력이 남아있는 편이
안전하다. 카테고리 자체가 삭제될 때만 7일 유예 후 정리되고(§7), 살아있는
카테고리의 결과 이력은 별도 만료 없이 계속 쌓인다 — 필요해지면 나중에 보관
기간 정책을 추가할 것.

## 3. 수집 파이프라인

기존 `agent-api/news_collector.py`의 `collect_all()`은 "전체 회원 공통 8개
카테고리를 한 번에" 수집한다. 회원별 커스텀 카테고리는 **별도 함수**로 분리한다
(공통 카테고리 수집 로직을 건드리지 않기 위해).

```
매일 밤 9시(기존 크론 직후, 또는 별도 크론)
  ↓
collect_user_custom_categories()  # 신설
  1. DB에서 isActive=true AND deletedAt IS NULL 인 UserNewsCategory 전부 조회
     (삭제 요청한 카테고리는 유예기간 중이라도 더 이상 수집하지 않는다)
  2. 각 카테고리마다:
     a. 포인트 사전 확인(checkMenuAccess 상당 — 아래 §5)
        → 부족하면 isActive=false, pausedReason='INSUFFICIENT_POINTS'로 갱신, 수집 건너뜀
           (자동 재시도 없음 — 회원이 직접 재활성화해야 다음날부터 재개, §7)
     b. 전용 프롬프트로 Gemini 호출(§4)
     c. "관련 소식 없음" 응답 → status='done'으로 저장하되 무과금(§7)
     d. 일반 성공(_is_bad_report 통과 + 실제 항목 있음) → status='done' 저장
        + 포인트 100P 차감(§5, §7)
     e. 실패(_is_bad_report 판정) → UserNewsCategoryResult(status='failed') 저장, 무과금
  3. 회원 수만큼 순차 또는 소규모 배치 처리(rate limit 방지, 기존 collect_all의
     category별 sleep(2) 패턴 참고)

별도 크론(매일 1회, 예: 새벽) — cleanup_deleted_categories()  # 신설
  1. deletedAt이 7일 이전인 UserNewsCategory 조회
  2. 실제 delete(Cascade로 UserNewsCategoryResult도 함께 삭제)
  3. 삭제 실행 전에는 별도로, 회원이 삭제 요청한 시점에 즉시 1회 알림
     ("7일 뒤 완전 삭제됩니다") — 이건 수집 크론이 아니라 삭제 요청을 받는
     API(§9 DELETE) 쪽에서 바로 발송
```

★기존 8개 공통 카테고리 수집(`collect_all`)과 완전히 독립된 함수로 만들 것 —
공통 카테고리 하나가 실패해도 회원 커스텀 수집엔 영향 없어야 하고, 반대도 마찬가지.

## 4. 커스텀 카테고리 전용 프롬프트

기존 `PROMPT_TEMPLATE`(오늘 발행 기사 전제)도, `AI_TREND_PROMPT`(오픈소스 AI
고정 소스 전제)도 안 맞는다 — 회원이 준 **URL과 설명이 매번 다르므로** 그 값을
프롬프트에 동적으로 끼워 넣어야 한다.

```python
USER_CUSTOM_PROMPT = """다음 정보를 참고해 최근(지난 며칠 이내) 소식을 Google에서 검색해 정리해주세요.

**회원이 지정한 참고 자료:**
{urls_block}

**회원이 적은 설명:** {description}

**중요 지침:**
- 오늘은 {today}입니다. 최근 1~2주 이내 소식 위주로 정리하세요.
- 위 URL이 특정 사이트라면 그 사이트나 같은 주제를 다루는 다른 신뢰할 만한
  출처도 함께 검색해 보완하세요(URL 하나만 고집하지 말 것).
- 외국어 내용은 반드시 자연스러운 한글로 번역·정리하세요.
- 관련 소식을 전혀 찾지 못하면 억지로 지어내지 말고 "최근 관련 소식을 찾지
  못했습니다"라고 솔직히 답하세요.

각 항목 형식:
### 소식 제목
- **핵심 내용**: 2~3줄 요약
- **출처**: 실제 출처명

총 3~8개를 중요도 순으로 정리해주세요."""
```

`urls_block`은 회원이 입력한 URL 0~3개를 번호 매겨 나열(0개면 "특별히 지정된
URL 없음, 설명만 참고"로 대체). **URL을 안 넣고 설명만 적는 것도 허용**해야
하므로(사장 원 발언: "간단히 내용도 적을 수 있는 글상자") `description`은
필수, `urls`는 선택으로 설계.

★`_is_bad_report`의 회피 문구 판정(`_BAD_PATTERNS`)에 "찾지 못했습니다"류
문구가 걸리면 무한 재시도만 하다 실패 처리될 수 있다 — 회원 커스텀은 소재가
좁아 "진짜로 없음"이 정상 케이스일 수 있으므로, 이 카테고리 전용으로는
"찾지 못함"을 실패가 아니라 **정상 결과**(사용자에게 그대로 보여줌, 과금은
어떻게 할지 §7에서 결정)로 다르게 판정하는 로직이 필요할 수 있음.

## 5. 과금 설계

**원칙: 수집이 실제로 성공(status='done')했을 때만 차감. 실패하면 무과금.**

기존 `checkMenuAccess`/`deductMenuPoints`(`lib/menuAccess.ts`, `lib/points.ts`)는
`feature` 키가 정적 문자열이라 "회원마다 다른 카테고리 N개"에 그대로는 안 맞는다.
재사용 방법:

- `MenuLimit`에 `feature = 'news-custom'` 단가 하나만 등록(카테고리별로 다른
  단가는 지원하지 않음 — 단순화).
- 카테고리 개수만큼 반복 차감하는 게 아니라, **카테고리 1개 수집 성공 = 1회
  차감**을 그 카테고리마다 독립적으로 수행. 즉 회원이 3개를 다 켜놨으면 하루에
  최대 3회 차감될 수 있음(각각 성공해야만).
- `deductMenuPoints(prisma, userId, pointsCost, 'AI뉴스 맞춤(<카테고리명>)')`처럼
  설명에 카테고리명을 넣어 `PointTransaction` 내역에서 구분 가능하게.
- **잔액 부족 시**: `checkMenuAccess` 상당 로직을 수집 직전에 호출 → 실패하면
  그 카테고리만 `isActive=false, pausedReason='INSUFFICIENT_POINTS'`로 갱신하고
  건너뜀. 다른 카테고리·다른 회원은 영향 없음. 프론트에서 "포인트 부족으로
  일시정지됨 — 충전 후 다시 켜보세요" 안내 + 재활성화 버튼 제공.

## 6. 비용·시간 추정 (구현 전 사장 확인 필요)

- 카테고리 1개 수집 = Gemini 1회 호출(grounding 포함) ≈ 기존 카테고리와 동일 원가.
- 활성 회원이 M명이고 평균 커스텀 카테고리가 K개(K≤3)면, 밤 9시 배치가
  **M×K회의 추가 Gemini 호출**을 순차(또는 소규모 병렬)로 처리해야 함 —
  기존 8개 카테고리(고정 8회)와는 비용 구조가 다르다(회원 수에 선형 비례).
- 회원 수가 늘어나면 밤 9시 배치가 끝나는 데 걸리는 시간도 늘어남 — 배치
  시작 시각을 앞당기거나, 동시 실행 개수를 늘리는 것(rate limit과 트레이드오프)
  검토 필요.

## 7. 정책 확정 (2026-08-04 사장 결정)

- **포인트 단가: 100P** — 카테고리 1회 수집 성공당 100P 차감(§5 원칙 그대로,
  성공 시에만). `MenuLimit(feature='news-custom', role별)` 에 `pointsCost=100`
  으로 등록.
- **"관련 소식 없음"은 무과금** — AI가 "최근 관련 소식을 찾지 못했습니다"로
  답한 경우는 `UserNewsCategoryResult.status='done'`으로 저장은 하되(회원이
  결과를 볼 수 있어야 하므로) **포인트는 차감하지 않는다**(`pointsCharged=null`).
  §4 프롬프트의 "정직하게 답하라" 지침과 짝을 이루는 정책 — AI가 솔직하게
  실패를 인정했는데 과금하면 안 됨. 판정 방법: 응답 본문에 "찾지 못했습니다"
  류 문구가 있고 `### ` 항목이 하나도 없으면 "결과 없음"으로 분류.
- **카테고리 삭제 시 7일간 유예 후 삭제 + 알림** — 회원이 삭제를 누르면 즉시
  Cascade 삭제하지 않고, `UserNewsCategory.isActive`를 별도 상태(예: 'deleting'
  또는 `deletedAt` 타임스탬프)로 표시만 하고 **7일간 결과 이력을 보관**한다.
  7일 후 크론이 실제 삭제 처리. 삭제 예정 시점에 회원에게 알림(공지/토스트 등
  기존 알림 채널 재사용) — "삭제 요청하신 'OO' 카테고리가 7일 뒤 완전히
  삭제됩니다"류 안내. ★스키마에 `deletedAt DateTime?` 필드 추가 필요(§2 갱신).
- **비활성화(포인트 부족) 재시도는 회원이 직접** — 자동 재시도 없음.
  `isActive=false, pausedReason='INSUFFICIENT_POINTS'`인 카테고리는 회원이
  포인트를 충전한 뒤 화면에서 "다시 켜기" 버튼을 직접 눌러야 재개된다
  (§8 화면 구성의 "비활성화 상태 배너"에 재활성화 버튼 포함).
- **TTS는 이번 범위에서 보류** — 커스텀 카테고리는 텍스트 카드까지만. 회원별
  TTS 파일 규칙 확장은 이후 별도 요청 시 검토.

## 8. 화면 구성 (뼈대만)

- **"오늘의 뉴스" 진입 화면**: 기존 카테고리 탭 목록 + 맨 끝에 "➕ 내 카테고리
  만들기" 버튼.
- **카테고리 켜고 끄기**: 각 공통 카테고리 탭 옆(또는 별도 "설정" 화면)에
  토글 스위치. `NewsCategoryPref` upsert.
- **커스텀 카테고리 만들기 폼**: 메뉴명(텍스트) + 참고 URL 입력칸 3개(선택,
  개별 비워도 됨) + 설명 글상자(필수, placeholder: "예: 우리 동네 재개발 소식을
  알려줘") + 저장 버튼. 저장 시 `POST /api/aimp/news/custom-categories`.
- **커스텀 카테고리 카드**: 공통 카테고리와 동일한 뉴스카드 UI(`parseNewsItems`
  렌더러 재사용) + 우측 상단에 편집·삭제 버튼 + 비활성화 상태면 "포인트 부족으로
  일시정지됨 — 충전 후 다시 켜기" 배너(버튼 포함, 회원이 직접 눌러야 재개, §7).
- **삭제 예정 상태(`deletedAt` 있음)**: 카드 상단에 "7일 뒤 완전히 삭제됩니다
  (YYYY-MM-DD)" 안내 + "삭제 취소" 버튼(`POST .../undo-delete`). 이 상태에서는
  수집도 멈춘 채로 과거 결과만 열람 가능.
- **최대 3개 도달 시**: "➕ 내 카테고리 만들기" 버튼 비활성화 또는 안내 문구.
  (삭제 예정 상태인 카테고리는 이미 수집을 멈췄어도 완전 삭제 전까지는 3개
  한도에 포함시킬지 여부는 구현 시 판단 — 포함 안 시키는 쪽을 권장, 회원이
  "실수로 삭제 눌렀다가 새 걸 못 만드는" 상황을 피하기 위함)

## 9. API (shared-api, 신규 `routes/aimp/news-custom.ts` 제안)

```
GET    /api/aimp/news/category-prefs        # 공통 카테고리 온오프 상태 조회
PUT    /api/aimp/news/category-prefs        # { categoryKey, enabled } 토글

GET    /api/aimp/news/custom-categories     # 내 커스텀 카테고리 목록(+오늘 결과)
POST   /api/aimp/news/custom-categories     # { name, urls[], description } 생성(최대 3개 검증)
PATCH  /api/aimp/news/custom-categories/:id # 수정(이름/URL/설명), isActive 재활성화도 여기
DELETE /api/aimp/news/custom-categories/:id # 삭제 "예약" — deletedAt=now() 설정만(즉시 삭제 아님).
                                             # 7일 유예 후 별도 크론이 실제 삭제(§3). 이 호출
                                             # 응답 시점에 회원에게 "7일 뒤 완전 삭제됩니다" 알림 발송.
POST   /api/aimp/news/custom-categories/:id/undo-delete  # 유예기간 중 삭제 취소(deletedAt=null)

GET    /api/aimp/news/custom-categories/:id/today  # 오늘 수집 결과 조회
```

수집 자체(Gemini 호출)는 agent-api 크론이 하고, shared-api는 CRUD + DB 조회만
담당 — 기존 뉴스 프록시 구조(`routes/aimp/news.ts`가 agent-api를 프록시)와
분리되는 지점이니, 커스텀 카테고리 결과는 shared-api DB에서 직접 읽어온다는
점에 주의(agent-api를 다시 거치지 않음).

## 10. 구현 순서 제안

1. Prisma 스키마 3개 모델 추가 + 마이그레이션
2. shared-api CRUD 라우트(§9) — 수집 없이 카테고리 등록/조회만 먼저
3. agent-api에 `collect_user_custom_categories()` 함수 신설 + 전용 프롬프트(§4)
4. 과금 연동(§5) — 포인트 부족 시 자동 비활성화까지
5. 크론 등록(밤 9시, 공통 카테고리 수집과 순서 조율 — 동시 실행 시 rate limit
   경합 여부 확인)
6. 프론트: 공통 카테고리 토글 UI
7. 프론트: 커스텀 카테고리 생성/편집/삭제(+삭제취소) 폼 + 카드 렌더(기존 렌더러 재사용)
8. 7일 유예 삭제 크론(`cleanup_deleted_categories`) + 삭제 요청 시 알림 발송 연동
