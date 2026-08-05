# 파트너(제휴) 프로그램 — 기획서 뼈대

상태: **설계 초안, 미구현**. 구현 전 아래 "법적 전제"를 반드시 재확인할 것.

## 0. 왜 이 문서가 필요한가

ai_mp를 "본사"로 두고, 지역/인맥 기반 사업자가 서브도메인 페이지에서 페르소나 구독을
판매하는 확장 모델을 검토했다. 네트워크마케팅(다단계) 구조를 참고 대상으로 놓고
시작했으나, 법적 리스크 검토 끝에 **다단계/후원방문판매가 아닌 순수 제휴마케팅 구조**로
확정했다. 이 문서는 그 확정 구조를 구현 가능한 뼈대로 정리한 것이다.

## 1. 법적 전제 (★구현 전 필수 재확인)

방문판매법상 다단계판매업/후원방문판매업으로 판정되는 핵심 요건은 **"하위 판매원의
실적이 상위 판매원에게 계속 배분되는가"** 다. 이 프로그램은 아래 두 가지로 그 요건을
의도적으로 피한다.

1. **판매수수료는 본인 실적에만 연동.** 파트너가 직접 유치한 고객의 구독료 중 정해진
   %만 매달 받는다. 자신이 모집한 하위 파트너(2차)가 올리는 매출에서는 어떤 형태로도
   배분받지 않는다.
2. **모집보상은 하위 매출과 완전히 분리된 재원(본사 마케팅비)에서 나온다.** 1차가
   2차를 모집하면 고정액 1회를 받지만, 이 재원은 2차의 가입비·구독료가 아니라 본사
   마케팅 예산에서 지급한다. "2차 최초 실적에서 떼어주는 것"으로 보이면 안 된다.
3. **조직은 2단으로 고정.** 2차는 3차를 모집할 수 없다. 화면·API 어디에도 "하위 초대"
   기능을 2차에게 노출하지 않는다.

이 세 원칙이 깨지면(예: "2차 매출도 1차에게 일부 배분하자"는 식의 요구가 나중에 들어오면)
후원방문판매업 등록 대상으로 다시 넘어간다. 기능 추가 시 반드시 이 문서의 §1을
먼저 재확인하고, 애매하면 구현하지 말고 되물을 것.

**법률 자문은 별도.** 이 문서는 설계 방향을 잡기 위한 참고이지 법률 검토를
대체하지 않는다. 실제 계약서·약관 문구는 변호사 검토를 받을 것.

## 2. 전체 구조

```
본사 (ai_mp)
 ├─ 시스템/페르소나/결제 전부 소유
 │
 ├─ 1차 파트너 (가맹비 + 페르소나 구독 판매수수료)
 │   ├─ 서브도메인/서브경로 보유 (예: gangnam.aichat.dbzone.kr)
 │   ├─ 직접 유치 고객의 구독료 중 고정 %를 매달 수령
 │   └─ 2차 파트너 모집 가능 → 모집 성사 시 고정액 1회 (본사 마케팅비 재원)
 │
 └─ 2차 파트너 (1차와 동일 권한, 단 추가 모집 불가)
     ├─ 서브도메인/서브경로 보유
     └─ 직접 유치 고객의 구독료 중 고정 %를 매달 수령 (본인 실적에만 연동)

고객
 └─ 본사 결제 시스템(토스페이먼츠)에 직접 결제 → 파트너는 사후 정산으로만 수수료 수령
```

핵심 요약:
- 1차·2차는 **권한 동일**, 차이는 "2차를 모집할 수 있는가" 하나뿐.
- 고객 결제는 100% 본사가 직접 받는다. 파트너는 돈을 만지지 않는다(정산만 받는다).
- 트리 깊이는 하드코딩으로 2단 고정 — DB 스키마 자체에서 3단계 생성을 막는다.

## 3. 용어 정의

| 용어 | 의미 |
|---|---|
| 파트너(Partner) | 가맹비를 내고 서브페이지를 운영하는 사업자. tier 1(1차) 또는 tier 2(2차) |
| 파트너 사이트 | 파트너별 서브도메인/서브경로. 페르소나 목록+구독 유도 랜딩 |
| 추천코드 | 고객이 어느 파트너를 통해 유입됐는지 식별하는 코드 (URL 파라미터 + 쿠키) |
| 판매수수료 | 고객 구독료의 고정 %, 매달 자동 정산 (본인 실적 한정) |
| 모집보상 | 1차가 2차를 모집했을 때 받는 고정액 1회 (본사 마케팅비 재원) |

