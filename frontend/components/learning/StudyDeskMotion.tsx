import React, { useEffect, useId, useRef, useState } from 'react';
import type { TodayResponse } from './learningModel';
import './studyMotion.css';

/** Supplied study-desk <svg viewBox="0 0 360 240" role="img" aria-label="노트에 한 줄씩 쓰고 체크하며 진도를 채우는 공부 책상">
  <defs>
    <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#2b2a6e"/>
<stop offset="1" stopColor="#4c3f8f"/>
</linearGradient>
    <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#334e43"/>
<stop offset="1" stopColor="#4f6957"/>
</linearGradient>
    <radialGradient id={`${id}-cone`} cx=".5" cy="0" r="1">
<stop offset="0" stopColor="#ffe9b0" stopOpacity=".95"/>
<stop offset=".6" stopColor="#ffd27a" stopOpacity=".35"/>
<stop offset="1" stopColor="#ffd27a" stopOpacity="0"/>
</radialGradient>
    <linearGradient id={`${id}-desk`} x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#b07a52"/>
<stop offset="1" stopColor="#8a5a3a"/>
</linearGradient>
  </defs>


  <rect width="360" height="240" fill={`url(#${id}-wall)`}/>
  <rect x="200" y="18" width="92" height="76" rx="8" fill={`url(#${id}-sky)`} stroke="#84968b" strokeWidth="3"/>
  <line x1="246" y1="18" x2="246" y2="94" stroke="#84968b" strokeWidth="2"/>
  <circle cx="270" cy="40" r="9" fill="#fff4cf"/>
<circle cx="274" cy="37" r="8" fill="#2f2c72"/>
  <g fill="#fff">
    <circle className="star" cx="216" cy="34" r="1.6"/>
<circle className="star" cx="232" cy="62" r="1.3"/>
<circle className="star" cx="282" cy="72" r="1.5"/>
  </g>


  <circle cx="318" cy="52" r="20" fill="#fffdf7" stroke="#d8cfe8" strokeWidth="3"/>
  <line x1="318" y1="52" x2="318" y2="40" stroke="#2d2438" strokeWidth="2.2" strokeLinecap="round"/>
  <line className="minute" x1="318" y1="52" x2="318" y2="36" stroke="#2b5948" strokeWidth="1.6" strokeLinecap="round"/>
  <circle cx="318" cy="52" r="2" fill="#2d2438"/>


  <polygon className="glow" points="128,74 172,74 250,196 46,196" fill={`url(#${id}-cone)`}/>


  <rect x="0" y="190" width="360" height="50" fill={`url(#${id}-desk)`}/>
  <rect x="0" y="190" width="360" height="5" fill="#c99369"/>


  <rect x="88" y="182" width="40" height="8" rx="4" fill="#233b32"/>
  <line x1="108" y1="184" x2="96" y2="120" stroke="#233b32" strokeWidth="5" strokeLinecap="round"/>
  <line x1="96" y1="120" x2="140" y2="76" stroke="#233b32" strokeWidth="5" strokeLinecap="round"/>
  <path d="M126 62 L174 74 L168 84 L122 74 Z" fill="#2b5948"/>
  <ellipse cx="150" cy="80" rx="14" ry="3" fill="#ffe9b0"/>


  <path d="M150 196 L176 142 L250 142 L232 196 Z" fill="#fffdf7"/>
  <path d="M232 196 L250 142 L326 142 L304 196 Z" fill="#f6f1e6"/>
  <line x1="232" y1="196" x2="250" y2="142" stroke="#e3dccb" strokeWidth="1.5"/>

  <g fill="#2b5948">
    <circle className="dot" cx="262" cy="156" r="4" style={{ opacity: 1 }}/>
<circle className="dot" cx="276" cy="156" r="4" style={{ opacity: 1 }}/>
    <circle className="dot now" cx="290" cy="156" r="4"/>
<circle className="dot" cx="304" cy="156" r="4"/>
  </g>


  <g stroke="#214335" strokeWidth="2.4" strokeLinecap="round" fill="none">
    <path className="line l1" pathLength="1" d="M182 156 q8 -3 16 0 t16 0 t16 0 t8 0"/>
    <path className="line l2" pathLength="1" d="M178 168 q8 -3 16 0 t16 0 t16 0"/>
    <path className="line l3" pathLength="1" d="M174 180 q8 -3 16 0 t16 0 t4 0"/>
  </g>

  <g className="check">
<circle cx="236" cy="168" r="11" fill="#22c55e"/>
<path d="M230 168 l4 4 l8 -9" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
</g>


  <g className="pencil">
<g transform="translate(188 156) rotate(-35)">
    <rect x="0" y="-3" width="26" height="6" rx="1" fill="#ffb547"/>
<rect x="22" y="-3" width="5" height="6" fill="#f472b6"/>
    <path d="M0 -3 L-7 0 L0 3 Z" fill="#f5d6a8"/>
<path d="M-4.5 -1 L-7 0 L-4.5 1 Z" fill="#2d2438"/>
  </g>
</g>


  <path className="steam" d="M60 150 q-5 -8 0 -16 t0 -16" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".7"/>
  <path className="steam s2" d="M70 152 q-5 -8 0 -16 t0 -16" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
  <rect x="48" y="158" width="30" height="32" rx="6" fill="#fffdf7"/>
<path d="M78 166 q10 0 10 9 t-10 9" stroke="#fffdf7" strokeWidth="4" fill="none"/>
  <rect x="48" y="166" width="30" height="5" fill="#a5b4fc"/>


  <rect x="12" y="176" width="34" height="8" rx="2" fill="#2b5948"/>
<rect x="16" y="168" width="28" height="8" rx="2" fill="#f59e0b"/>
<rect x="10" y="184" width="38" height="7" rx="2" fill="#10b981"/>


  <rect x="84" y="210" width="190" height="8" rx="4" fill="rgba(255,255,255,.25)"/>
  <rect className="bar" x="84" y="210" width="190" height="8" rx="4" fill="#ffd27a"/>
</svg>: writing → check → progress, 9s. No external assets. */
export const StudyDeskMotion = ({ data = null }: { data?: TodayResponse | null }) => {
    const id = useId().replace(/:/g, '');
    const scene = useRef<HTMLDivElement>(null);
    const [paused, setPaused] = useState(false);
    const [offscreen, setOffscreen] = useState(false);
    const [hidden, setHidden] = useState(document.hidden);
    useEffect(() => {
        const visibility = () => setHidden(document.hidden);
        document.addEventListener('visibilitychange', visibility);
        const observer = typeof IntersectionObserver === 'undefined' ? null
            : new IntersectionObserver(entries => setOffscreen(!entries[0].isIntersecting));
        if (scene.current) observer?.observe(scene.current);
        return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); };
    }, []);
    const streak = Number.isFinite(data?.streak) && data!.streak > 0 ? `${data!.streak}일 연속 · ` : '';
    return (
        <figure className="lc-motion" data-paused={paused || offscreen || hidden}>
            <div className="lc-motion-scene" ref={scene}>
<svg viewBox="0 0 360 240" role="img" aria-label="노트에 한 줄씩 쓰고 체크하며 진도를 채우는 공부 책상">
  <defs>
    <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#2b2a6e"/>
<stop offset="1" stopColor="#4c3f8f"/>
</linearGradient>
    <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#334e43"/>
<stop offset="1" stopColor="#4f6957"/>
</linearGradient>
    <radialGradient id={`${id}-cone`} cx=".5" cy="0" r="1">
<stop offset="0" stopColor="#ffe9b0" stopOpacity=".95"/>
<stop offset=".6" stopColor="#ffd27a" stopOpacity=".35"/>
<stop offset="1" stopColor="#ffd27a" stopOpacity="0"/>
</radialGradient>
    <linearGradient id={`${id}-desk`} x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#b07a52"/>
<stop offset="1" stopColor="#8a5a3a"/>
</linearGradient>
  </defs>


  <rect width="360" height="240" fill={`url(#${id}-wall)`}/>
  <rect x="200" y="18" width="92" height="76" rx="8" fill={`url(#${id}-sky)`} stroke="#84968b" strokeWidth="3"/>
  <line x1="246" y1="18" x2="246" y2="94" stroke="#84968b" strokeWidth="2"/>
  <circle cx="270" cy="40" r="9" fill="#fff4cf"/>
<circle cx="274" cy="37" r="8" fill="#2f2c72"/>
  <g fill="#fff">
    <circle className="star" cx="216" cy="34" r="1.6"/>
<circle className="star" cx="232" cy="62" r="1.3"/>
<circle className="star" cx="282" cy="72" r="1.5"/>
  </g>


  <circle cx="318" cy="52" r="20" fill="#fffdf7" stroke="#d8cfe8" strokeWidth="3"/>
  <line x1="318" y1="52" x2="318" y2="40" stroke="#2d2438" strokeWidth="2.2" strokeLinecap="round"/>
  <line className="minute" x1="318" y1="52" x2="318" y2="36" stroke="#2b5948" strokeWidth="1.6" strokeLinecap="round"/>
  <circle cx="318" cy="52" r="2" fill="#2d2438"/>


  <polygon className="glow" points="128,74 172,74 250,196 46,196" fill={`url(#${id}-cone)`}/>


  <rect x="0" y="190" width="360" height="50" fill={`url(#${id}-desk)`}/>
  <rect x="0" y="190" width="360" height="5" fill="#c99369"/>


  <rect x="88" y="182" width="40" height="8" rx="4" fill="#233b32"/>
  <line x1="108" y1="184" x2="96" y2="120" stroke="#233b32" strokeWidth="5" strokeLinecap="round"/>
  <line x1="96" y1="120" x2="140" y2="76" stroke="#233b32" strokeWidth="5" strokeLinecap="round"/>
  <path d="M126 62 L174 74 L168 84 L122 74 Z" fill="#2b5948"/>
  <ellipse cx="150" cy="80" rx="14" ry="3" fill="#ffe9b0"/>


  <path d="M150 196 L176 142 L250 142 L232 196 Z" fill="#fffdf7"/>
  <path d="M232 196 L250 142 L326 142 L304 196 Z" fill="#f6f1e6"/>
  <line x1="232" y1="196" x2="250" y2="142" stroke="#e3dccb" strokeWidth="1.5"/>

  <g fill="#2b5948">
    <circle className="dot" cx="262" cy="156" r="4" style={{ opacity: 1 }}/>
<circle className="dot" cx="276" cy="156" r="4" style={{ opacity: 1 }}/>
    <circle className="dot now" cx="290" cy="156" r="4"/>
<circle className="dot" cx="304" cy="156" r="4"/>
  </g>


  <g stroke="#214335" strokeWidth="2.4" strokeLinecap="round" fill="none">
    <path className="line l1" pathLength="1" d="M182 156 q8 -3 16 0 t16 0 t16 0 t8 0"/>
    <path className="line l2" pathLength="1" d="M178 168 q8 -3 16 0 t16 0 t16 0"/>
    <path className="line l3" pathLength="1" d="M174 180 q8 -3 16 0 t16 0 t4 0"/>
  </g>

  <g className="check">
<circle cx="236" cy="168" r="11" fill="#22c55e"/>
<path d="M230 168 l4 4 l8 -9" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
</g>


  <g className="pencil">
<g transform="translate(188 156) rotate(-35)">
    <rect x="0" y="-3" width="26" height="6" rx="1" fill="#ffb547"/>
<rect x="22" y="-3" width="5" height="6" fill="#f472b6"/>
    <path d="M0 -3 L-7 0 L0 3 Z" fill="#f5d6a8"/>
<path d="M-4.5 -1 L-7 0 L-4.5 1 Z" fill="#2d2438"/>
  </g>
</g>


  <path className="steam" d="M60 150 q-5 -8 0 -16 t0 -16" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".7"/>
  <path className="steam s2" d="M70 152 q-5 -8 0 -16 t0 -16" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
  <rect x="48" y="158" width="30" height="32" rx="6" fill="#fffdf7"/>
<path d="M78 166 q10 0 10 9 t-10 9" stroke="#fffdf7" strokeWidth="4" fill="none"/>
  <rect x="48" y="166" width="30" height="5" fill="#a5b4fc"/>


  <rect x="12" y="176" width="34" height="8" rx="2" fill="#2b5948"/>
<rect x="16" y="168" width="28" height="8" rx="2" fill="#f59e0b"/>
<rect x="10" y="184" width="38" height="7" rx="2" fill="#10b981"/>


  <rect x="84" y="210" width="190" height="8" rx="4" fill="rgba(255,255,255,.25)"/>
  <rect className="bar" x="84" y="210" width="190" height="8" rx="4" fill="#ffd27a"/>
</svg>
            </div>
            <figcaption><strong>오늘도 한 줄씩, 같이 해요</strong>
                <span>{data?.goal ? `${streak}${data.todayTask ? '오늘의 과제 배정' : '내 속도로 배워요'}` : '목표부터, 차근차근 시작해요'}</span>
            </figcaption>
            <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
                {paused ? '모션 재생' : '모션 정지'}
            </button>
        </figure>
    );
};
