import React, { useEffect } from 'react';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';
import { LearningProgress, LearningShell } from './LearningParts';
import { type TodayResponse, type CurriculumResponse, todayHref } from './learningModel';
import { useLearningRead } from './useLearningRead';

export const LearningDashboard: React.FC = () => {
    const auth = useLearnAuth();
    const today = useLearningRead<TodayResponse>('/api/aimp/learning/today', auth === 'ok');
    const curriculum = useLearningRead<CurriculumResponse>('/api/aimp/learning/curriculum', auth === 'ok' && !!today.data?.goal);
    useEffect(() => { if (auth === 'guest') goLoginTo('/learning/dashboard'); }, [auth]);
    const data = today.data;
    const reportUnavailable = new URLSearchParams(window.location.search).get('report') === 'unavailable';
    return (
        <LearningShell dashboard>
            <div className="lc-dash-title"><span className="lc-eyebrow">MY STUDY / PROGRESS</span>
                <h1>내 공부, 어디까지 왔을까요?</h1><p>오늘 할 일과 쌓인 진도를 확인해요.</p></div>
            {reportUnavailable && <section className="lc-note" role="status">아직 연결된 주간 리포트가 없어요.</section>}
            {auth === 'checking' || today.loading ? <section className="lc-panel" role="status">불러오는 중…</section>
                : today.error ? <section className="lc-panel" role="alert"><h2>{today.error}</h2>
                    <button className="lc-btn" onClick={today.retry}>다시 확인</button></section>
                    : !data?.goal ? <section className="lc-panel lc-empty"><h2>아직 시작한 학습이 없어요.</h2>
                        <p>목표를 정하면 여기에서 진행 상황을 볼 수 있어요.</p><a className="lc-btn" href="/learning/onboarding">새 학습</a></section>
                        : <>
                            <div className="lc-stats">{[[`${data.goal.progressPercent}%`, '전체 진도'], [`${data.streak}일`, '연속 학습'],
                                [`${data.reviewDueCount}개`, '오늘 배정 복습']].map(([value, label]) => (
                                <section className="lc-panel lc-stat" key={label}><strong>{value}</strong><span>{label}</span></section>
                            ))}</div>
                            <div className="lc-dashboard"><section className="lc-panel">
                                <span className="lc-small">선택한 학습</span><h2>{data.goal.title}</h2><LearningProgress value={data.goal.progressPercent} />
                                <div className="lc-section-head"><h3>주차별 진척</h3><a href="/learning/curriculum">전체 보기</a></div>
                                {curriculum.loading && <p role="status">주차별 진척을 확인하고 있어요…</p>}
                                {curriculum.error && <div role="alert"><p>주차별 진척을 불러오지 못했어요.</p>
                                    <button className="lc-btn lc-secondary" onClick={curriculum.retry}>주차별 진척 다시 확인</button></div>}
                                {curriculum.data?.goal?.id === data.goal.id && curriculum.data.weeks.map(week => {
                                    const completed = week.modules.filter(module => module.completed).length;
                                    return <div className="lc-week" key={week.weekNo}><header><strong>{week.weekNo}주차</strong>
                                        <span>{week.modules.length ? `${completed}/${week.modules.length}개 완료` : '아직 미배정'}</span></header>
                                        {week.modules.length > 0 && <div className="lc-bar" role="progressbar" aria-label={`${week.weekNo}주차 진도`}
                                            aria-valuenow={completed} aria-valuemin={0} aria-valuemax={week.modules.length}>
                                            <i style={{ width: `${completed / week.modules.length * 100}%` }} /></div>}</div>;
                                })}
                            </section><div>
                                <section className="lc-panel lc-task"><span className="lc-label">{data.todayTask?.completedAt ? '오늘 완료' : '오늘 할 일'}</span>
                                    {data.todayTask ? <><h2>{data.todayTask.module.title}</h2>
                                        <p>{data.todayTask.module.weekNo}주차 · {data.todayTask.module.orderNo}일차
                                            {data.todayTask.completedAt && data.todayTask.score !== null ? ` · 점수 ${data.todayTask.score}점` : ''}</p>
                                        <a className="lc-btn" href={todayHref(data)}>{data.todayTask.completedAt ? '오늘 학습 다시 보기' : '오늘 학습 시작'}</a></>
                                        : <p>오늘 배정된 학습이 없습니다.</p>}
                                </section>
                                <section className="lc-note"><strong>오늘의 복습 {data.reviewDueCount}개</strong><p>오늘 배정된 분량만 보여드려요.</p>
                                    <a className="lc-btn lc-secondary" href="/learning/review">오답 복습</a></section>
                                <section className="lc-panel"><h3>주간 기록</h3><p>아직 연결된 주간 리포트가 없어요.</p></section>
                            </div></div>
                        </>}
        </LearningShell>
    );
};
