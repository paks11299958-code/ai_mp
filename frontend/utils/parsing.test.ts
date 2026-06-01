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

describe('opinionColor (점수→색상)', () => {
  it('점수 구간별 색상', () => {
    expect(opinionColor('매수', 90)).toBe('#16a34a'); // >=85
    expect(opinionColor('매수', 70)).toBe('#2563eb'); // >=65
    expect(opinionColor('중립', 50)).toBe('#d97706'); // >=40
    expect(opinionColor('매도', 25)).toBe('#ea580c'); // >=20
    expect(opinionColor('매도', 10)).toBe('#dc2626'); // <20
  });

  it('경계값 포함 확인 (>=)', () => {
    expect(opinionColor('x', 85)).toBe('#16a34a');
    expect(opinionColor('x', 65)).toBe('#2563eb');
    expect(opinionColor('x', 40)).toBe('#d97706');
    expect(opinionColor('x', 20)).toBe('#ea580c');
  });

  it('점수 null이면 의견 키워드로 추정 (매수→72, 매도→30, 기타→50)', () => {
    expect(opinionColor('매수', null)).toBe('#2563eb'); // 72 → >=65
    expect(opinionColor('매도', null)).toBe('#ea580c'); // 30 → >=20 (40 미만)
    expect(opinionColor('중립', null)).toBe('#d97706'); // 50 → >=40
  });
});
