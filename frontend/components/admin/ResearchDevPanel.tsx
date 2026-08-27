import React, { useMemo, useState } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';
import {
    EMPTY_RESEARCH_DEV_BRIEF,
    RESEARCH_WORK_TYPES,
    buildResearchDevHandoff,
    getResearchDevPolicy,
    isResearchDevBriefReady,
    type ResearchDevBrief,
    type ResearchWorkType,
} from './researchDevBrief';

const STEPS = ['유형·요구사항', '리서치', '명세·컨셉', '텔레그램 승인', 'Codex 개발', '검증·검토', '배포·URL'] as const;
const inputCls = 'w-full rounded-xl border border-gray-700 bg-gray-950/70 px-3.5 py-3 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20';

type FieldDef = { key: keyof ResearchDevBrief; label: string; hint: string; required?: boolean; multiline?: boolean };
const COMMON_FIELDS: FieldDef[] = [
    { key: 'title', label: '작업 제목', hint: '예: 결제 실패 알림 화면', required: true },
    { key: 'target', label: '대상 저장소·화면', hint: '예: ai_mp 관리자 > 운영', required: true },
    { key: 'forbiddenFiles', label: '수정 금지 파일·경로', hint: '쉼표로 구분' },
    { key: 'constraints', label: '추가 제약조건', hint: '꼭 지킬 것 / 하지 말 것', multiline: true },
];
const TYPE_FIELD_DEFS: Record<ResearchWorkType, FieldDef[]> = {
    simple: [
        { key: 'changeTarget', label: '변경할 문구·관리 화면', hint: '현재 위치와 바꿀 내용', required: true, multiline: true },
        { key: 'desiredResult', label: '원하는 결과', hint: '완료 후 화면의 모습', required: true, multiline: true },
    ],
    feature: [
        { key: 'featurePurpose', label: '기능 목적', hint: '왜 필요한 기능인가', required: true, multiline: true },
        { key: 'userFlow', label: '사용자 동작', hint: '진입부터 완료까지', required: true, multiline: true },
        { key: 'inputsOutputs', label: '입력과 출력', hint: '받는 값과 보여줄 결과', required: true, multiline: true },
        { key: 'completionCriteria', label: '완료 조건', hint: '테스트·화면·동작 기준', required: true, multiline: true },
    ],
    risk: [
        { key: 'featurePurpose', label: '기능 목적', hint: '왜 필요한 기능인가', required: true, multiline: true },
        { key: 'userFlow', label: '사용자 동작', hint: '진입부터 완료까지', required: true, multiline: true },
        { key: 'riskAreas', label: '위험 영역', hint: 'API·DB·과금·권한·배포', required: true },
        { key: 'dataImpact', label: '기존 데이터 영향', hint: '읽기·쓰기·이관 범위', required: true, multiline: true },
        { key: 'recoveryPlan', label: '실패 시 복구 방법', hint: '롤백과 재처리 방법', required: true, multiline: true },
        { key: 'securityRules', label: '보안·권한 조건', hint: '인증·인가·민감정보 경계', required: true, multiline: true },
        { key: 'testEnvironment', label: '테스트 환경', hint: '기본: 서버2', required: true },
        { key: 'productionChange', label: '운영 반영 여부', hint: '승인과 배포 경계', required: true },
        { key: 'completionCriteria', label: '완료 조건', hint: '안전 테스트와 검증 기준', required: true, multiline: true },
    ],
    homepage: [
        { key: 'sitePurpose', label: '사이트 목적', hint: '소개·판매·상담 등', required: true },
        { key: 'audience', label: '대상 고객', hint: '가장 중요한 방문자', required: true },
        { key: 'desiredMood', label: '원하는 분위기', hint: '예: 절제된 프리미엄', required: true },
        { key: 'avoidMood', label: '피해야 할 분위기', hint: '예: 흔한 SaaS 템플릿', required: true },
        { key: 'keyMessage', label: '핵심 메시지', hint: '첫 화면에서 남길 한 문장', required: true, multiline: true },
        { key: 'visualSystem', label: '색상·폰트·여백', hint: '디자인 시스템 방향', required: true, multiline: true },
        { key: 'sections', label: '섹션과 순서', hint: '히어로 → 서비스 → CTA', required: true, multiline: true },
        { key: 'references', label: '참고 사이트', hint: 'URL과 참고할 점' },
        { key: 'mediaDirection', label: '이미지·영상·애니메이션', hint: '사용할 자산과 연출', multiline: true },
        { key: 'mobileDirection', label: '모바일 연출 기준', hint: '유지·축소·제거할 모션', required: true, multiline: true },
        { key: 'contentSource', label: '기존 콘텐츠 출처', hint: '기존 URL 또는 경로' },
        { key: 'desiredDomain', label: '희망 도메인', hint: '승인 후 연결' },
        { key: 'completionCriteria', label: '390·820·1440 완료 조건', hint: '잘림·가로 스크롤·콘솔 오류 등', required: true, multiline: true },
    ],
};

