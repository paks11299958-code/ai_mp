import React, { useEffect, useMemo, useState } from 'react';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';

// 🔮 유나 별자리 타로 — 진입 랜딩 (2026-09-09 사장 지시, 여섯 번째)
//
// ★왜 이 화면인가: 유나는 담당 기능이 둘(타로점·오늘의 카드)뿐인데 들어가면 채팅창부터
//   떠서 "별자리를 읽는 타로술사"라는 정체가 안 보였다. 도결·서아·윤채린·이아린·윤채원과
//   **똑같은 규약**(PersonaEntrySheet의 guide.title 접두사 분기 한 줄, App.tsx 무수정)이다.
//
// ★★과금 함정 — 타로는 **모달이 아니라 채팅 대화**다.
//   카드를 다 뽑으면 handleSendMessage()로 유나에게 메시지를 보내고 답이 **채팅창에** 뜬다
//   (App.tsx tarotAutoSendRef). 그래서 과금이 메시지당이고 MenuLimit 등록이 없다.
//   → 랜딩에서 activate 를 흉내내면 **이중과금**이 된다(도결에서 실제로 터졌다).
//   → 여기서는 실행을 흉내내지 않고 `onStart('tarot')` 로 **기존 경로에 넘기기만** 한다.
//     onStart 는 goTo('chat') 후 FEATURE_ACTIONS 를 부르므로 검증된 흐름이 그대로 산다.
//
// ★★onFeature('tarot') 를 쓰면 **아무 일도 안 일어난다**.
//   타로 모달은 App.tsx 의 chat return 안에서만 렌더되는데(2236줄, 1724줄 main 얼리리턴 뒤)
//   랜딩은 main 에서 열리기 때문이다. 보드형 기능(윤채린·아린)과 성격이 다르다.
//   → 타로 두 기능은 **반드시 onStart(key)** 로 부른다.
//
// 연출(사장님 지시): 비스듬한 타원 궤도를 도는 태양계 → 카드 3장이 날아와 하나씩 열림
//   → 열린 카드가 **옆으로 돌며** 그 자리의 리딩이 한 마디씩 이어 붙는다.
//   이미지 0장 — 별·궤도·카드·연기 전부 CSS/SVG(아린 랜딩과 같은 원칙).

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    onInvite: () => void;
}

/** 히어로에 띄우는 3장. 기존 타로 모달(TarotCardModal)의 메이저 아르카나에서 골랐다 —
 *  랜딩과 실제 카드가 다르면 "본 것과 다른 게 나온다"가 된다. */
const HERO_CARDS = [
    { no: 'XVII', kr: '별', sym: '⭐', say: '꺼지지 않던 바람이 있었고' },
    { no: 'XVIII', kr: '달', sym: '🌕', say: '지금은 안개 속이지만' },
    { no: 'XIX', kr: '태양', sym: '☀️', say: '끝내 환하게 드러날 거야' },
];
const POSITIONS = ['과거', '현재', '미래'];

/** 행성 — 반지름·주기·크기·색·시작위치가 전부 다르다(사장님 "공전 속도도 위치도 서로 틀리게"). */
const PLANETS = [
    { r: 34, t: 6, s: 5, c: '#9fb6e8', g: 'rgba(159,182,232,.8)', d: -1.2 },
    { r: 52, t: 9.5, s: 7, c: '#e8b98f', g: 'rgba(232,185,143,.75)', d: -4 },
    { r: 72, t: 14, s: 5.5, c: '#c9a0e8', g: 'rgba(201,160,232,.7)', d: -2.5 },
    { r: 95, t: 21, s: 8.5, c: '#e2c79f', g: 'rgba(226,199,159,.7)', d: -9 },
    { r: 118, t: 30, s: 4.5, c: '#8fd3d0', g: 'rgba(143,211,208,.65)', d: -15 },
];

