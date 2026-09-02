import React from 'react';
import { Icon } from '../Icons';

const stages = [
    { key: 'REFERENCE', label: '1. 기준 이미지', status: '준비됨', desc: '정면 원본을 얼굴 정본으로 사용하고 좌우 측면은 검수에만 사용' },
    { key: 'IDLE', label: '2. 대기 동작', status: 'PoC 통과', desc: 'LivePortrait pose-only · motion multiplier 0.25' },
    { key: 'LIPSYNC', label: '3. 말하기', status: 'PoC 통과', desc: 'MuseTalk v1.5 · 한국어 4.9초 검수 완료' },
    { key: 'REVIEW', label: '4. 검수·배포', status: '개발 대기', desc: '정체성·시간축·립싱크 점수와 승인 이력 필요' },
] as const;

const pendingActions = [
    '프로젝트 생성·목록·상세 API',
    '기준 이미지 업로드와 reference pack 생성 작업',
    '서버3 작업 큐·기동·유휴 종료·비용 기록',
    'LivePortrait/MuseTalk 작업 실행과 진행률 폴링',
    '결과 A/B 검수, 승인, 사이트별 게시·롤백',
] as const;

export const AiAvatarPanel: React.FC = () => (
    <section className="flex-1 overflow-y-auto bg-gray-950 p-4 sm:p-6" aria-labelledby="ai-avatar-title">
        <div className="mx-auto max-w-6xl space-y-5">
            <header className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900 to-cyan-950/40 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Admin scaffold</p>
                        <h3 id="ai-avatar-title" className="text-2xl font-black text-white">AI 아바타</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                            사진 기반 2.5D 아바타의 기준 이미지 → 대기 동작 → 립싱크 → 검수·게시를 한곳에서 관리할 화면입니다.
                            현재는 서아 PoC와 다음 개발 계약을 보여주는 안전한 뼈대이며 GPU 작업은 실행하지 않습니다.
                        </p>
                    </div>
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">
                        백엔드 미연결
                    </span>
                </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="아바타 제작 단계">
                {stages.map((stage) => (
                    <article key={stage.key} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-white">{stage.label}</h4>
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-bold text-cyan-300">{stage.status}</span>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-400">{stage.desc}</p>
                    </article>
                ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5" aria-labelledby="seoa-poc-title">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h4 id="seoa-poc-title" className="font-bold text-white">서아 기준 프로젝트</h4>
                            <p className="mt-1 text-xs text-slate-400">현재 운영에 반영된 검증 자산</p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-300">PoC 통과</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <figure className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                            <video src="/seoa/avatar/idle.mp4" muted loop autoPlay playsInline className="aspect-square w-full object-cover object-[center_34%]" aria-label="서아 대기 동작 미리보기" />
                            <figcaption className="px-3 py-2 text-xs text-slate-300">IDLE · LivePortrait m0.25</figcaption>
                        </figure>
                        <figure className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                            <video src="/seoa/avatar/speaking-poc.mp4" muted loop autoPlay playsInline className="aspect-square w-full object-cover object-[center_34%]" aria-label="서아 말하기 동작 미리보기" />
                            <figcaption className="px-3 py-2 text-xs text-slate-300">SPEAKING · MuseTalk v1.5</figcaption>
                        </figure>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        {['새 프로젝트', '작업 실행', '사이트에 게시'].map((label) => (
                            <button key={label} type="button" disabled title="Claude 후속 개발에서 API 연결"
                                className="min-h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm font-bold text-slate-500 disabled:cursor-not-allowed">
                                {label}
                            </button>
                        ))}
                    </div>
                </section>

                <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5" aria-labelledby="avatar-next-title">
                    <h4 id="avatar-next-title" className="flex items-center gap-2 font-bold text-white">
                        <Icon name="Cpu" size={16} className="text-cyan-300" /> Claude 개발 큐
                    </h4>
                    <ol className="mt-4 space-y-3">
                        {pendingActions.map((item, index) => (
                            <li key={item} className="flex gap-3 text-sm leading-5 text-slate-300">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-xs font-black text-cyan-300">{index + 1}</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-5 rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs leading-5 text-rose-200">
                        서버3 직접 실행, 자동 게시, 외부 비용 호출은 각각 승인·권한·롤백 가드가 생기기 전까지 비활성 상태를 유지합니다.
                    </p>
                </aside>
            </div>
        </div>
    </section>
);
