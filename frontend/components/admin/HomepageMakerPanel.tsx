import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';
import { EMPTY_HOMEPAGE_MAKER_BRIEF, buildHomepageMakerHandoff, isHomepageMakerBriefReady, type HomepageMakerBrief } from './homepageMakerBrief';

const STEPS = [['1','콘셉트 입력','느낌·히어로·오브젝트'],['2','메이커 제작','한 콘셉트로 완성'],['3','체커 검토','화면·기능·반응형'],['4','미리보기 승인','확인 전 배포 금지'],['5','독립 배포','새 도메인 연결']] as const;
const inputCls = 'w-full rounded-xl border border-gray-700 bg-gray-950/70 px-3.5 py-3 text-sm text-white placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

const Field: React.FC<{label:string; hint:string; value:string; required?:boolean; multiline?:boolean; onChange:(v:string)=>void}> = p => (
    <label className="block space-y-1.5">
        <span className="text-xs font-bold text-gray-200">{p.label}{p.required && <span className="text-blue-400"> *</span>}</span>
        {p.multiline
            ? <textarea rows={3} value={p.value} onChange={e=>p.onChange(e.target.value)} placeholder={p.hint} className={`${inputCls} resize-y`} />
            : <input value={p.value} onChange={e=>p.onChange(e.target.value)} placeholder={p.hint} className={inputCls} />}
    </label>
);

