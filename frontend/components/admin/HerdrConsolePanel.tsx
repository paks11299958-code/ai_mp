import React, { useState } from 'react';
import { Icon } from '../Icons';
import { DevAiPanel } from './DevAiPanel';
import { HomepageMakerPanel } from './HomepageMakerPanel';

// 허드 AI 콘솔 — 흩어져 있던 "AI 에게 만들라고 시키는" 화면들을 한 곳으로 모은다.
//
// 왜(2026-08-27 사장 발안): 허드를 쓰려면 Claude Code 세션에서 파이썬 스크립트를 짜야 해서
// "사장 → Claude → 허드" 2단 구조였다. 사장이 직접 시작할 수 있게 한다.
//
// ★★**새 탭을 얹는 게 아니라 기존 것을 합치는 것**이다(사장 확인).
//   합치지 않으면 "어디서 개발을 시작하지?"가 세 곳이 된다.
//     · devai(개발AI 콘솔)      → 이 화면의 [개발] 탭
//     · homepage-maker(홈페이지 생성) → 이 화면의 [홈페이지] 탭
//   그대로 두는 것(목적이 다르다): homepage-reqs(회원 신청 운영) · shorts(업로드 승인) ·
//   codex-shorts(별도 파이프라인 — 2026-08-27 사장이 "그냥 둬"로 확정).
//
// ★기존 패널을 **감싸기만** 한다. DevAiPanel 은 1,025줄이라 안을 건드리면 위험하다 —
//   탭으로 골라 그대로 렌더한다. 기존 기능은 한 줄도 잃지 않는다.
//
// ★쇼츠와 영상을 **분리**했다(2026-08-27 사장 확정) — i2v(Wan 2.2)가 편당 250~566원이라
//   쇼츠와 비용 성격이 다르다. 한 탭에 두면 실수로 비싼 쪽을 돌린다.
//
// 정본 기획서: ai_mp/doc/features/herdr_admin_console.md

type HerdrTab = 'homepage' | 'shorts' | 'video' | 'dev';

const TABS: { key: HerdrTab; label: string; icon: string; desc: string }[] = [
    { key: 'homepage', label: '홈페이지', icon: 'Globe',    desc: '콘셉트 하나로 독립 사이트' },
    { key: 'shorts',   label: '쇼츠',     icon: 'Play',     desc: '세로 영상·자막·업로드' },
    // ★'Film' 은 Icons.tsx 에 등록돼 있지 않다 — 없는 이름을 주면 빈 자리가 된다(실측).
    { key: 'video',    label: '영상',     icon: 'Sparkles', desc: 'i2v — 편당 250~566원' },
    { key: 'dev',      label: '개발',     icon: 'Cpu',      desc: '명세를 주고 코드로' },
];

/** 아직 연결되지 않은 탭 — 무엇이 없는지 분명히 적는다(빈 화면만 두지 않는다). */
const NotReady: React.FC<{ title: string; note: string }> = ({ title, note }) => (
    <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto mt-10 rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
            <div className="flex items-center gap-2">
                <Icon name="Clock" size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300">
                    연결 전
                </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-400">{note}</p>
        </div>
    </div>
);

export const HerdrConsolePanel: React.FC = () => {
    const [tab, setTab] = useState<HerdrTab>('homepage');

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* 탭 줄 — 기존 어드민 톤을 그대로 쓴다(별도 CSS 없음) */}
            <div className="shrink-0 border-b border-gray-800 bg-gray-900/40 px-3 sm:px-4">
                <div className="flex gap-1 overflow-x-auto py-2">
                    {TABS.map(t => {
                        const on = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                title={t.desc}
                                className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition
                                    ${on ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                            >
                                <Icon name={t.icon} size={14} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 본문 — 기존 패널을 그대로 렌더한다(안을 고치지 않는다) */}
            {tab === 'homepage' && <HomepageMakerPanel />}
            {tab === 'dev' && <DevAiPanel />}
            {tab === 'shorts' && (
                <NotReady
                    title="쇼츠 만들기"
                    note={'쇼츠 제작은 아직 이 화면에 연결되지 않았습니다. '
                        + '지금은 콘텐츠 > 🎬 Codex 쇼츠 공장에서 진행합니다. '
                        + '(2026-08-27 사장 확정 — 기존 파이프라인은 그대로 두고, 이 탭은 2단계에서 연결)'}
                />
            )}
            {tab === 'video' && (
                <NotReady
                    title="영상 만들기 (i2v)"
                    note={'이미지 한 장을 움직이는 영상으로 만듭니다(Wan 2.2 TI2V-5B). '
                        + '★편당 250~566원으로 쇼츠보다 비싸 탭을 분리했습니다 — 실수로 비싼 쪽을 '
                        + '돌리지 않게 하기 위함입니다. 현재는 관리자 AI 스튜디오에서 실행합니다.'}
                />
            )}
        </div>
    );
};
