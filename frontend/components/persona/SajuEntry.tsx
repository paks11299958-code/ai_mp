import React, { useEffect, useRef, useState } from 'react';
import { MpnFeatureIcon } from '../MainPageNew';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';
import { SAJU_TONE, SAJU_HERO_IMAGES, SAJU_HERO_ASPECT, mountSajuHero, prefersReducedMotion } from './sajuHero';
import { usePersonaMenus, useSajuRunner, useSavedBirth, sheetMenuFor } from './useSajuRunner';

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
// ★히어로(묶음 B): 책 → 연기(상승) → 안개(가로 흐름) → 호랑이 를 Canvas 2D 한 장으로
//   그린다. 그리는 로직은 전부 sajuHero.ts에 있고 여기서는 canvas를 붙였다 떼기만 한다.
//   모션 감소 설정이면 **캔버스를 아예 만들지 않고** tiger.png를 정적으로 띄운다.

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
.sj-hero img,.sj-hero canvas{display:block;width:100%;height:auto;background:#0b0908;}
/* ★aspect-ratio가 없으면 canvas 기본 300×150이 잡혀 첫 프레임에 상자가 찌그러진다.
   width/height 속성은 JS가 dpr배로 채우므로 비율은 그대로 유지된다. */
.sj-hero canvas{aspect-ratio:${SAJU_HERO_ASPECT};}
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

/* ── 풀이 판 — 히어로 **같은 자리**를 덮는다. 창 밖으로 나가지 않는 것이 목적이다. ── */
.sj-panel{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;
  background:linear-gradient(165deg,rgba(13,11,10,.94) 0%,rgba(20,16,14,.97) 100%);
  backdrop-filter:blur(2px);animation:sjFade .22s ease;}
@keyframes sjFade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.sj-panel{animation:none}}

.sj-panelhead{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:16px 18px 12px;border-bottom:1px solid ${T.line};}
.sj-panelname{font-size:16px;font-weight:700;
  background:linear-gradient(100deg,${T.goldLight},${T.gold});
  -webkit-background-clip:text;background-clip:text;color:transparent;}
.sj-panelback{width:30px;height:30px;flex:none;border-radius:50%;cursor:pointer;
  border:1px solid ${T.line};background:transparent;color:${T.textSub};font-size:13px;line-height:1;}
.sj-panelback:hover{color:${T.goldLight};border-color:rgba(201,162,39,.45);}

/* ★스크롤은 판 안에서만. 결과가 길어도 창 전체가 밀리지 않는다. */
.sj-panelbody{flex:1;min-height:0;overflow-y:auto;padding:16px 18px;}

.sj-dialog{margin:0 0 14px;font-size:13.5px;line-height:1.8;color:${T.textSub};}
.sj-picks{display:grid;gap:8px;}
.sj-pick{display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:13px 15px;border-radius:12px;cursor:pointer;text-align:left;
  border:1px solid ${T.line};background:rgba(240,233,220,.045);
  color:${T.text};font-size:13.5px;font-weight:600;
  transition:border-color .15s ease,background .15s ease;}
.sj-pick:hover{border-color:rgba(201,162,39,.45);background:rgba(201,162,39,.10);}
.sj-pickhint{font-style:normal;font-size:11px;font-weight:500;color:${T.textSub};}

.sj-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:14px;height:100%;min-height:180px;}
.sj-loading p{margin:0;font-size:12.5px;color:${T.textSub};}
.sj-loading .sj-dot{width:7px;height:7px;border-radius:50%;background:${T.gold};display:inline-block;
  animation:sjPulse 1.1s ease-in-out infinite;}
