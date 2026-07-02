# 하이브리드 기능 의미검색

메인 화면(`MainPageNew.tsx`) 검색을 **동의어 태그(1차) + AI 의미검색(폴백)** 하이브리드로 구현. (2026-07-02)

## 문제

기존 검색은 기능 이름/설명/태그의 **부분일치(LIKE)** 뿐 → 사용자가 "파마하고싶어", "돈 굴리고싶다"처럼 **이름에 없는 표현**으로 검색하면 못 찾음. (기능은 20개뿐이라 이름을 정확히 모르면 발견 불가)

## 구조 (3단)

```
검색어 입력
  ↓
① 이름·태그·설명 부분일치 + 동의어 태그 매칭 (featureMatches, 즉시·₩0)
  ↓ 결과 있음 → 표시 끝
  ↓ 결과 0개
② 350ms debounce 후 POST /api/aimp/feature-search (AI 폴백)
  ↓
③ Gemini Flash가 검색어 의도로 기능 key 판단 → aiSearchKeys로 표시
```

- **`FEATURE_SYNONYMS`** (`MainPageNew.tsx`, FEATURES_GRID 바로 아래): 기능 key별 연관 키워드 맵. 예: `siwoon: ['운세','사주','타로','심심','앞날'...]`. **새 기능 추가 시 여기 한 줄 넣으면 의미검색이 넓어짐.**
- **`featureMatches(f, q)`**: 이름/태그/설명 부분일치 OR 동의어 부분일치.
- **`aiSearchKeys` state + useEffect**: 로컬(기능+페르소나) 결과 0개일 때만 API 호출. 검색어 바뀌면 이전 AI 결과 즉시 초기화. debounce 350ms로 타이핑 중 과호출 방지.
- 백엔드는 프론트가 넘긴 `items:{key,text}`(이름+태그+설명+동의어)로만 판단 → **기능 정의는 프론트 단일 소스**(서버 중복 정의 없음, 불일치 방지).

## 백엔드 (`shared-api/routes/aimp/feature-search.ts`)

`POST /api/aimp/feature-search`
- body: `{ query: string, items: {key,text}[] }` → res: `{ keys: string[] }`
- **Gemini 2.5 Flash + `config.thinkingConfig.thinkingBudget:0`** 로 "의도에 맞는 key JSON 배열" 요청.
- `getGeminiClient()` 직접 호출 (lib의 `callGemini`는 thinkingConfig를 못 받음).
- 응답 파싱: 정규식 `/\[[\s\S]*?\]/`로 배열만 추출 (`parseAiJson`은 `{객체}` 전용이라 못 씀). 목록에 실제 있는 key만 통과.
- `answerCache`(Map)로 동일 검색어 재요청 캐시(0.09초). 실패/무관 시 빈 배열로 조용히 폴백(검색 흐름 안 깨짐).

## ★ 모델 선택 이력 (중요 — 삽질 방지)

| 단계 | 모델 | 결과 |
|------|------|------|
| ✗ | **text-embedding-004** (Vertex 임베딩 + 코사인) | **한국어 짧은 검색어 변별력 0.** "파마"가 hair보다 siwoon(운세)에 더 유사(오답). taskType 줘도 전 후보 0.61~0.65로 뭉개짐. 폐기 |
| △ | **claude CLI** (sonnet) | 정확하지만 **CLI 프로세스 콜드스타트로 매 호출 4~13초**(불안정). haiku도 동일(병목=CLI 실행). 실시간 검색엔 느림 |
| ✅ | **Gemini 2.5 Flash + thinkingBudget:0** | **0.5~2초, 정확도 동일.** 채택. ★단순 분류엔 thinking 켜면 2~4초라 반드시 끌 것 |

- 실측 비교(동일 5쿼리): 정확도는 claude=Gemini 동일(5/5), **속도만 ~10배 차**(Gemini 0.9초 vs claude CLI 9.8초).
- 교훈: **짧은 한국어 의미분류는 임베딩 말고 생성형 LLM.** 실시간이면 Gemini Flash + thinking off, 저빈도·백그라운드면 claude CLI(구독 ₩0)도 무방.

## UX

검색창 placeholder에 자연어 예시 노출: `"예: 파마하고싶어, 돈 굴리고싶다, 앞날이 궁금해"` (히어로 + 탭 검색바). 사람들이 예시를 보고 자연어로 검색하도록 유도.

## 배포

- ai_mp master: `82a179b`(동의어)·`7187d54`(폴백+vercel)·`9f17b09`(placeholder)
- shared-api main: `5470a9b`(라우트)→`18bc48b`(Gemini 전환) — **서버1 수동** `git pull` + `pm2 reload shared-api`
- e2e 라이브 확인 완료.
