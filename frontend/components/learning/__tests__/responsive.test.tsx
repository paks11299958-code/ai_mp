import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';

import { LearningDashboard } from '../LearningDashboard';
import { LearningTask } from '../LearningTask';
import { LearningReview } from '../LearningReview';
import { LearningWeeklyReport } from '../LearningWeeklyReport';
import { LearningSettings } from '../LearningSettings';
import { LearningPlanConfirm } from '../LearningPlanConfirm';
import { LearningGenerationProgress } from '../LearningGenerationProgress';

// 묶음 E(11단계, 2026-08-11) — 360px 폭 반응형 검증.
// ★운영 URL은 이 세션(서버2) IP가 Vercel 봇 체크포인트에 차단돼 접속 불가하고,
// feature 브랜치라 애초에 배포 대상도 아니다. 로컬 vite preview는 API 프록시가
// shared-api(서버1)로 연결되지 않아 로딩 상태만 보인다(과거 smoke-test.cjs 주석에서도
// 확인된 동일 제약). 그래서 fetch를 mock해 실제 데이터가 채워진 상태의 DOM을
// jsdom+360px 컨테이너에 렌더링해 가로 스크롤·잘림·터치 영역을 검사한다.
// 일부러 긴 문자열(취약 태그·긴 문항·긴 커리큘럼 제목)을 mock 데이터에 넣어
// 실사용에서 나올 수 있는 오버플로우까지 함께 잡는다.

const VIEWPORT_WIDTH = 360;

function mockFetchByUrl(handlers: Record<string, any>) {
    global.fetch = vi.fn((url: string) => {
        const key = Object.keys(handlers).find(k => url.includes(k));
        if (!key) return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'not found' }) } as any);
        const body = handlers[key];
        return Promise.resolve({ ok: true, status: 200, json: async () => body } as any);
    }) as any;
}

function setPath(path: string, search = '') {
    window.history.pushState({}, '', path + search);
}

// jsdom은 실제 CSS 레이아웃 엔진이 없어 getBoundingClientRect가 항상 0을 반환한다.
// 대신 Tailwind 클래스 문자열에서 "뷰포트(360px)보다 넓은 고정폭"을 만들 수 있는
// 위험 패턴(큰 고정 w-, min-w-, 과도한 px 패딩 등)이 있는지 정적으로 검사한다.
// 실제 렌더 여부(조건부 분기까지 통과했는지)는 DOM 존재 확인으로, 폭 안전성은
// 클래스 검사로 나눠 검증한다.
const DANGEROUS_WIDTH_CLASS = /\bw-\[(?:[4-9]\d{2}|\d{4,})px\]|\bmin-w-\[(?:[4-9]\d{2}|\d{4,})px\]/;

function assertNoDangerousWidthClasses(container: HTMLElement) {
    const all = container.querySelectorAll('*');
    const offenders: string[] = [];
    all.forEach(el => {
        const cls = el.className?.toString?.() ?? '';
        if (DANGEROUS_WIDTH_CLASS.test(cls)) offenders.push(`${el.tagName}.${cls.slice(0, 60)}`);
    });
    expect(offenders, `360px보다 넓은 고정폭 클래스 발견: ${offenders.join(', ')}`).toHaveLength(0);
}