## 4. DB 스키마 (Prisma, 기존 `prisma/schema.prisma`에 추가)

기존 `User`/`PointTransaction`/`Persona` 모델을 그대로 활용하고, 파트너 전용 모델만
신설한다. 파트너도 `User` 한 명이며 `Partner` 레코드로 역할을 얹는 방식(주식분석 등
기존 부가기능이 `User`에 관계 테이블을 붙이는 패턴과 동일).

```prisma
model Partner {
  id              Int       @id @default(autoincrement())
  userId          Int       @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  tier            Int       // 1 = 1차, 2 = 2차. 그 외 값 금지(애플리케이션 레벨 검증)
  parentPartnerId Int?      // tier=2일 때만 값 존재. tier=1이면 반드시 null
  parentPartner   Partner?  @relation("PartnerRecruit", fields: [parentPartnerId], references: [id], onDelete: SetNull)
  recruits        Partner[] @relation("PartnerRecruit") // tier=1만 non-empty. tier=2는 항상 []

  subdomain       String    @unique // 예: "gangnam" → gangnam.aichat.dbzone.kr
  displayName     String    // 파트너 사이트에 노출될 상호명
  status          String    @default("PENDING") // PENDING/ACTIVE/SUSPENDED/TERMINATED

  franchiseFee    Int       // 가맹비 (1회, 원)
  commissionRate  Int       // 판매수수료 %  (예: 30)
  recruitBonus    Int?      // tier=1 전용: 2차 모집 성사 시 고정 보상액. tier=2는 null

  createdAt       DateTime  @default(now())

  assignedPersonas PartnerPersona[]
  referrals        PartnerReferral[]
  settlements      PartnerSettlement[]
}

// 본사가 "이 파트너는 이 페르소나들을 판매할 수 있다"고 선택 배정
model PartnerPersona {
  id         Int      @id @default(autoincrement())
  partnerId  Int
  personaId  String
  validFrom  DateTime @default(now())
  validUntil DateTime? // null = 무기한. 기간제 이용권이면 값 설정
  partner    Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  persona    Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)

  @@unique([partnerId, personaId])
}

// 고객이 어느 파트너 추천으로 유입/결제했는지 — 판매수수료 정산의 근거 원장
model PartnerReferral {
  id           Int      @id @default(autoincrement())
  partnerId    Int
  userId       Int      // 유치된 고객
  personaId    String?  // 어떤 페르소나 구독으로 유입됐는지 (선택)
  refCode      String   // 클릭 시점 추천코드 스냅샷 (파트너 subdomain 변경 대비 불변 기록)
  createdAt    DateTime @default(now())

  partner      Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId]) // 고객 1명당 귀속 파트너는 1명 — 최초 유입 파트너가 영구 고정(덮어쓰기 금지)
}

// 월별 정산 배치 결과 — 파트너에게 실제 지급될 금액의 기록
model PartnerSettlement {
  id            Int      @id @default(autoincrement())
  partnerId     Int
  period        String   // "2026-08" 형식
  salesAmount   Int      // 해당 기간 귀속 고객들의 구독 결제 합계
  commissionAmt Int      // salesAmount * commissionRate / 100
  recruitBonusAmt Int    @default(0) // 이번 기간 신규 2차 모집 성사 건수 * recruitBonus
  totalPayout   Int      // commissionAmt + recruitBonusAmt
  status        String   @default("PENDING") // PENDING/PAID/HOLD
  paidAt        DateTime?
  createdAt     DateTime @default(now())

  partner       Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)

  @@unique([partnerId, period])
}
```

**tier=2에서 `recruits`가 항상 빈 배열이어야 한다는 불변식은 스키마가 강제하지 못한다.**
애플리케이션 레벨(2차 모집 API 진입점)에서 `parentPartner.tier === 1`을 검증해
3단계 생성을 원천 차단해야 한다 — 이게 §1의 "2단 고정"을 지키는 실제 방어선이다.

## 5. 정산 로직 — 왜 원장(Referral)과 스냅샷(Settlement)을 분리하는가

