# 🔮 타로점 (유나) + 리딩 보고서

> 2026-07-06 출시. 페르소나: 유나(타로술사, cmr7a072h0000jwbezom9bi9v, 운세·사주)

## 구조 (백엔드 추가 최소 — 채팅 인프라 재활용)

- **TarotCardModal.tsx**: 셔플 애니메이션 → 메이저 아르카나 22장 부채꼴(가로 스크롤) → 과거/현재/미래 3장 선택(3D 플립, 역방향 30%) → 카드마다 채팅 자동 전송 → 종합 리딩. 해석 중엔 플로팅 칩 최소화(★언마운트 금지=상태 유지).
- **자동 전송**: `tarotAutoSendRef` + `setInputText` → useEffect가 `handleSendMessage()` 호출(본체 무수정). 채팅 스트림 경로라 **지식창고(109청크) 주입** + 메시지당 차감 그대로.
- **과금**: 별도 MenuLimit 없음(이중과금 방지). 해석 1건=채팅 1건(100→50P 레벨별). **풀 리딩=4건=400P(신규)~200P(단골)**. 원가 ~₩20/리딩(마진 90%+).
- **등록 위치(7항목 체크리스트 전부)**: FEATURES_GRID id21(tarot svg) / FEATURE_REGISTRY tarot·tarot-daily(Sparkles·Moon) / onFeatureSelect 특별분기(유나 활성화→채팅→모달, ★범용 분기보다 앞) / FEATURE_SYNONYMS / newFeaturesOrder 맨앞 / 공지 초안 16 / 과금판단 완료.

## 리딩 보고서 (바이럴 장치)

- **TarotReading** 테이블: cardsJson·interpretationsJson·shareId(옵트인). 라우트 `routes/aimp/tarot.ts` — 저장/목록/상세/공유발급/공개조회(`/shared/:shareId`=비로그인·사용자정보 미포함, ★`/:id`보다 먼저 선언).
- **생성 흐름**: 종합 후 칩 '📜 보고서 만들기' → App이 세션 메시지 마커(`[타로 리딩 n/3`·`종합]`) 다음 model 응답 수집 → 저장 → TarotReportView(명조+퍼플+골드 감정서).
- **인쇄**: @media print로 보고서 영역만. **공유**: 버튼 시 shareId 발급(기본 비공개=질문 프라이버시) → `/?tr=<shareId>` + **?ref 추천코드 자동부착**(레퍼럴 연동). 공개 화면 CTA '나도 타로 보러 가기'. 3개 화면 트리 모두 오버레이 렌더.
- 데모: `/?tr=demofable01`. 후속 후보: 카톡 OG 커스텀 카드, 22장 일러스트(나노바나나), 보고서함 UI.

## 함정 기록

- 퀵메뉴(quickMenuJson)로 기능 붙이지 말 것 — 눈에 안 띄고, 어드민 페르소나 저장(열린 폼의 빈 칸)이 DB를 덮음(실제 발생, 스냅샷 backups/persona-quickmenu/yuna.json으로 복구). 기능카드(features)가 정답.
- 퀵메뉴/기능카드는 갤러리 사진 유무와 무관하게 렌더돼야 함(07-06 수정: activeImages 없으면 칩 바 폴백).