export const HomepageMakerPanel: React.FC = () => {
    const [brief,setBrief]=useState<HomepageMakerBrief>(EMPTY_HOMEPAGE_MAKER_BRIEF);
    const [useReview,setUseReview]=useState(true);
    const [saved,setSaved]=useState<{id:string;signature:string}|null>(null);
    const [concurrency,setConcurrency]=useState({running:0,max:1,canStart:true});
    const [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [error,setError]=useState('');
    const [showSpec,setShowSpec]=useState(true);
    const ready=isHomepageMakerBriefReady(brief);
    const handoff=useMemo(()=>buildHomepageMakerHandoff(brief),[brief]);
    const signature=`${handoff}\nreview=${useReview}`;
    const dirty=saved?.signature!==signature;

    useEffect(()=>{ adminApi.listDevProjects().then(d=>setConcurrency(d.concurrency)).catch(()=>{}); },[]);
    const set=(key:keyof HomepageMakerBrief)=>(value:string)=>{setBrief(v=>({...v,[key]:value}));setMessage('');setError('');};
    const reset=()=>{setBrief(EMPTY_HOMEPAGE_MAKER_BRIEF);setUseReview(true);setSaved(null);setMessage('');setError('');};

    const saveSpec=async()=>{
        if(!ready){setError('필수 입력 5개를 먼저 채워 주세요.');return;}
        try{
            setBusy(true);setError('');setMessage('');
            const body={title:`[홈페이지] ${brief.projectName.trim()}`,features:`독립 홈페이지 제작 — ${brief.heroSummary.trim()}`,specBody:handoff,refUrls:brief.contentSource,note:'허드 AI 홈페이지 탭에서 저장',brief:'{}',useReview,workdir:'/home/paks11299958/ai_mp'};
            if(saved){await adminApi.updateDevProject({...body,id:saved.id});setSaved({id:saved.id,signature});}
            else{const d=await adminApi.createDevProject(body);setSaved({id:d.project.id,signature});}
            setMessage('명세를 저장했습니다. 아래 내용을 확인한 뒤 허드를 시작하세요.');
        }catch(e:any){setError(e?.message||'명세 저장에 실패했습니다.');}finally{setBusy(false);}
    };
    const start=async()=>{
        if(!saved||dirty){setError('현재 입력을 먼저 명세로 저장해 주세요.');return;}
        if(!concurrency.canStart){setError(`이미 ${concurrency.running}건이 실행 중입니다. 끝난 뒤 시작해 주세요.`);return;}
        if(!window.confirm(`'${brief.projectName}' 홈페이지 제작을 시작할까요?\n운영 배포는 하지 않으며, 계획이 나오면 별도 승인이 필요합니다.`))return;
        try{setBusy(true);setError('');const d=await adminApi.startDevProject(saved.id);setConcurrency(v=>({...v,running:v.running+1,canStart:false}));setMessage(d.message);}
        catch(e:any){setError(e?.message||'허드 시작에 실패했습니다. 저장된 명세는 유지됩니다.');}finally{setBusy(false);}
    };

    return <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap"><div><div className="flex items-center gap-2"><Icon name="Sparkles" size={19} className="text-blue-400"/><h2 className="text-lg font-bold text-white">홈페이지 생성</h2><span className="rounded-full bg-green-500/15 px-2 py-1 text-[10px] font-bold text-green-300">허드 연결됨</span></div><p className="mt-1 text-xs text-gray-400">입력 → 명세 확인 → 저장 → 명시적 시작 순서입니다. 시작 전에는 AI를 호출하지 않습니다.</p></div><button type="button" onClick={reset} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800">입력 초기화</button></div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">{STEPS.map(([n,t,d],i)=><div key={n} className={`rounded-xl border p-3 ${i===0?'border-blue-500/50 bg-blue-500/10':'border-gray-800 bg-gray-900'}`}><div className="text-[10px] font-black text-blue-400">STEP {n}</div><div className="mt-1 text-xs font-bold text-white">{t}</div><div className="mt-1 text-[10px] text-gray-500">{d}</div></div>)}</div>
        {error&&<div className="rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>}{message&&<div className="rounded-lg border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300">{message}</div>}
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5"><div><h3 className="text-sm font-bold text-white">핵심 콘셉트</h3><p className="mt-1 text-xs text-gray-500">필수 다섯 칸이 제작 방향을 고정합니다.</p></div><Field label="프로젝트 이름" required value={brief.projectName} onChange={set('projectName')} hint="예: aiworld"/><Field label="원하는 홈페이지 느낌" required value={brief.brandMood} onChange={set('brandMood')} hint="예: 고급스럽고 절제된 미래형"/><Field label="히어로 화면 한 줄 설명" required multiline value={brief.heroSummary} onChange={set('heroSummary')} hint="첫 화면에서 전달할 것"/><Field label="히어로의 핵심 오브젝트" required value={brief.heroObject} onChange={set('heroObject')} hint="예: 큐브, 빛나는 구체"/><Field label="움직임과 콘텐츠 연결" required multiline value={brief.motionStory} onChange={set('motionStory')} hint="예: 큐브가 펼쳐져 서비스 메뉴가 된다"/></section>
            <div className="space-y-5"><section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5"><div><h3 className="text-sm font-bold text-white">내용과 작업 경계</h3><p className="mt-1 text-xs text-gray-500">없는 사실은 만들지 않고 금지 경로는 명세에 전달합니다.</p></div><Field label="기존 내용 출처" value={brief.contentSource} onChange={set('contentSource')} hint="기존 URL 또는 sites/ 경로"/><Field label="반드시 유지할 내용" multiline value={brief.mustKeep} onChange={set('mustKeep')} hint="바꾸면 안 되는 내용"/><Field label="희망 독립 도메인" value={brief.desiredDomain} onChange={set('desiredDomain')} hint="최종 승인 후 연결"/><Field label="수정 금지 파일·경로" value={brief.forbiddenFiles} onChange={set('forbiddenFiles')} hint="쉼표로 구분"/></section>
            <section className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 sm:p-5 space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-white">리뷰와 비용</h3><p className="mt-1 text-xs text-gray-400">새 화면은 리뷰 ON 권장. 리뷰 시 호출·시간 약 2배.</p></div><button type="button" role="switch" aria-checked={useReview} onClick={()=>{setUseReview(v=>!v);setMessage('');}} className={`rounded-full px-3 py-2 text-xs font-bold ${useReview?'bg-blue-600 text-white':'bg-gray-800 text-gray-400'}`}>리뷰 {useReview?'ON':'OFF'}</button></div>{!useReview&&<p className="text-xs text-amber-300">렌더·반응형 결함을 놓칠 수 있습니다.</p>}<p className="text-[11px] text-gray-500">예상 20~35분 · 리뷰 시 약 2배 · 동시 실행 {concurrency.running}/{concurrency.max}</p></section></div>
        </div>
        <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5"><button type="button" onClick={()=>setShowSpec(v=>!v)} className="flex w-full items-center justify-between text-left"><span className="text-sm font-bold text-white">Developer에게 전달될 실제 명세</span><span className="text-xs text-gray-500">{showSpec?'접기':'펼치기'}</span></button>{showSpec&&<pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-gray-800 bg-gray-950/70 p-4 text-xs leading-relaxed text-gray-300">{handoff}</pre>}<div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={saveSpec} disabled={!ready||busy} className="rounded-xl border border-blue-500/50 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-200 disabled:opacity-35">{busy?'처리 중…':saved&&dirty?'변경 명세 저장':saved?'✓ 명세 저장됨':'1. 명세 저장'}</button><button type="button" onClick={start} disabled={!saved||dirty||busy||!concurrency.canStart} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-35">2. 허드 시작</button></div><p className="mt-2 text-[11px] text-gray-500">계획·작업 승인은 개발 탭에서 처리합니다. 운영 배포와 DNS 연결은 자동으로 하지 않습니다.</p></section>
    </div></div>;
};
