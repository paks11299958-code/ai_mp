import React from 'react';
import { LearningTabs } from './LearningTabs';
import { LEARNING_MENU, learningMenuHref, progressValue, todayHref, type TodayResponse } from './learningModel';
import './learningStudy.css';

export const LearningShell: React.FC<React.PropsWithChildren<{ dashboard?: boolean }>> = ({ children, dashboard }) => (
    <div className="lc-root lc-theme">
        <header className="lc-header"><a href="/">← AI 스퀘어</a><strong>AI 학습코칭</strong></header>
        {dashboard && <LearningTabs active="dashboard" />}
        <main className="lc-main">{children}</main>
    </div>
);
export const LearningMenu = ({ data, onCoach, disabled = false }: {
    data: TodayResponse | null; onCoach?: () => void; disabled?: boolean;
}) => (
    <nav className="lc-menu" aria-label="학습 메뉴">
        {LEARNING_MENU.map((item, index) => (
            <a key={item.name} href={learningMenuHref(index, data)} className="lc-menu-card"
                aria-disabled={disabled || undefined} onClick={event => {
                    if (disabled) event.preventDefault();
                    else if (index === 5 && onCoach) { event.preventDefault(); onCoach(); }
                }}>
                <img src={`/learning/menu/${index}.webp`} alt="" />
                <span><strong>{item.name}</strong><small>{item.description}</small></span>
            </a>
        ))}
    </nav>
);
export const LearningProgress = ({ value }: { value: number }) => (
    <div className="lc-progress">
        <div className="lc-progress-head"><strong>전체 진도</strong><strong>{progressValue(value)}%</strong></div>
        <div className="lc-bar" role="progressbar" aria-label="전체 학습 진도"
            aria-valuenow={progressValue(value)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${progressValue(value)}%` }} />
        </div>
        <p>조금씩, 끝까지 가는 중이에요.</p>
    </div>
);
export const LearningChecklist = ({ data }: { data: TodayResponse }) => (
    <section className="lc-checklist" aria-label="오늘 할 일">
        <h3>오늘 할 일</h3>
        <a href={todayHref(data)}><span aria-hidden="true">{data.todayTask?.completedAt ? '☑' : '□'}</span>
            <span><strong>오늘 본문·퀴즈</strong><small>{data.todayTask
                ? (data.todayTask.completedAt ? '오늘 과제를 완료했어요' : '오늘 과제를 이어서 해요') : '오늘 배정된 학습이 없어요'}</small></span>
        </a>
        <a href="/learning/review"><span aria-hidden="true">{data.reviewDueCount === 0 ? '—' : '□'}</span>
            <span><strong>오늘 복습 {data.reviewDueCount}개</strong><small>오늘 배정된 분량이에요</small></span>
        </a>
    </section>
);
export const LearningCurrent = ({ data }: { data: TodayResponse }) => data.goal ? (
    <section className="lc-panel lc-current">
        <div><span className="lc-label">진행 중인 학습</span><h2>{data.goal.title}</h2>
            {data.todayTask && <p>오늘: {data.todayTask.module.title} · {data.todayTask.module.weekNo}주차 {data.todayTask.module.orderNo}일차</p>}
            <LearningChecklist data={data} />
            <div className="lc-actions"><a className="lc-btn" href={todayHref(data)}>오늘 학습 이어하기</a>
                <a className="lc-btn lc-secondary" href="/learning/dashboard">진행 보기</a></div>
        </div><LearningProgress value={data.goal.progressPercent} />
    </section>
) : null;
export const LearningBenefits = () => (
    <section className="lc-benefits" aria-label="학습코칭 소개">
        {[['내게 맞는 계획', '목표와 수준부터 정해요', 2], ['매일 조금씩', '본문과 퀴즈로 배워요', 1],
            ['틀린 건 다시', '간격을 두고 복습해요', 3], ['한 주 돌아보기', '진도와 취약점을 살펴요', 4]].map(([title, text, image]) => (
            <div key={title}><img src={`/learning/menu/${image}.webp`} alt="" /><div><h3>{title}</h3><p>{text}</p></div></div>
        ))}
    </section>
);