beforeEach(() => {
    localStorage.setItem('token', 'fake-token-for-render-test');
    Object.defineProperty(window, 'innerWidth', { writable: true, value: VIEWPORT_WIDTH });
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('S4 대시보드 — 360px', () => {
    it('긴 커리큘럼 제목과 복습 배지가 있어도 고정폭 오버플로우 클래스가 없다', async () => {
        mockFetchByUrl({
            '/api/auth/me': { user: { id: 1 } },
            '/api/aimp/learning/today': {
                streak: 42,
                todayTask: {
                    id: 't1', completedAt: null, score: null,
                    module: { id: 'm1', title: '아주 아주 아주 아주 아주 아주 긴 모듈 제목 테스트용 문자열입니다', weekNo: 3, orderNo: 5, status: 'pending' },
                },
                reviewDueCount: 5,
                goal: { id: 'g1', title: '정보처리기사 필기 합격을 위한 12주 완성 초장문 커리큘럼 제목 테스트', progressPercent: 63 },
            },
        });
        setPath('/learning/dashboard');
        const { container, findByText } = render(<LearningDashboard />);
        await findByText(/오늘의 복습/);
        assertNoDangerousWidthClasses(container);
    });
});

describe('S5-7 학습(본문/퀴즈/결과) — 360px', () => {
    it('긴 문항·긴 선택지가 있어도 고정폭 오버플로우 클래스가 없다', async () => {
        mockFetchByUrl({
            '/api/auth/me': { user: { id: 1 } },
            '/api/aimp/learning/modules/': {
                id: 'm1', title: '모듈', objective: '목표',
                contentMd: '## 핵심 개념\n\n'.repeat(3) + '매우 긴 학습 본문 내용이 이어집니다. '.repeat(40),
                questions: [
                    {
                        id: 'q1',
                        stem: '다음 중 소프트웨어 요구사항 분석 절차에서 가장 먼저 수행해야 하는 단계이자 이후 모든 설계 활동의 기반이 되는 것은 무엇인가?',
                        choices: [
                            '요구사항을 인터뷰·설문·관찰 등 다양한 방법으로 광범위하게 수집하는 단계',
                            '비기능 요구사항',
                            '요구사항 명세화',
                            '요구사항 검증',
                        ],
                        difficulty: 2, tag: '요구사항분석',
                    },
                ],
            },
        });
        setPath('/learning/task/task1', '?m=module1');
        const { container, findByText } = render(<LearningTask />);
        await findByText(/퀴즈 시작/);
        assertNoDangerousWidthClasses(container);
    });
});

describe('S8 오답노트 — 360px', () => {
    it('긴 문항 텍스트가 있어도 고정폭 오버플로우 클래스가 없다', async () => {
        mockFetchByUrl({
            '/api/auth/me': { user: { id: 1 } },
            '/api/aimp/learning/review': {
                items: [
                    {
                        reviewItemId: 'r1', questionId: 'q1',
                        stem: '요구사항 분석 절차의 순서로 가장 올바른 것은 무엇이며 각 단계에서 산출되는 문서의 이름은 무엇인가?',
                        choices: ['수집→분류→명세화→검증', '분류→수집→검증→명세화', '명세화→수집→분류→검증', '검증→수집→명세화→분류'],
                        moduleTitle: '요구사항 분석 기초', intervalDays: 3, dueDate: '2026-08-12',
                    },
                ],
            },
        });
        setPath('/learning/review');
        const { container, findByText } = render(<LearningReview />);
        await findByText(/요구사항 분석 기초/);
        assertNoDangerousWidthClasses(container);
    });

    it('복습 항목이 없을 때도 정상 렌더링된다', async () => {
        mockFetchByUrl({
            '/api/auth/me': { user: { id: 1 } },
            '/api/aimp/learning/review': { items: [] },
        });
        setPath('/learning/review');
        const { container, findByText } = render(<LearningReview />);
        await findByText(/복습할 문항이 없습니다/);
        assertNoDangerousWidthClasses(container);
    });
});

describe('S9 주간 리포트 — 360px', () => {
    it('취약 태그 여러 개와 긴 제안 텍스트가 있어도 고정폭 오버플로우 클래스가 없다', async () => {
        mockFetchByUrl({
            '/api/auth/me': { user: { id: 1 } },
            '/api/aimp/learning/reports/': {
                id: 'r1', weekStart: '2026-08-04',
                metrics: { completedCount: 4, totalCount: 5, correctRate: 0.72, tagStats: [] },
                summaryMd: '이번 주 4개 모듈을 완료했고 정답률은 72%였습니다. 네트워크 관련 문항에서 특히 취약함을 보였습니다.',
                suggestion: {
                    weakTags: ['네트워크 기초', 'OSI 7계층 모델 이해', '데이터베이스 정규화 심화 개념'],
                    suggestion: '다음 주에는 네트워크 기초 개념을 복습하는 별도 주차를 추가하는 것을 제안합니다. 특히 OSI 7계층 모델과 관련된 문항에서 반복적인 오답이 확인되었습니다.',
                },
                accepted: false,
            },
        });
        setPath('/learning/report/week1');
        const { container, findByText } = render(<LearningWeeklyReport />);
        await findByText(/조정안 수락/);
        assertNoDangerousWidthClasses(container);
    });
});

describe('S11 설정 — 360px', () => {
    it('요일 7개 토글과 시간 옵션이 한 줄에서 잘리지 않는다(가로 스크롤 위험 클래스 없음)', async () => {
        mockFetchByUrl({
            '/api/auth/me': { user: { id: 1 } },
            '/api/aimp/learning/settings': { level: 'basic', notifyHour: 19, studyDays: [1, 2, 3, 4, 5] },
        });
        setPath('/learning/settings');
        const { container, findByText } = render(<LearningSettings />);
        await findByText(/학습 요일/);
        assertNoDangerousWidthClasses(container);

        // 요일 토글 7개가 flex-1로 균등 분배되는지 확인(개별 고정폭이 아님).
        const dayButtons = Array.from(container.querySelectorAll('button')).filter(b =>
            ['일', '월', '화', '수', '목', '금', '토'].includes(b.textContent?.trim() ?? ''));
        expect(dayButtons).toHaveLength(7);
        dayButtons.forEach(b => expect(b.className).toMatch(/flex-1/));
    });
});

describe('S3 커리큘럼 확인 — 360px', () => {
    it('주차가 12개(최대 기간)여도 고정폭 오버플로우 클래스가 없다', async () => {
        sessionStorage.setItem('learningOnboardingDraft', JSON.stringify({
            rawInput: '정보처리기사 합격', durationWeeks: 12, daysPerWeek: 5, minutesPerSession: 30, level: 'basic',
        }));
        mockFetchByUrl({
            '/api/auth/me': { user: { id: 1 } },
            '/api/aimp/learning/goals': {
                id: 'g1', title: '정보처리기사 12주 완성 커리큘럼', status: 'outline_ready',
                weekOutlines: Array.from({ length: 12 }, (_, i) => ({
                    id: `w${i + 1}`, weekNo: i + 1,
                    title: `${i + 1}주차: 매우 길게 작성된 주차 제목 테스트 문자열입니다`,
                    theme: '이번 주 학습 주제를 설명하는 다소 긴 문장으로 작성된 테마 텍스트입니다.',
                })),
            },
        });
        setPath('/learning/onboarding/plan');
        const { container, findByText } = render(<LearningPlanConfirm />);
        await findByText('12주차: 매우 길게 작성된 주차 제목 테스트 문자열입니다');
        assertNoDangerousWidthClasses(container);
        sessionStorage.clear();
    });
});

describe('S3-생성중 진행 화면 — 360px', () => {
    it('진행률 표시와 준비중 안내가 고정폭 오버플로우 없이 렌더링된다', async () => {
        mockFetchByUrl({
            '/api/aimp/learning/goals/goal1/generation-status': {
                status: 'confirmed_generating', totalWeeks: 12, generatedWeeks: 5,
                progressPercent: 42, hasFailure: false, failedWeeks: [],
            },
        });
        const { container, findByText } = render(<LearningGenerationProgress goalId="goal1" />);
        await findByText(/5 \/ 12주차 완료/);
        assertNoDangerousWidthClasses(container);
    });

    it('실패 상태일 때 재시도 버튼이 고정폭 오버플로우 없이 렌더링된다', async () => {
        mockFetchByUrl({
            '/api/aimp/learning/goals/goal1/generation-status': {
                status: 'confirmed_generation_failed', totalWeeks: 12, generatedWeeks: 7,
                progressPercent: 58, hasFailure: true, failedWeeks: [8],
            },
        });
        const { container, findByText } = render(<LearningGenerationProgress goalId="goal1" />);
        await findByText(/다시 시도/);
        assertNoDangerousWidthClasses(container);
    });
});