`PartnerReferral`은 "이 고객은 이 파트너 소속"이라는 사실만 기록하고, 실제 매출은
기존 `PointTransaction`(type=CHARGE) 또는 구독 결제 테이블을 조회해서 계산한다.
매달 배치가 `PartnerReferral`로 고객→파트너를 매핑하고, 그 기간의 결제 합계에
`commissionRate`를 곱해 `PartnerSettlement`에 스냅샷을 남긴다.

스냅샷을 남기는 이유: 정산 이후 `commissionRate`가 바뀌어도 과거 지급 내역이
바뀌면 안 되기 때문. 정산은 배치 시점의 요율로 고정된다.

## 6. 화면 구성

### 6-1. 파트너 사이트 (고객 대상, 서브도메인)
- 라우팅: `gangnam.aichat.dbzone.kr` → Next.js 미들웨어에서 `Host` 헤더로
  `subdomain` 판별 → `Partner.subdomain` 조회 → `PartnerPersona`로 배정된
  페르소나만 필터링해 노출
- 기존 페르소나 목록/채팅 UI 재사용, 파트너 `displayName`/로고만 헤더에 커스터마이징
- 회원가입/결제 흐름 진입 시 `refCode` 쿠키 심기 (최초 방문 시 1회만, 덮어쓰기 금지)

### 6-2. 파트너 대시보드 (파트너 본인용, 신규)
- `/partner/dashboard` — 이번 달 유치 고객 수, 예상 정산액, 배정 페르소나 목록
- `/partner/recruits` — tier=1 전용. 2차 모집 링크 발급 + 모집한 2차 목록/상태
- `/partner/settlements` — 월별 정산 내역(PartnerSettlement 히스토리)

### 6-3. 어드민 (본사 관리자)
기존 어드민 탭 패턴(`personas / categories / … / product-extract`)에 신규 탭 추가:
- **partners 탭**: 파트너 목록·승인(PENDING→ACTIVE)·서브도메인 발급·페르소나 배정
- **partner-settlements 탭**: 월별 정산 배치 실행·지급 상태 변경(PENDING→PAID)

## 7. API (shared-api, `routes/aimp/partners.ts` 신규)

기존 라우트 패턴(`getTokenFromRequest`+`verifyToken`, admin은 `requireAdmin`) 그대로 따름.

```
POST   /api/partners/apply           # 가맹 신청 (고객→파트너 전환 요청, status=PENDING 생성)
GET    /api/partners/me              # 내 파트너 정보 (대시보드용)
GET    /api/partners/me/settlements  # 내 정산 내역

POST   /api/partners/recruit-link    # tier=1 전용: 2차 모집 링크 발급
POST   /api/partners/recruit-signup  # 모집 링크로 들어온 신규 2차 가입 처리
                                      # → parentPartner.tier !== 1 이면 403 (3단계 차단)

# 어드민 전용
GET    /api/admin/partners                        # 전체 파트너 목록
PATCH  /api/admin/partners/:id                     # 승인/정지/수수료율 변경
POST   /api/admin/partners/:id/personas            # 페르소나 배정/해제
POST   /api/admin/partner-settlements/run          # 월별 정산 배치 수동 실행
PATCH  /api/admin/partner-settlements/:id          # 지급 상태 변경(PAID 처리)
```

## 8. 구현 순서 제안

1. `Partner`/`PartnerPersona`/`PartnerReferral`/`PartnerSettlement` 스키마 추가 +
   마이그레이션
2. 어드민 partners 탭 — 파트너 수동 생성/승인 (가맹 신청 자동화는 나중)
3. 서브도메인 라우팅 미들웨어 + 파트너 사이트 최소 버전(페르소나 목록만)
4. 추천코드 쿠키 심기 + `PartnerReferral` 생성 (결제 시점에 귀속 확정)
5. 월별 정산 배치 스크립트(cron) — `PartnerSettlement` 생성까지
6. 파트너 대시보드 화면
7. 2차 모집 링크 + tier 검증 (3단계 차단 로직 최우선 테스트 대상)

## 9. 미결 사항 (구현 전 결정 필요)

- 가맹비 결제 방식: 기존 토스페이먼츠 흐름 재사용? 별도 계좌이체 확인?
- 파트너 정산 지급 방법: 수동 계좌이체인지, PG 지급대행 연동인지
- 파트너 해지 시 귀속 고객(`PartnerReferral`) 처리: 본사 직속 전환 vs 유지
- `commissionRate`/`recruitBonus`를 파트너별로 다르게 줄 것인지(스키마는 이미 지원),
  아니면 전사 고정값으로 시작할지