const CSS = `
.yt-root{position:fixed;inset:0;z-index:85;overflow-y:auto;overflow-x:hidden;
  background:#0b0714;color:#f3ecff;
  font-family:'Pretendard',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.yt-wrap{max-width:520px;margin:0 auto;min-height:100%;
  background:linear-gradient(180deg,#0b0714,#140d24);padding-bottom:30px}

.yt-hd{display:flex;align-items:center;gap:10px;padding:16px 18px 10px}
.yt-logo{width:34px;height:34px;border-radius:9px;background:#33235c;
  display:flex;align-items:center;justify-content:center;font-size:16px}
.yt-t{font-size:15px;font-weight:800;letter-spacing:-.01em}
.yt-r{font-size:10.5px;font-weight:600;color:#c2b0e0;margin-left:5px}
.yt-s{font-size:11px;color:#c2b0e0}
.yt-x{margin-left:auto;width:32px;height:32px;border-radius:50%;cursor:pointer;
  border:1px solid #4a3a72;background:transparent;color:#c2b0e0;font-size:14px}

/* ── 히어로 ───────────────────────────────────────────────────────── */
.yt-hero{position:relative;height:414px;overflow:hidden;margin:0 14px;border-radius:16px;
  border:1px solid #4a3a72;
  background:radial-gradient(120% 80% at 50% 12%,#2a1b4a 0%,#170f2c 45%,#0b0714 100%)}

.yt-stars{position:absolute;inset:0}
.yt-stars i{position:absolute;background:#fff;border-radius:50%;
  animation:yt-tw var(--d) ease-in-out infinite var(--dl)}
@keyframes yt-tw{0%,100%{opacity:var(--o)}50%{opacity:calc(var(--o)*.25)}}

/* 태양계 — rotateX 로 눕히고 rotateZ 로 기울여 '비스듬한 타원'을 만든다. */
.yt-solar{position:absolute;left:50%;top:126px;width:0;height:0;
  transform:translateX(-50%) rotateX(64deg) rotateZ(-12deg);transform-style:preserve-3d}
.yt-orbit{position:absolute;left:50%;top:50%;border:1px solid rgba(226,199,159,.16);
  border-radius:50%;transform:translate(-50%,-50%)}
.yt-spin{position:absolute;left:50%;top:50%;width:0;height:0;
  animation:yt-orbit var(--t) linear infinite;animation-delay:var(--od)}
@keyframes yt-orbit{to{transform:rotate(360deg)}}
/* ★궤도가 누워 있으므로 행성만 다시 세운다 — 안 그러면 타원으로 찌그러진다. */
.yt-planet{position:absolute;border-radius:50%;
  transform:translate(-50%,-50%) rotateZ(12deg) rotateX(-64deg);box-shadow:0 0 12px var(--g)}
.yt-sun{position:absolute;left:50%;top:50%;width:26px;height:26px;border-radius:50%;
  transform:translate(-50%,-50%) rotateZ(12deg) rotateX(-64deg);
  background:radial-gradient(circle at 38% 34%,#fff6dc,#f0b23c 55%,#c9821f);
  animation:yt-pulse 4.2s ease-in-out infinite}
@keyframes yt-pulse{0%,100%{box-shadow:0 0 26px rgba(240,178,60,.75),0 0 60px rgba(240,178,60,.35)}
                    50%{box-shadow:0 0 34px rgba(240,178,60,.95),0 0 78px rgba(240,178,60,.5)}}

/* 카드 3장 */
.yt-cards{position:absolute;left:0;right:0;bottom:52px;display:flex;
  justify-content:center;gap:22px;perspective:900px;z-index:2}
.yt-slot{width:78px;height:118px;position:relative;transform-style:preserve-3d;
  animation:yt-fly .9s cubic-bezier(.2,.9,.3,1.2) backwards, yt-flip 1.5s ease-in-out forwards}
@keyframes yt-fly{from{opacity:0;transform:translateY(-190px) rotate(var(--rz)) scale(.5)}
                  to{opacity:1;transform:translateY(0) rotate(0) scale(1)}}
/* ★뒤집힌 뒤 **옆으로 더 돌아** 비스듬히 선다 — 카드를 내밀어 보여주는 몸짓.
   180 을 지나 228 까지 돌았다가 212 로 되돌아온다(정면이면 돈 게 안 보인다). */
@keyframes yt-flip{
  0%{transform:rotateY(0) translateZ(0)}
  42%{transform:rotateY(180deg) translateZ(0)}
  70%{transform:rotateY(228deg) translateZ(34px) scale(1.06)}
  100%{transform:rotateY(212deg) translateZ(22px) scale(1.04)}}
.yt-face{position:absolute;inset:0;border-radius:9px;backface-visibility:hidden;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.yt-back{background:linear-gradient(160deg,#3b2a63,#241943);border:1px solid rgba(226,199,159,.45);
  box-shadow:0 6px 18px rgba(0,0,0,.5),inset 0 0 22px rgba(140,110,200,.35)}
.yt-back::after{content:'✦';color:rgba(226,199,159,.65);font-size:24px}
/* 앞면 — 기존 타로 모달과 **같은 양피지 색**(#f7edd8) */
.yt-front{transform:rotateY(180deg);background:linear-gradient(165deg,#f7edd8,#efe0c3);
  border:1px solid #c9a678;box-shadow:0 6px 20px rgba(0,0,0,.55)}
.yt-sym{font-size:26px;line-height:1}
.yt-no{font-size:9px;letter-spacing:.14em;color:#8a6f3f;font-weight:800}
.yt-kr{font-size:11.5px;font-weight:800;color:#2D2438}
/* ★라벨은 슬롯이 rotateY 로 뒤집힐 때 함께 뒤집혀 거울상이 된다 → 한 번 더 뒤집어 되돌린다. */
.yt-pos{position:absolute;top:-54px;left:0;right:0;text-align:center;
  font-size:10px;letter-spacing:.1em;color:#e2c79f;font-weight:700;opacity:0;
  transform:rotateY(180deg);animation:yt-in .5s ease forwards}
@keyframes yt-in{to{opacity:1}}

/* ★리딩을 카드 위에 한 줄씩 넣으면 카드 폭(78px)을 넘겨 옆 카드와 겹쳐 잘린다.
   3장 스프레드는 어차피 '이어 읽는' 것이라 **아래 한 문장**으로 모았다. */
.yt-read{position:absolute;left:16px;right:16px;bottom:8px;text-align:center;
  font-size:11.5px;line-height:1.55;color:#f3e4c6;font-weight:600;z-index:3;
  text-shadow:0 1px 8px rgba(0,0,0,.95);min-height:34px}
.yt-read span{display:inline-block;opacity:0;animation:yt-say .55s ease forwards}
@keyframes yt-say{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
.yt-cap{position:absolute;left:0;right:0;top:14px;text-align:center;
  font-size:11px;letter-spacing:.22em;color:#e2c79f;opacity:.9;z-index:2}

/* 애니메이션을 원치 않는 사용자에겐 결과 상태만 보여준다. */
@media (prefers-reduced-motion:reduce){
  .yt-stars i,.yt-spin,.yt-sun{animation:none}
  .yt-slot{animation:none;transform:rotateY(196deg)}
  .yt-pos,.yt-read span{animation:none;opacity:1}
}

/* ── 본문 ────────────────────────────────────────────────────────── */
.yt-sec{padding:20px 18px 0}
.yt-sh{display:flex;align-items:baseline;gap:8px;margin-bottom:10px}
.yt-st{font-size:15px;font-weight:800}
.yt-sm{font-size:10px;letter-spacing:.12em;color:#e2c79f;margin-left:auto}
.yt-menu{padding:14px 14px 0;display:flex;flex-direction:column;gap:8px}
.yt-mi{display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;
  padding:13px 14px;border-radius:12px;border:1px solid #4a3a72;background:#241a3d;
  color:inherit;font:inherit;transition:border-color .15s ease,transform .12s ease}
.yt-mi:hover{border-color:#7c63b8;transform:translateY(-1px)}
.yt-mi:active{transform:scale(.99)}
.yt-mic{flex:0 0 34px;height:34px;border-radius:9px;background:#33235c;
  display:flex;align-items:center;justify-content:center;font-size:15px}
.yt-mt{font-size:14px;font-weight:700}
.yt-md{font-size:11.5px;color:#c2b0e0;margin-top:2px}
.yt-mg{margin-left:auto;color:#c2b0e0;font-size:13px}

.yt-steps{margin:0 14px;padding:14px;border-radius:12px;background:#1a1230;border:1px solid #3a2c5e}
.yt-step{display:flex;gap:10px;padding:7px 0;font-size:12px;line-height:1.5;color:#d6c9ee}
.yt-sn{flex:0 0 19px;height:19px;border-radius:50%;background:#33235c;color:#e2c79f;
  font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center}
.yt-note{margin:14px 14px 0;padding:11px 13px;border-radius:11px;
  background:#160f28;border:1px solid #3a2c5e;font-size:11px;line-height:1.6;color:#bcaad9}
.yt-note b{color:#f3e4c6}
.yt-cta{margin:16px 14px 0;padding:15px;border-radius:12px;border:0;cursor:pointer;
  width:calc(100% - 28px);font:inherit;font-size:14.5px;font-weight:700;color:#241943;
  background:linear-gradient(135deg,#e2c79f,#c9a678)}
.yt-cta2{margin:9px 14px 0;padding:12px;border-radius:12px;cursor:pointer;
  width:calc(100% - 28px);font:inherit;font-size:13px;font-weight:600;
  border:1px solid #4a3a72;background:transparent;color:#c2b0e0}
`;

