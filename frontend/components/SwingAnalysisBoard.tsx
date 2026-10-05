import React, { useEffect, useState } from 'react';
import type { SwingAnalysis, UserSwingAnalysis } from '../types';
import { swingAnalysisApi } from '../services/apiService';
import { swingTitle, validSwingScore, weakestSwingSection } from '../lib/swingTitle';
import './persona/seolaChat.css';
type Result = {id:number;title?:string|null;analysis:SwingAnalysis;createdAt:string};
const textItems = (items?:string[]) => (items || []).filter(item=>typeof item === 'string' && item.trim());
export const SeolaLessonCard: React.FC<{record:Result}> = ({record}) => {
 const a=record.analysis, priorities=textItems(a.topPriorities), drills=textItems(a.recommendedDrills), sections=a.sections || [];
 const point=priorities[0] || textItems(weakestSwingSection(a)?.improve)[0];
 const summary=a.overallComment?.trim().match(/^[\s\S]*?[.!?。！？](?:\s|$)|^[\s\S]+$/)?.[0]?.trim();
 return <article className="seola-lesson"><span className="seola-eyebrow">설아의 레슨 카드</span><h1>{swingTitle(record)}</h1>
 {point && <section className="seola-point"><h3>오늘의 원포인트</h3><p>{point}</p></section>}
 {summary && <section><h3>스윙 요약</h3><p>{summary}</p></section>}
 {drills[0] && <section><h3>오늘의 드릴 하나</h3><p>{drills[0]}</p></section>}
 {(sections.some(s=>s.name && validSwingScore(s.score)) || validSwingScore(a.overallScore)) && <section><h3>내 스윙의 흐름</h3>{sections.filter(s=>s.name && validSwingScore(s.score)).map((s,i)=><div className="seola-score" key={i}><span>{s.name}</span><progress max={100} value={s.score} aria-label={`${s.name} ${s.score}점`}/><b>{s.score}</b></div>)}{validSwingScore(a.overallScore) && <p>종합 점수 <strong>{a.overallScore}점</strong></p>}</section>}
 {sections.filter(s=>s.comment?.trim()||textItems(s.good).length||textItems(s.improve).length).map((s,i)=><details key={i}><summary>{s.name} 자세히 보기</summary>{s.comment && <p>{s.comment}</p>}{textItems(s.good).length>0 && <><h3>잘된 점</h3><ul>{textItems(s.good).map((v,j)=><li key={j}>{v}</li>)}</ul></>}{textItems(s.improve).length>0 && <><h3>개선할 점</h3><ul>{textItems(s.improve).map((v,j)=><li key={j}>{v}</li>)}</ul></>}</details>)}
 {(a.overallComment || priorities.length>1 || drills.length>1) && <details><summary>전체 레슨 노트</summary>{a.overallComment && <p>{a.overallComment}</p>}{priorities.length>1 && <><h3>추가 점검 포인트</h3><ul>{priorities.slice(1).map((v,i)=><li key={i}>{v}</li>)}</ul></>}{drills.length>1 && <><h3>추가 드릴</h3><ul>{drills.slice(1).map((v,i)=><li key={i}>{v}</li>)}</ul></>}</details>}
 </article>;
};
export const SwingAnalysisBoard:React.FC<{onClose:()=>void;personaId:string;initialResult?:Result|null}> = ({onClose,personaId,initialResult}) => {
 const [history,setHistory]=useState<UserSwingAnalysis[]>([]),[selected,setSelected]=useState<Result|null>(initialResult||null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let alive=true;setLoading(true);swingAnalysisApi.getHistory(personaId).then(data=>{if(alive)setHistory(data);}).catch(()=>{if(alive)setError('기록을 불러오지 못했어요. 다시 열어주세요.');}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[personaId]);
 const remove=async(id:number)=>{if(!confirm('이 스윙 기록을 삭제할까요?'))return;try{await swingAnalysisApi.delete(id);setHistory(h=>h.filter(r=>r.id!==id));if(selected?.id===id)setSelected(null);}catch{setError('삭제하지 못했어요. 다시 시도해주세요.');}};
 return <div className="seola-board-overlay"><section className="seola-board" role="dialog" aria-modal="true" aria-labelledby="seola-board-title"><header><h2 id="seola-board-title">{selected?'설아의 레슨 카드':'지난 점검 기록'}</h2><button className="seola-close" aria-label="스윙 기록 닫기" onClick={onClose}>×</button></header><div className="seola-board-content">{error && <p role="alert">{error}</p>}{selected?<><button className="seola-back" onClick={()=>setSelected(null)}>← 지난 점검 기록</button><SeolaLessonCard record={selected}/></>:<>{loading?<p role="status">기록을 불러오는 중…</p>:history.length===0?<p className="seola-board-empty">아직 점검 기록이 없어요. 첫 스윙을 보여주세요.</p>:history.map(record=><div className="seola-record-row" key={record.id}><button className="seola-record" onClick={()=>setSelected(record)}><span><strong>{swingTitle(record)}</strong><small>{new Date(record.createdAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</small></span>{validSwingScore(record.analysis?.overallScore)&&<b>{record.analysis.overallScore}점</b>}</button><button className="seola-delete" aria-label={`${swingTitle(record)} 삭제`} onClick={()=>void remove(record.id)}>×</button></div>)}</>}</div></section></div>;
};
