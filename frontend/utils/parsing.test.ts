// parsing.ts 회귀 테스트 (vitest)
// StockAnalysisBoard에서 추출한 파싱 순수함수의 동작을 고정하는 안전망.
// 실행: npm test  (또는 npx vitest run)
import { describe, it, expect } from 'vitest';
import { parseClaudeGptOpinion, parseGeminiOpinion, opinionColor } from './parsing';

describe('parseClaudeGptOpinion (마크다운 헤더 형식)', () => {
  it('null/빈 입력은 기본값', () => {
    expect(parseClaudeGptOpinion(null)).toEqual({ opinion: '—', score: null, target: '—' });
    expect(parseClaudeGptOpinion('')).toEqual({ opinion: '—', score: null, target: '—' });
  });

  it('의견+점수 추출 ("매수 (85점)")', () => {
    const r = parseClaudeGptOpinion('### 투자의견\n매수 (85점)');
    expect(r.opinion).toBe('매수');
    expect(r.score).toBe(85);
  });

  it('점수 없는 의견은 대시 앞부분만 ("중립 — 관망")', () => {
    const r = parseClaudeGptOpinion('### 투자의견\n중립 — 관망 권장');
    expect(r.opinion).toBe('중립');
    expect(r.score).toBeNull();
  });

  it('목표주가 추정 추출', () => {
    const r = parseClaudeGptOpinion('### 투자의견\n매수 (70점)\n### 목표주가 추정\n95,000원');
    expect(r.target).toBe('95,000원');
  });

  it('투자의견 헤더 없으면 의견은 대시, target은 대시', () => {
    const r = parseClaudeGptOpinion('### 다른섹션\n내용');
    expect(r).toEqual({ opinion: '—', score: null, target: '—' });
  });
});

describe('parseGeminiOpinion (표 형식)', () => {
  it('null/빈 입력은 기본값', () => {
    expect(parseGeminiOpinion(null)).toEqual({ opinion: '—', score: null, target: '—' });
  });

  it('표에서 의견+점수 추출 (** 제거)', () => {
    const r = parseGeminiOpinion('| 투자의견 | **매수 (72점)** |');
    expect(r.opinion).toBe('매수');
    expect(r.score).toBe(72);
  });

  it('점수 없으면 공백/대시 앞부분만', () => {
    const r = parseGeminiOpinion('| 투자의견 | 보유 - 유지 |');
    expect(r.opinion).toBe('보유');
    expect(r.score).toBeNull();
  });

  it('목표주가 표 셀 추출 (** 제거)', () => {
    const r = parseGeminiOpinion('| 투자의견 | 매수 (60점) |\n| 목표주가 | **88,000원** |');
    expect(r.target).toBe('88,000원');
  });
});

describe('opinionColor (의견 텍스트→색상, 한국 관습: 매수=빨강·매도=파랑)', () => {
  // 1a7391d에서 점수 구간제 → 의견 텍스트 기준으로 변경됨(테스트 동기화)
  it('매수 계열 = 빨강', () => {
    expect(opinionColor('적극매수', 90)).toBe('#dc2626');
    expect(opinionColor('강력매수', null)).toBe('#dc2626');
    expect(opinionColor('비중확대', null)).toBe('#dc2626');
    expect(opinionColor('매수', 70)).toBe('#e11d48');
  });

  it('매도 계열 = 파랑', () => {
    expect(opinionColor('적극매도', 10)).toBe('#1d4ed8');
    expect(opinionColor('강력매도', null)).toBe('#1d4ed8');
    expect(opinionColor('매도', 25)).toBe('#2563eb');
    expect(opinionColor('비중축소', null)).toBe('#2563eb');
  });

  it('중립/관망/보유/빈값 = 회색 (점수는 무시)', () => {
    expect(opinionColor('중립', 50)).toBe('#6b7280');
    expect(opinionColor('관망', 85)).toBe('#6b7280');
    expect(opinionColor('', null)).toBe('#6b7280');
  });
});
