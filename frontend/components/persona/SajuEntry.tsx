import React, { useEffect, useRef } from 'react';
import { MpnFeatureIcon } from '../MainPageNew';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';
import { SAJU_TONE, SAJU_HERO_IMAGES } from './sajuHero';

// 도결(道潔) 선생 전용 진입 화면 — "사주 사이트 같은 큰 랜딩".
//
// 왜 별도 화면인가(2026-08-26 사장 지시): 페르소나에 들어가면 채팅창이 먼저 보여
// **뭘 할 수 있는지 안 보이고 분위기도 안 산다**. 사주는 분위기 자체가 상품인데
// 일반 챗봇과 구분이 되지 않았다. 그래서 도결 선생만 랜딩을 먼저 띄운다.
//
// ★계약은 기존 시트와 똑같다 — onStart()=채팅, onFeature(key)=그 기능, onClose()=닫기.
//   App.tsx는 이 컴포넌트의 존재를 모른다(분기는 PersonaEntrySheet 안에서 한다).
//   ★★App.tsx를 건드리면 전 화면 백지 사고가 재발한다(2026-07-29 useCallback TDZ 실사고).
//
// ★묶음 A(이번) 범위: 화면 구조와 분기까지. 히어로는 tiger.png 정적 표시다.
//   책 → 연기(상승) → 안개(가로) → 호랑이 캔버스 연출은 묶음 B에서 sajuHero.ts에 붙인다.

const T = SAJU_TONE;

// 스타일은 Tailwind가 아니라 이 컴포넌트 전용 CSS로 둔다.
// 기존 사이트는 밝은 보라·핑크 톤이라 유틸리티 클래스를 쓰면 톤이 섞인다 —
// 먹색/금박은 여기서 닫아두고, 밖으로 새지 않게 전부 `sj-` 접두사를 붙인다.
const SAJU_CSS = `
.sj-root{position:fixed;inset:0;z-index:85;overflow-y:auto;overflow-x:hidden;
  background:radial-gradient(120% 85% at 50% -10%, #1b1512 0%, ${T.ink} 42%, ${T.inkDeep} 100%);
  color:${T.text};-webkit-font-smoothing:antialiased;}
.sj-sheet{position:relative;box-sizing:border-box;width:100%;max-width:1240px;margin:0 auto;
  min-height:100%;padding:max(26px,env(safe-area-inset-top)) 20px max(36px,env(safe-area-inset-bottom));}
.sj-serif{font-family:'Noto Serif KR','Nanum Myeongjo',serif;}

.sj-close{position:absolute;top:max(14px,env(safe-area-inset-top));right:16px;z-index:3;
  width:40px;height:40px;display:flex;align-items:center;justify-content:center;
  border-radius:50%;border:1px solid ${T.line};background:rgba(20,16,14,0.72);
  color:${T.goldLight};font-size:17px;line-height:1;cursor:pointer;
  transition:transform .15s ease,background .15s ease;}
.sj-close:hover{background:rgba(40,32,26,0.9);}
.sj-close:active{transform:scale(.9);}

.sj-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.06fr);
  gap:44px;align-items:center;padding-top:26px;}

.sj-badge{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:999px;
  border:1px solid ${T.line};background:linear-gradient(135deg,rgba(201,162,39,0.14),rgba(184,53,44,0.10));
  color:${T.goldLight};font-size:12px;font-weight:700;letter-spacing:.02em;}
.sj-badge i{width:5px;height:5px;border-radius:50%;background:${T.vermilion};display:block;}

.sj-title{margin:18px 0 0;font-size:clamp(30px,4.4vw,46px);font-weight:700;line-height:1.24;
  letter-spacing:-.01em;
  background:linear-gradient(100deg,${T.goldLight} 0%,${T.gold} 45%,#f4e3a8 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;}
.sj-rule{margin:16px 0 0;width:64px;height:2px;border-radius:2px;
  background:linear-gradient(90deg,${T.gold},rgba(184,53,44,.7));}
.sj-desc{margin:16px 0 0;max-width:40ch;font-size:14.5px;line-height:1.85;color:${T.textSub};
  white-space:pre-line;}

.sj-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px;}
.sj-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 13px 7px 9px;border-radius:999px;
  border:1px solid ${T.line};background:rgba(240,233,220,0.045);color:${T.text};
  font-size:12.5px;font-weight:600;cursor:pointer;transition:border-color .15s ease,background .15s ease;}
.sj-chip:hover{background:rgba(201,162,39,0.12);border-color:rgba(201,162,39,0.45);}
.sj-chip:active{transform:scale(.97);}

.sj-ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px;}
.sj-cta{padding:14px 30px;border-radius:999px;border:none;cursor:pointer;
  font-size:15px;font-weight:700;color:#241a0c;
  background:linear-gradient(135deg,${T.goldLight} 0%,${T.gold} 100%);
  box-shadow:0 14px 30px -14px rgba(201,162,39,.85);
  transition:transform .15s ease;}
.sj-cta:active{transform:scale(.98);}
.sj-cta2{padding:14px 24px;border-radius:999px;cursor:pointer;
  font-size:14px;font-weight:600;color:${T.textSub};
  border:1px solid ${T.line};background:transparent;transition:color .15s ease,border-color .15s ease;}
.sj-cta2:hover{color:${T.goldLight};border-color:rgba(201,162,39,0.45);}

.sj-hero{position:relative;width:100%;border-radius:22px;overflow:hidden;
  border:1px solid ${T.line};background:#0b0908;
  box-shadow:0 40px 80px -40px rgba(0,0,0,.95), 0 0 0 1px rgba(0,0,0,.4);}
.sj-hero img{display:block;width:100%;height:auto;}
.sj-heroveil{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(78% 68% at 50% 46%, rgba(0,0,0,0) 40%, rgba(13,11,10,.55) 82%, rgba(13,11,10,.9) 100%);}

.sj-feats{margin-top:64px;}
.sj-featshead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;}
.sj-featstitle{margin:0;font-size:19px;font-weight:700;color:${T.text};}
.sj-featssub{margin:0;font-size:12.5px;color:${T.textSub};}
.sj-featgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px;}
.sj-feat{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;
  padding:16px 14px;border-radius:16px;text-align:left;cursor:pointer;
  border:1px solid ${T.line};background:linear-gradient(150deg,rgba(240,233,220,0.055),rgba(240,233,220,0.02));
  transition:border-color .15s ease,background .15s ease,transform .15s ease;}
.sj-feat:hover{border-color:rgba(201,162,39,0.45);background:rgba(201,162,39,0.09);}
.sj-feat:active{transform:scale(.98);}
.sj-featicon{flex:0 0 auto;width:38px;height:38px;display:flex;align-items:center;justify-content:center;
  border-radius:11px;background:rgba(201,162,39,0.10);border:1px solid rgba(201,162,39,0.18);}
.sj-featname{min-width:0;font-size:13.5px;font-weight:700;color:${T.text};line-height:1.35;
  overflow-wrap:anywhere;}

.sj-note{margin:26px 0 0;font-size:12px;line-height:1.7;color:${T.textSub};}
.sj-note b{color:${T.goldLight};font-weight:700;}

@media (max-width:820px){
  .sj-sheet{padding-left:16px;padding-right:16px;}
  .sj-top{grid-template-columns:minmax(0,1fr);gap:26px;padding-top:44px;}
  .sj-hero{order:-1;border-radius:18px;}
  .sj-desc{max-width:none;}
  .sj-feats{margin-top:44px;}
  .sj-featgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
  .sj-cta,.sj-cta2{flex:1 1 100%;text-align:center;}
}
@media (max-width:380px){
  .sj-featgrid{grid-template-columns:minmax(0,1fr);}
}
`;

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
}

