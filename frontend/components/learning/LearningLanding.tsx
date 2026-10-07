import React from 'react';
import { useLearnAuth } from '../learn/LearnKit';
import { StudyDeskMotion } from './StudyDeskMotion';
import { LearningBenefits, LearningCurrent, LearningMenu, LearningShell } from './LearningParts';
import { STUDY_CHAT_HREF, type TodayResponse } from './learningModel';
import { useLearningRead } from './useLearningRead';

export const LearningLanding: React.FC = () => {
    const auth = useLearnAuth();
    const { data, loading, error, retry } = useLearningRead<TodayResponse>('/api/aimp/learning/today', auth === 'ok');
    const pending = auth === 'checking' || loading;
    const fresh = !data?.goal;
    return (
        <LearningShell>
            <section className="lc-hero"><StudyDeskMotion data={data} />
                <div className="lc-hero-copy"><span className="lc-eyebrow">YOUR DAILY STUDY</span>
                    <h1>{fresh ? <>첫 페이지에,<br />배우고 싶은 것을.</> : <>책상 앞에서,<br />한 걸음씩 배워요.</>}</h1>
                    <p>{fresh ? <>목표를 정하면 계획부터 복습까지.<br />혼자 공부하는 길에 코치가 함께할게요.</>
                        : <>책상에 앉으셨나요?<br />지금 할 공부부터 차근차근 정리해 드릴게요.</>}</p>
                </div>
            </section>
            {pending ? <section className="lc-panel" role="status">학습 현황을 확인하고 있어요…</section>
                : error ? <section className="lc-panel" role="alert"><h2>{error}</h2><p>잠시 후 다시 확인해 주세요.</p>
                    <button className="lc-btn" onClick={retry}>다시 확인</button></section>
                    : data?.goal ? <LearningCurrent data={data} /> : <section className="lc-panel">
                        <h2>목표부터 가볍게 정해볼까요?</h2><p>목표 입력·개요 확인은 무료예요.<br />확정 전에 포인트를 안내해 드려요.</p>
                        <div className="lc-actions"><a className="lc-btn" href="/learning/onboarding">새 학습 시작</a></div>
                        {auth === 'guest' && <p className="lc-small">로그인 없이 목표부터 입력해볼 수 있어요.</p>}
                    </section>}
            <div className="lc-section-head"><h2>어떤 도움이 필요하세요?</h2><span>학습 메뉴</span></div>
            <LearningMenu data={data} />
            <div className="lc-coach"><div><h2>공부가 막히는 날에도</h2><p>코치와 한 가지씩 풀어가요.</p></div>
                <a className="lc-btn" href={STUDY_CHAT_HREF}>코치와 대화하기</a></div>
            {!pending && !error && fresh && <LearningBenefits />}
        </LearningShell>
    );
};
