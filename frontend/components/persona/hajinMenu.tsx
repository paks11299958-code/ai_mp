import React from 'react';
import { setHomepageBoardStartStep } from '../../lib/homepageStart';

export const HAJIN_MENU = [
    { key: 'create', label: '우리 가게 홈페이지 만들기', note: '신청서부터 시작', badge: '3,000P', image: '/hajin/showroom/cafe.webp', feature: 'homepage', step: 'form' },
    { key: 'samples', label: '샘플 둘러보기', note: '업종별 완성작', badge: '[예시]', image: '/hajin/showroom/salon.webp', feature: 'homepage', step: 'intro' },
    { key: 'edit', label: '내 홈페이지 고치기', note: '미리보기 + 수정 대화', badge: '고치는 중', image: '/hajin/showroom/cafe.webp', feature: 'homepage', step: 'list' },
    { key: 'learn', label: '배우기', note: '차근차근 따라하기', badge: '학습자료', image: '/learning/menu/0.webp', feature: 'learn' },
] as const;

export type HajinMenuKey = typeof HAJIN_MENU[number]['key'];

const releasePageNavigationGuard = () => {
    try {
        const state = window.history.state as Record<string, unknown> | null;
        if (state?.aiLayer) window.history.replaceState({ ...state, aiLayer: false }, '');
    } catch { /* history state unavailable: the existing feature callback remains the fallback */ }
};

export const openHajinMenuItem = (key: HajinMenuKey, onFeature: (key: string) => void, isGuest = false) => {
    const item = HAJIN_MENU.find(candidate => candidate.key === key);
    if (!item) return;
    // 비로그인 안내는 HomepageBoard를 열지 않아 단계를 소비할 수 없다.
    // 이때 기록하면 가입 후 관계없는 기존 호출의 기본 intro를 덮어쓴다.
    if (!isGuest && item.feature === 'homepage' && 'step' in item) setHomepageBoardStartStep(item.step);
    // /learn은 전체 페이지 이동이다. 로그인 화면에서는 App의 레이어 정리가 history.back으로
    // 새 주소를 되돌리지 않도록 현재 가드 표식만 소비한다. 손님은 안내 모달 위에 진입화면을
    // 유지해야 하므로 가드를 그대로 둔다.
    if (item.feature === 'learn' && !isGuest) releasePageNavigationGuard();
    onFeature(item.feature);
};

export const HajinMenu: React.FC<{ onFeature: (key: string) => void; compact?: boolean; disabled?: boolean; isGuest?: boolean }> = ({ onFeature, compact, disabled, isGuest }) => (
    <nav className={`hj-menu${compact ? ' hj-menu-compact' : ''}`} aria-label="박하진 메뉴">
        {HAJIN_MENU.map(item => (
            <button key={item.key} type="button" className={`hj-card hj-card-${item.key}`} data-menu-key={item.key}
                    onClick={() => openHajinMenuItem(item.key, onFeature, isGuest)} disabled={disabled}>
                {item.key === 'edit' ? (
                    <span className="hj-edit-preview" aria-hidden="true">
                        <img src={item.image} alt="" />
                        <span className="hj-edit-tools"><b>수정 대화</b><i /><i /><em>변경 요청 보내기</em></span>
                    </span>
                ) : <img src={item.image} alt="" />}
                <span className="hj-card-badge">{item.badge}</span>
                <span className="hj-card-copy"><strong>{item.label}</strong>{!compact && <small>{item.note}</small>}</span>
            </button>
        ))}
    </nav>
);