export const SajuEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature }) => {
    const featsRef = useRef<HTMLDivElement | null>(null);

    // Esc로 닫기 — 전체를 덮는 화면이라 출구가 하나(✕)뿐이면 갇힌 느낌이 든다.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // ★DB(FEATURES_GRID)에서 온 것만 쓴다. 없는 기능을 지어내지 않는다.
    const features = guide.features ?? [];

    return (
        // 배경 클릭 = 닫기. 내용은 max-width로 묶여 있어 넓은 화면의 양옆이 배경이 된다.
        <div className="sj-root" onClick={onClose}>
            <style>{SAJU_CSS}</style>
            <div
                className="sj-sheet"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${guide.title} 소개`}
            >
                <button className="sj-close" onClick={onClose} aria-label="닫기">✕</button>

                <div className="sj-top">
                    {/* 좌 — 카피 + 기능 + CTA */}
                    <div>
                        <span className="sj-badge"><i />57년 내공</span>

                        <h2 className="sj-title sj-serif">{guide.title}</h2>
                        <div className="sj-rule" />

                        {/* 부제는 DB introText 그대로. 문구 창작 금지. */}
                        <p className="sj-desc">{guide.desc}</p>

                        {features.length > 0 && (
                            <div className="sj-chips">
                                {features.map(f => (
                                    <button key={f.key} className="sj-chip" onClick={() => onFeature(f.key)}>
                                        <MpnFeatureIcon kind={f.icon} size={18} color={T.goldLight} bg={T.inkDeep} />
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="sj-ctas">
                            <button className="sj-cta" onClick={() => onStart(guide.autoRunFeatureKey)}>
                                도결 선생과 대화하기
                            </button>
                            {features.length > 0 && (
                                <button
                                    className="sj-cta2"
                                    onClick={() => featsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                >
                                    무엇을 볼 수 있나
                                </button>
                            )}
                        </div>

                        {guide.usesBirthInfo && (
                            <p className="sj-note">
                                🏮 <b>명부</b>(이름·생년월일)를 적어두시면 더 정확하게 풀어드려요.
                            </p>
                        )}
                    </div>

                    {/* 우 — 히어로. 묶음 B에서 이 자리에 canvas 1개가 들어간다. */}
                    <div className="sj-hero">
                        <img src={SAJU_HERO_IMAGES.tiger} alt="" aria-hidden="true" />
                        <div className="sj-heroveil" aria-hidden="true" />
                    </div>
                </div>

                {/* 하단 — 기능 목록(가로 카드) */}
                {features.length > 0 && (
                    <div className="sj-feats" ref={featsRef}>
                        <div className="sj-featshead">
                            <h3 className="sj-featstitle sj-serif">도결 선생이 보아드리는 것</h3>
                            <p className="sj-featssub">보고 싶은 것을 고르시면 바로 풀어드립니다.</p>
                        </div>
                        <div className="sj-featgrid">
                            {features.map(f => (
                                <button key={f.key} className="sj-feat" onClick={() => onFeature(f.key)}>
                                    <span className="sj-featicon">
                                        <MpnFeatureIcon kind={f.icon} size={24} color={T.goldLight} bg={T.inkDeep} />
                                    </span>
                                    <span className="sj-featname">{f.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
