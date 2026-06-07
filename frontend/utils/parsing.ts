// AI 리포트 파싱 유틸 (순수 함수 — 부수효과 없음, 단위 테스트 가능)
//
// StockAnalysisBoard.tsx에서 추출 (#7 파싱 유틸 추출, 2026-06-01).
// Claude/GPT는 마크다운 `### 투자의견` 헤더 형식, Gemini는 표 `| 투자의견 |` 형식.
// 정규식·폴백·점수 추출 로직은 원본 그대로 보존.

export interface AiOpinion {
  opinion: string;
  score: number | null;
  target: string;
}

/** Claude/GPT 리포트(마크다운 헤더 형식) → 투자의견/점수/목표주가 */
export function parseClaudeGptOpinion(report: string | null): AiOpinion {
  if (!report) return { opinion: '—', score: null, target: '—' };
  const opinionMatch = report.match(/###\s*투자의견\s*\n([^\n]+)/);
  let opinion = '—'; let score: number | null = null;
  if (opinionMatch) {
    const line = opinionMatch[1].trim();
    const sm = line.match(/([가-힣]+)\s*\((\d+)점\)/);
    if (sm) { opinion = sm[1]; score = parseInt(sm[2]); }
    else { opinion = line.split(/[—\-]/)[0].trim() || '—'; }
  }
  const targetMatch = report.match(/###\s*목표주가\s*추정\s*\n([^\n]+)/);
  const target = targetMatch ? targetMatch[1].trim() : '—';
  return { opinion, score, target };
}

/** Gemini 리포트(표 형식) → 투자의견/점수/목표주가 */
export function parseGeminiOpinion(report: string | null): AiOpinion {
  if (!report) return { opinion: '—', score: null, target: '—' };
  let opinion = '—'; let score: number | null = null;
  const opinionMatch = report.match(/\|\s*투자의견\s*\|\s*\*?\*?([^\n|*]+)/);
  if (opinionMatch) {
    const raw = opinionMatch[1].replace(/\*\*/g, '').trim();
    const sm = raw.match(/([가-힣]+)\s*\((\d+)점\)/);
    if (sm) { opinion = sm[1]; score = parseInt(sm[2]); }
    else { opinion = raw.split(/[—\-\s]/)[0] || '—'; }
  }
  const targetMatch = report.match(/\|\s*목표주가\s*\|\s*([^|\n]+)/);
  const target = targetMatch ? targetMatch[1].replace(/\*\*/g, '').trim() : '—';
  return { opinion, score, target };
}

/** 투자의견/점수 → 색상 코드 (점수 없으면 의견 키워드로 추정) */
export function opinionColor(opinion: string, _score: number | null): string {
  // 한국 주식 관습: 매수=빨강(상승), 매도=파랑(하락). 의견 텍스트 기준 결정.
  const o = opinion || '';
  if (o.includes('적극매수') || o.includes('강력매수') || o.includes('비중확대')) return '#dc2626'; // 진한 빨강
  if (o.includes('매수')) return '#e11d48';                                                          // 빨강
  if (o.includes('적극매도') || o.includes('강력매도')) return '#1d4ed8';                            // 진한 파랑
  if (o.includes('매도') || o.includes('비중축소')) return '#2563eb';                                // 파랑
  return '#6b7280'; // 중립/관망/보유 = 회색
}