.sj-loading .sj-dot:nth-child(2){animation-delay:.15s}
.sj-loading .sj-dot:nth-child(3){animation-delay:.3s}
@keyframes sjPulse{0%,100%{opacity:.25;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.sj-loading .sj-dot{animation:none;opacity:.7}}

/* 풀이 본문 — 줄바꿈을 그대로 살린다(도결 선생 말투가 문단으로 온다). */
.sj-result{font-size:14px;line-height:1.95;color:${T.text};white-space:pre-wrap;
  overflow-wrap:anywhere;}
.sj-err{margin:0;font-size:13px;line-height:1.8;color:#e8a49c;}

.sj-panelfoot{display:flex;gap:8px;padding:12px 18px 16px;border-top:1px solid ${T.line};}
.sj-panelfoot .sj-cta2{flex:1;padding:11px 14px;font-size:12.5px;}

@media (max-width:820px){
  .sj-sheet{padding-left:16px;padding-right:16px;}
  .sj-top{grid-template-columns:minmax(0,1fr);gap:26px;padding-top:44px;}
  .sj-hero{order:-1;border-radius:18px;}
  /* ★풀이가 열리면 히어로 비율(1216:832)만으로는 본문이 너무 좁다 —
     모바일에서만 판이 열렸을 때 높이를 벌린다(닫으면 원래 비율로 돌아온다). */
  .sj-hero:has(.sj-panel){min-height:66vh;}
  .sj-panelbody{padding:14px 15px;}
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
    const heroRef = useRef<HTMLCanvasElement | null>(null);

    // ★창 안에서 풀이까지 끝낸다 — 채팅으로 나가지 않는다(2026-08-27 사장 지시).
    //   퀵메뉴·명부는 DB 정본을 그대로 읽고, 실행도 채팅이 쓰던 같은 API 를 부른다.
    const { id: personaId, menus } = usePersonaMenus(guide.personaName || guide.title);
    const [birth] = useSavedBirth();
    const runner = useSajuRunner(personaId, birth);
    /** 기능 클릭 — 창 안에서 돌릴 수 있으면 여기서 풀고, 아니면 기존 채팅 경로로 넘긴다.
     *  ★해몽(텍스트)·관상/손금(사진)은 입력 UI 가 따로 필요해 아직 채팅으로 보낸다. */
    const handleFeature = (featureKey: string) => {
        const menu = sheetMenuFor(menus, featureKey);
        if (menu) runner.select(menu);
        else onFeature(featureKey);
    };
    /** 풀이 판이 히어로를 덮고 있는가 */
    const panelOpen = !!(runner.picking || runner.loading || runner.result || runner.error);

    // ★한 번만 판단해 렌더 내내 고정한다 — 렌더마다 matchMedia를 부르면 canvas가
    //   붙었다 떨어졌다 하며 연출이 처음부터 다시 재생될 수 있다.
    const [reduced] = useState(prefersReducedMotion);

    useEffect(() => {
        if (reduced) return;                 // 정적 대체 — 캔버스 자체가 없다
        const el = heroRef.current;
        if (!el) return;
        const hero = mountSajuHero(el);
        return () => hero.destroy();         // rAF·옵저버까지 전부 걷어낸다
    }, [reduced]);

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
                                    <button key={f.key} className="sj-chip" onClick={() => handleFeature(f.key)}>
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

                    {/* 우 — 히어로. 기능을 고르면 **같은 자리**가 풀이 판으로 바뀐다.
                        ★창 밖으로 나가지 않는 것이 이 화면의 목적이다(2026-08-27 사장 지시). */}
                    <div className="sj-hero">
                        {reduced
                            ? <img src={SAJU_HERO_IMAGES.tiger} alt="" aria-hidden="true" />
                            : <canvas ref={heroRef} aria-hidden="true" />}
                        <div className="sj-heroveil" aria-hidden="true" />

                        {panelOpen && (
                            <div className="sj-panel" role="region" aria-live="polite"
                                 aria-label={runner.picking?.label || runner.result?.title || '풀이'}>
                                <div className="sj-panelhead">
                                    <span className="sj-panelname sj-serif">
                                        {runner.result?.title || runner.picking?.label || '풀이 중'}
                                    </span>
                                    <button className="sj-panelback" onClick={runner.reset} aria-label="닫고 처음으로">
                                        ✕
                                    </button>
                                </div>

                                <div className="sj-panelbody">
                                    {/* ① 서브메뉴 — 무엇을 볼지 고른다 */}
                                    {runner.picking && (
                                        <>
                                            {runner.picking.subMenu?.dialog && (
                                                <p className="sj-dialog sj-serif">{runner.picking.subMenu.dialog}</p>
                                            )}
                                            <div className="sj-picks">
                                                {(runner.picking.subMenu?.items ?? []).map(it => (
                                                    <button key={it.label} className="sj-pick"
                                                        onClick={() => it.partnerModal
                                                            // 상대방 정보가 필요한 항목(인연 궁합)은 아직 채팅 경로다.
                                                            ? onFeature('yeonn')
                                                            : runner.pick(it.label, it.prompt)}>
                                                        {it.label}
                                                        {it.partnerModal && <em className="sj-pickhint">상대 정보 필요</em>}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {/* ② 실행 중 */}
                                    {runner.loading && (
                                        <div className="sj-loading">
                                            <span className="sj-dot" /><span className="sj-dot" /><span className="sj-dot" />
                                            <p>도결 선생이 명부를 살피는 중입니다…</p>
                                        </div>
                                    )}

                                    {/* ③ 결과 — 창 안에서 그대로 읽는다 */}
                                    {runner.result && (
                                        <div className="sj-result">{runner.result.body}</div>
                                    )}

                                    {/* ④ 오류 */}
                                    {runner.error && <p className="sj-err">{runner.error}</p>}
                                </div>

                                {(runner.result || runner.error) && (
                                    <div className="sj-panelfoot">
                                        <button className="sj-cta2" onClick={runner.reset}>다른 것도 보기</button>
                                        <button className="sj-cta2" onClick={() => onStart()}>도결 선생에게 더 묻기</button>
                                    </div>
                                )}
                            </div>
                        )}
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
                                <button key={f.key} className="sj-feat" onClick={() => handleFeature(f.key)}>
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