// ★Props 계약은 다섯 랜딩과 동일하게 유지하되(호출부가 같은 걸 넘긴다),
//   이 화면은 onFeature·onInvite 를 쓰지 않는다 — 위 주석의 이유로 실행은 전부 onStart 다.
export const YunaTarotEntry: React.FC<Props> = ({ guide, onClose, onStart }) => {
    // 히어로를 다시 보고 싶을 때 키만 바꿔 애니메이션을 처음부터 돌린다.
    const [runKey, setRunKey] = useState(0);

    // 별밭은 매 렌더 새로 뽑히면 깜빡이므로 한 번만 만든다.
    const stars = useMemo(
        () => Array.from({ length: 70 }, () => ({
            left: +(Math.random() * 100).toFixed(1),
            top: +(Math.random() * 72).toFixed(1),
            size: Math.random() < 0.8 ? 1 : 2,
            o: +(0.25 + Math.random() * 0.6).toFixed(2),
            d: +(2 + Math.random() * 3).toFixed(1),
            dl: +(Math.random() * 3).toFixed(1),
        })),
        [],
    );

    // Esc로 닫기 — 전체를 덮는 화면이라 출구가 하나뿐이면 갇힌 느낌이 든다.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        // 배경 클릭 = 닫기. 시트가 폭을 채우므로 넓은 화면의 양옆이 배경이 된다.
        <div className="yt-root" onClick={onClose}>
            <style>{CSS}</style>
            <div className="yt-wrap" onClick={e => e.stopPropagation()}
                 role="dialog" aria-modal="true" aria-label={`${guide.title} 별자리 타로`}>

                <div className="yt-hd">
                    <div className="yt-logo">🔮</div>
                    <div>
                        <div className="yt-t">유나<span className="yt-r">별자리 타로술사</span></div>
                        <div className="yt-s">별의 자리가 오늘의 카드를 고릅니다</div>
                    </div>
                    <button className="yt-x" onClick={onClose} aria-label="닫기">✕</button>
                </div>

                {/* 히어로 — 태양계가 돌고, 카드 3장이 날아와 하나씩 열리며 옆으로 돈다. */}
                <div className="yt-hero" key={runKey} onClick={() => setRunKey(k => k + 1)}
                     role="img"
                     aria-label="별자리 타로 연출: 태양계가 공전하고 과거·현재·미래 카드 세 장이 차례로 열린다">
                    <div className="yt-stars">
                        {stars.map((s, i) => (
                            <i key={i} style={{
                                left: `${s.left}%`, top: `${s.top}%`,
                                width: s.size, height: s.size,
                                ['--o' as any]: s.o, ['--d' as any]: `${s.d}s`, ['--dl' as any]: `${s.dl}s`,
                            }} />
                        ))}
                    </div>
                    <div className="yt-cap">✦ 별 자 리 타 로 ✦</div>

                    <div className="yt-solar">
                        <div className="yt-sun" />
                        {PLANETS.map((p, i) => (
                            <React.Fragment key={i}>
                                <div className="yt-orbit" style={{ width: p.r * 2, height: p.r * 2 }} />
                                <div className="yt-spin"
                                     style={{ ['--t' as any]: `${p.t}s`, ['--od' as any]: `${p.d}s` }}>
                                    <div className="yt-planet" style={{
                                        left: p.r, top: 0, width: p.s, height: p.s,
                                        background: p.c, ['--g' as any]: p.g,
                                    }} />
                                </div>
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="yt-cards">
                        {HERO_CARDS.map((c, i) => {
                            const fly = 0.25 + i * 0.42, flip = 1.7 + i * 0.95;
                            return (
                                <div key={c.no} className="yt-slot"
                                     style={{ ['--rz' as any]: `${(i - 1) * 18}deg`,
                                              animationDelay: `${fly}s,${flip}s` }}>
                                    <div className="yt-pos" style={{ animationDelay: `${flip + 0.5}s` }}>
                                        {POSITIONS[i]}
                                    </div>
                                    <div className="yt-face yt-back" />
                                    <div className="yt-face yt-front">
                                        <div className="yt-no">{c.no}</div>
                                        <div className="yt-sym">{c.sym}</div>
                                        <div className="yt-kr">{c.kr}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 카드가 옆으로 도는 순간(flip+0.8s) 그 카드의 한 마디가 이어 붙는다. */}
                    <div className="yt-read">
                        {HERO_CARDS.map((c, i) => (
                            <span key={c.no} style={{ animationDelay: `${(1.7 + i * 0.95 + 0.8).toFixed(2)}s` }}>
                                {c.say}{i < 2 ? ' · ' : ''}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="yt-sec">
                    <div className="yt-sh">
                        <div className="yt-st">어떻게 보나요</div>
                        <div className="yt-sm">HOW IT WORKS</div>
                    </div>
                </div>
                <div className="yt-steps">
                    <div className="yt-step"><span className="yt-sn">1</span>
                        <span>묻고 싶은 것을 마음에 담고 카드를 섞습니다.</span></div>
                    <div className="yt-step"><span className="yt-sn">2</span>
                        <span>끌리는 카드를 <b>과거 · 현재 · 미래</b> 세 자리에 한 장씩 놓습니다.</span></div>
                    <div className="yt-step"><span className="yt-sn">3</span>
                        <span>유나가 세 장을 <b>따로가 아니라 하나의 흐름</b>으로 읽어 드립니다.</span></div>
                </div>

                <div className="yt-menu">
                    {/* ★★반드시 onStart — onFeature 로 부르면 모달이 main 에 없어 아무 일도 안 난다.
                        onStart 가 goTo('chat') 후 기존 핸들러를 부르므로 과금·결과 표시가 검증된 경로로 돈다. */}
                    <button className="yt-mi" onClick={() => onStart('tarot')}>
                        <span className="yt-mic">🔮</span>
                        <span>
                            <span className="yt-mt">타로점 보기</span>
                            <span className="yt-md" style={{ display: 'block' }}>
                                과거·현재·미래 세 장으로 흐름을 읽습니다
                            </span>
                        </span>
                        <span className="yt-mg">›</span>
                    </button>
                    <button className="yt-mi" onClick={() => onStart('tarot-daily')}>
                        <span className="yt-mic">🌙</span>
                        <span>
                            <span className="yt-mt">오늘의 카드</span>
                            <span className="yt-md" style={{ display: 'block' }}>
                                딱 한 장 — 오늘 하루의 조언
                            </span>
                        </span>
                        <span className="yt-mg">›</span>
                    </button>
                </div>

                <div className="yt-note">
                    카드는 <b>정해진 운명</b>이 아니라 <b>지금의 흐름</b>을 비춥니다.
                    미래 자리의 카드는 “이대로 가면 닿는 곳”이라, 무엇을 바꾸면 달라지는지까지
                    함께 읽어 드립니다.
                </div>

                <button className="yt-cta" onClick={() => onStart('tarot')}>🔮 카드 뽑으러 가기</button>
                <button className="yt-cta2" onClick={() => onStart()}>유나와 그냥 대화하기</button>
            </div>
        </div>
    );
};
