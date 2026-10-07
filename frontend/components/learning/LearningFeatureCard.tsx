import React from 'react';
import './learningStudy.css';

export const LearningFeatureCard = ({ onSelect, home = false, focused = false, onShare, onFavorite, favorite }: {
    onSelect: () => void; home?: boolean; focused?: boolean;
    onShare?: () => void; onFavorite?: () => void; favorite?: boolean;
}) => (
    <div role="button" tabIndex={0} className={`lc-feature-card${home ? ' lc-feature-home' : ''}`}
        onClick={onSelect} onKeyDown={event => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault(); onSelect();
            }
        }} data-learning-card={home ? 'home' : 'feature'} data-focused={focused || undefined}>
        <img src="/learning/menu/1.webp" alt="" />
        <span><small>나만의 공부 코치</small><strong>AI 학습코칭</strong>
            <small>오늘 할 공부를<br />함께 정해요.</small><em>목표부터 시작 →</em></span>
        {(onShare || onFavorite) && <div className="lc-feature-tools">
            {onShare && <button type="button" aria-label="학습코칭 공유" onClick={event => { event.stopPropagation(); onShare(); }}>🔗</button>}
            {onFavorite && <button type="button" aria-label="학습코칭 즐겨찾기" aria-pressed={favorite}
                onClick={event => { event.stopPropagation(); onFavorite(); }}>{favorite ? '★' : '☆'}</button>}
        </div>}
    </div>
);