const Field: React.FC<{ def: FieldDef; value: string; onChange: (value: string) => void }> = ({ def, value, onChange }) => (
    <label className="block space-y-1.5">
        <span className="text-xs font-bold text-gray-200">{def.label}{def.required && <span className="text-cyan-400"> *</span>}</span>
        {def.multiline
            ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={def.hint} className={`${inputCls} resize-y`} />
            : <input value={value} onChange={e => onChange(e.target.value)} placeholder={def.hint} className={inputCls} />}
    </label>
);

export const ResearchDevPanel: React.FC = () => {
    const [brief, setBrief] = useState<ResearchDevBrief>(EMPTY_RESEARCH_DEV_BRIEF);
    const [prepared, setPrepared] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState<{id:string; signature:string}|null>(null);
    const policy = getResearchDevPolicy(brief.workType);
    const ready = isResearchDevBriefReady(brief);
    const handoff = useMemo(() => buildResearchDevHandoff(brief), [brief]);
    const signature = `${handoff}\n${brief.workType}`;
    const dirty = saved?.signature !== signature;
    const set = (key: keyof ResearchDevBrief, value: string) => { setBrief(v => ({ ...v, [key]: value })); setPrepared(false); setMessage(''); setError(''); };
    const selectType = (workType: ResearchWorkType) => { setBrief(v => ({ ...v, workType })); setPrepared(false); setMessage(''); };
    const prepare = async () => {
        if (!ready) return;
        try {
            setBusy(true); setError('');
            const body = {title:`[리서치 개발] ${brief.title.trim()}`, features:brief.target.trim(), specBody:handoff,
                refUrls:brief.references || '', note:'허드 AI 리서치 개발 탭에서 저장',
                brief:JSON.stringify({hermesV2:true, workType:brief.workType}),
                useReview:policy.useClaudeReview, workdir:'/home/paks11299958/ai_mp'};
            const d = await adminApi.createDevProject(body);
            setSaved({id:d.project.id, signature}); setPrepared(true);
            setMessage('명세를 저장했습니다. 내용을 확인한 뒤 개발을 시작하세요.');
        } catch (e:any) { setError(e?.message || '명세 저장 실패'); }
        finally { setBusy(false); }
    };
    const start = async () => {
        if (!saved || dirty) return;
        if (!window.confirm(`'${brief.title}' 리서치 개발을 시작할까요?\n최종 명세 뒤 승인 절차를 거칩니다.`)) return;
        try { setBusy(true); setError(''); const d=await adminApi.startDevProject(saved.id); setMessage(d.message); }
        catch(e:any){ setError(e?.message || '개발 시작 실패'); } finally { setBusy(false); }
    };

    return <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Icon name="Search" size={19} className="text-cyan-400"/><h2 className="text-lg font-bold text-white">리서치 개발</h2><span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300">A 화면 단계</span></div><p className="mt-1 text-xs text-gray-400">유형 선택 → 입력 → 명세 확인 순서입니다. 버튼 전에는 AI를 호출하지 않습니다.</p></div><button type="button" onClick={() => { setBrief(EMPTY_RESEARCH_DEV_BRIEF); setPrepared(false); setMessage(''); }} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800">입력 초기화</button></div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">{STEPS.map((step, index) => <div key={step} className={`rounded-xl border p-3 ${index === 0 ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-gray-800 bg-gray-900'}`}><div className="text-[10px] font-black text-cyan-400">STEP {index + 1}</div><div className="mt-1 text-xs font-bold text-white">{step}</div><div className="mt-1 text-[10px] text-gray-500">{index === 0 ? (ready ? '입력 완료' : '입력 중') : '대기'}</div></div>)}</div>

        <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5"><h3 className="text-sm font-bold text-white">1. 작업 유형 선택</h3><p className="mt-1 text-xs text-gray-500">선택하면 입력 항목과 Claude 검토 정책이 자동으로 바뀝니다.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{RESEARCH_WORK_TYPES.map(item => { const on = brief.workType === item.key; return <button key={item.key} type="button" aria-pressed={on} onClick={() => selectType(item.key)} className={`rounded-xl border p-3 text-left transition ${on ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-700 bg-gray-950/50 hover:border-gray-500'}`}><span className={`text-xs font-bold ${on ? 'text-cyan-200' : 'text-gray-200'}`}>{item.label}</span><span className="mt-1 block text-[11px] leading-relaxed text-gray-500">{item.summary}</span></button>; })}</div><div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-gray-800 px-2.5 py-1 text-gray-300">Claude 명세 {policy.useClaudeSpec ? 'ON' : 'OFF'}</span><span className={`rounded-full px-2.5 py-1 ${policy.useClaudeReview ? 'bg-cyan-500/15 text-cyan-300' : 'bg-gray-800 text-gray-400'}`}>Claude 검토 {policy.useClaudeReview ? 'ON' : 'OFF'}</span><span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-blue-300">허드 항상 ON</span></div></section>

        <div className="grid gap-5 lg:grid-cols-2"><section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5"><div><h3 className="text-sm font-bold text-white">공통 입력</h3><p className="mt-1 text-xs text-gray-500">모든 유형에 공통으로 전달됩니다.</p></div>{COMMON_FIELDS.map(def => <Field key={def.key} def={def} value={String(brief[def.key])} onChange={value => set(def.key, value)}/>)}</section><section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5"><div><h3 className="text-sm font-bold text-white">유형별 입력</h3><p className="mt-1 text-xs text-gray-500">현재 유형에 필요한 파라미터만 실행 명세에 포함됩니다.</p></div>{TYPE_FIELD_DEFS[brief.workType].map(def => <Field key={def.key} def={def} value={String(brief[def.key])} onChange={value => set(def.key, value)}/>)}</section></div>

        {error && <div role="alert" className="rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>}
        {message && <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-200">{message}</div>}
        <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">Claude/Codex에 전달될 개발 명세</h3><span className="text-[11px] text-gray-500">입력과 동시에 자동 생성</span></div><pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-gray-800 bg-gray-950/70 p-4 text-xs leading-relaxed text-gray-300">{handoff}</pre><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>void prepare()} disabled={!ready||busy} className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 disabled:opacity-35">{saved&&!dirty ? '✓ 입력 명세 저장됨' : '1. 리서치 준비'}</button><button type="button" onClick={()=>void start()} disabled={!saved||dirty||busy} aria-describedby="research-dev-boundary" className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-35">2. 개발 시작</button></div><p id="research-dev-boundary" className="mt-2 text-[11px] text-gray-500">명세 저장만으로는 실행되지 않습니다. 개발 시작과 확인창 뒤에만 V2 파이프라인이 가동됩니다.</p></section>
    </div></div>;
};
