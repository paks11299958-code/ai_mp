import React from 'react';

export const CHAERIN_ID = 'cmqgne6wz0000j3beoix3h9zc';
export const CHAERIN_PORTRAIT = '/chaerin/clinic/hero_chaerin.jpg';
export const CHAERIN_ART = '/chaerin/menu/';

export const CHAERIN_STUDIO = [
    { key: 'hair', name: '헤어 체인지', desc: '사진으로 다른 헤어 보기', cost: '200P', art: 'hair' },
    { key: 'outfit', name: '프로필 화보', desc: '사진 한 장으로 프로필 화보', cost: '200P', art: 'outfit' },
    { key: 'agetransform', name: '시간여행', desc: '다른 나이의 내 모습 보기', cost: '100P', art: 'agetransform' },
    { key: 'lookalike', name: '닮은꼴', desc: '나와 닮은 얼굴 찾아보기', cost: '무료', art: 'lookalike' },
] as const;

interface Props {
    estimatePrice: string;
    onEstimate: () => void;
    onTable: () => void;
    onFeature: (key: string) => void;
    disabled?: boolean;
}

/** 표시 메타데이터만 공유한다. 과금·생성은 기존 호출자가 처리한다. */
export const ChaerinMenu: React.FC<Props> = ({ estimatePrice, onEstimate, onTable, onFeature, disabled }) => {
    const information = [
        {
            key: 'beauty-estimate',
            name: '성형 견적',
            desc: '관심 부위의 공개 비용 범위',
            cost: estimatePrice,
            art: 'estimate',
            action: onEstimate,
        },
        {
            key: 'beauty-table',
            name: '평균 가격',
            desc: '부위별 공개 가격을 먼저 보기',
            cost: '무료',
            art: 'table',
            action: onTable,
        },
    ];
    const groups = [
        { title: '01 · 성형 정보', caption: 'INFORMATION', items: information },
        {
            title: '02 · 스튜디오',
            caption: 'STUDIO',
            items: CHAERIN_STUDIO.map((item) => ({ ...item, action: () => onFeature(item.key) })),
        },
    ];
    return (
        <div className="cb-menu">
            {groups.map((group, index) => (
                <section className={`cb-menu-group cb-group-${index}`} key={group.title}>
                    <div className="cb-section-head">
                        <h2>{group.title}</h2>
                        <span>{group.caption}</span>
                    </div>
                    <div className="cb-picture-grid">
                        {group.items.map((item, i) => (
                            <button
                                type="button"
                                className="cb-picture-card"
                                key={item.key}
                                data-feature={item.key}
                                onClick={item.action}
                                disabled={disabled}
                            >
                                <span className="cb-card-art">
                                    <img src={`${CHAERIN_ART}${item.art}-v3.webp`} alt="" loading="lazy" />
                                    <span className="cb-price">{item.cost}</span>
                                </span>
                                <span className="cb-card-copy">
                                    <strong>
                                        <span className="cb-card-number" aria-hidden="true">
                                            0{index ? i + 3 : i + 1}
                                        </span>
                                        {item.name}
                                    </strong>
                                    <small>{item.desc}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};
