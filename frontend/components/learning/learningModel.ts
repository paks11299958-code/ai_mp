export type TodayResponse = {
    streak: number;
    todayTask: {
        id: string; completedAt: string | null; score: number | null;
        module: { id: string; title: string; weekNo: number; orderNo: number; status: string };
    } | null;
    reviewDueCount: number;
    goal: { id: string; title: string; progressPercent: number } | null;
};
export type CurriculumResponse = {
    goal: TodayResponse['goal'];
    weeks: { weekNo: number; modules: { id: string; completed: boolean }[] }[];
};
export const STUDY_CHAT_HREF = '/?p=learning-coach&studyChat=1';
export const LEARNING_MENU = [
    { name: '새 학습', description: '목표부터 가볍게' },
    { name: '오늘 학습', description: '하던 공부 이어서' },
    { name: '학습 계획', description: '주차별 전체 보기' },
    { name: '오답 복습', description: '틀린 문제 다시' },
    { name: '주간 기록', description: '이번 주 돌아보기' },
    { name: '코치 대화', description: '막힌 부분 나누기' },
] as const;
export const todayHref = (data: TodayResponse | null) => data?.todayTask
    ? `/learning/task/${encodeURIComponent(data.todayTask.id)}?m=${encodeURIComponent(data.todayTask.module.id)}`
    : '/learning/dashboard';
export const learningMenuHref = (index: number, data: TodayResponse | null) => [
    '/learning/onboarding', todayHref(data), '/learning/curriculum', '/learning/review',
    '/learning/dashboard?report=unavailable', STUDY_CHAT_HREF,
][index];
export const progressValue = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
