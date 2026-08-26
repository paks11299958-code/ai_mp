import React, { useMemo, useState } from 'react';
import { Icon } from '../Icons';
import {
    EMPTY_HOMEPAGE_MAKER_BRIEF,
    buildHomepageMakerHandoff,
    isHomepageMakerBriefReady,
    type HomepageMakerBrief,
} from './homepageMakerBrief';

const STEPS = [
    ['1', '콘셉트 입력', '느낌·히어로·오브젝트'],
    ['2', '메이커 제작', '한 콘셉트로 완성'],
    ['3', '체커 검토', '화면·기능·반응형'],
    ['4', '미리보기 승인', '확인 전 배포 금지'],
    ['5', '독립 배포', '새 도메인 연결'],
] as const;

interface FieldProps {
    label: string;
    hint: string;
    value: string;
    required?: boolean;
    multiline?: boolean;
    onChange: (value: string) => void;
}

const BriefField: React.FC<FieldProps> = ({ label, hint, value, required, multiline, onChange }) => {
    const cls = 'w-full rounded-xl border border-gray-700 bg-gray-950/70 px-3.5 py-3 text-sm text-white placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
    return (
        <label className="block space-y-1.5">
            <span className="text-xs font-bold text-gray-200">{label}{required && <span className="text-blue-400"> *</span>}</span>
            {multiline ? (
                <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={hint} className={`${cls} resize-y`} />
            ) : (
                <input value={value} onChange={e => onChange(e.target.value)} placeholder={hint} className={cls} />
            )}
        </label>
    );
};

export const HomepageMakerPanel: React.FC = () => {
    const [brief, setBrief] = useState<HomepageMakerBrief>(EMPTY_HOMEPAGE_MAKER_BRIEF);
    const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
    const ready = isHomepageMakerBriefReady(brief);
    const handoff = useMemo(() => buildHomepageMakerHandoff(brief), [brief]);

    const set = (key: keyof HomepageMakerBrief) => (value: string) => {
        setBrief(prev => ({ ...prev, [key]: value }));
        setCopyState('idle');
    };

    const copyHandoff = async () => {
        try {
            await navigator.clipboard.writeText(handoff);
            setCopyState('done');
        } catch {
            setCopyState('failed');
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-5xl mx-auto space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2">
                            <Icon name="Sparkles" size={19} className="text-blue-400" />
                            <h2 className="text-lg font-bold text-white">홈페이지 생성</h2>
                            <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300">파이프라인 연결 전</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">강한 콘셉트 하나를 메이커가 만들고 체커가 검증하는 전용 생성 흐름입니다.</p>
                    </div>
                    <button type="button" onClick={() => setBrief(EMPTY_HOMEPAGE_MAKER_BRIEF)}
                        className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800">
                        입력 초기화
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    {STEPS.map(([number, title, desc], index) => (
                        <div key={number} className={`rounded-xl border p-3 ${index === 0 ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-800 bg-gray-900'}`}>
                            <div className="text-[10px] font-black text-blue-400">STEP {number}</div>
                            <div className="mt-1 text-xs font-bold text-white">{title}</div>
                            <div className="mt-1 text-[10px] leading-relaxed text-gray-500">{desc}</div>
                        </div>
                    ))}
                </div>

                <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
                    <section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5">
                        <div>
                            <h3 className="text-sm font-bold text-white">핵심 콘셉트</h3>
                            <p className="mt-1 text-xs text-gray-500">길게 쓰지 않아도 됩니다. aiworld도 이 다섯 가지에서 출발했습니다.</p>
                        </div>
                        <BriefField label="프로젝트 이름" required value={brief.projectName} onChange={set('projectName')} hint="예: aiworld, 병원 AI 상담" />
                        <BriefField label="원하는 홈페이지 느낌" required value={brief.brandMood} onChange={set('brandMood')} hint="예: 고급스럽고 절제된 미래형 기업 사이트" />
                        <BriefField label="히어로 화면 한 줄 설명" required multiline value={brief.heroSummary} onChange={set('heroSummary')} hint="첫 화면에서 무엇을 전달할지 간단히" />
                        <BriefField label="히어로의 핵심 오브젝트" required value={brief.heroObject} onChange={set('heroObject')} hint="예: 큐브, 빛나는 구체, 접히는 종이" />
                        <BriefField label="오브젝트 움직임과 콘텐츠 연결" required multiline value={brief.motionStory} onChange={set('motionStory')} hint="예: 큐브가 자동으로 펼쳐지며 서비스 메뉴가 된다" />
                    </section>

                    <div className="space-y-5">
                        <section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5">
                            <div>
                                <h3 className="text-sm font-bold text-white">내용과 배포</h3>
                                <p className="mt-1 text-xs text-gray-500">없는 사실은 AI가 지어내지 않습니다.</p>
                            </div>
                            <BriefField label="기존 내용 출처" value={brief.contentSource} onChange={set('contentSource')} hint="기존 사이트 URL 또는 sites/폴더 경로" />
                            <BriefField label="반드시 유지할 내용" multiline value={brief.mustKeep} onChange={set('mustKeep')} hint="서비스·가격·문구 등 바꾸면 안 되는 내용" />
                            <BriefField label="희망 독립 도메인" value={brief.desiredDomain} onChange={set('desiredDomain')} hint="예: brand.dbzone.kr — 최종 승인 후 연결" />
                        </section>

                        <section className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-white">오퍼스 인계 준비</h3>
                                    <p className="mt-1 text-xs text-gray-400">현재는 명세 복사까지만 동작하며 실제 제작은 시작하지 않습니다.</p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${ready ? 'bg-green-500/15 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
                                    {ready ? '입력 완료' : '필수 입력 필요'}
                                </span>
                            </div>
                            <button type="button" onClick={copyHandoff} disabled={!ready}
                                className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-35">
                                {copyState === 'done' ? '✓ 오퍼스용 명세 복사됨' : '오퍼스용 작업 명세 복사'}
                            </button>
                            {copyState === 'failed' && <p className="mt-2 text-xs text-red-300">복사 권한이 없어 실패했습니다. 브라우저 권한을 확인해 주세요.</p>}
                            <button type="button" disabled className="mt-2 w-full cursor-not-allowed rounded-xl border border-gray-700 px-4 py-3 text-sm font-bold text-gray-600">
                                메이커–체커 파이프라인 시작 · 다음 단계에서 연결
                            </button>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};
