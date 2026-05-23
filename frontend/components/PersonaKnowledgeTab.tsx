import React, { useState, useEffect } from 'react';
import { Persona } from '../types';
import { knowledgeApi } from '../services/apiService';

interface PersonaKnowledgeTabProps {
    personaId: string;
    personas: Persona[];
}

export const PersonaKnowledgeTab: React.FC<PersonaKnowledgeTabProps> = ({ personaId, personas }) => {
    const [knowledgeList, setKnowledgeList] = useState<{ sourceId: string | null; title: string | null; chunkCount: number; preview: string; createdAt: string }[]>([]);
    const [knowledgeTitle, setKnowledgeTitle] = useState('');
    const [knowledgeText, setKnowledgeText] = useState('');
    const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);

    useEffect(() => {
        knowledgeApi.getAll(personaId).then(setKnowledgeList).catch(() => setKnowledgeList([]));
    }, [personaId]);

    const activePersona = personas.find(p => p.id === personaId);

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            {/* 업로드 폼 */}
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">텍스트 지식 추가</h3>
                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">제목 (선택)</label>
                    <input
                        type="text"
                        value={knowledgeTitle}
                        onChange={e => setKnowledgeTitle(e.target.value)}
                        placeholder={activePersona ? `${activePersona.name}${activePersona.jobTitle ? ` - ${activePersona.jobTitle}` : ''}` : '제목 입력'}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-400">내용 <span className="text-red-400">*</span></label>
                        <label className="cursor-pointer flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            .txt 파일 선택
                            <input
                                type="file" accept=".txt" className="hidden"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (!knowledgeTitle) setKnowledgeTitle(file.name.replace(/\.txt$/, ''));
                                    const reader = new FileReader();
                                    reader.onload = ev => setKnowledgeText(ev.target?.result as string ?? '');
                                    reader.readAsText(file, 'UTF-8');
                                    e.target.value = '';
                                }}
                            />
                        </label>
                    </div>
                    <textarea
                        value={knowledgeText}
                        onChange={e => setKnowledgeText(e.target.value)}
                        placeholder={"페르소나가 알아야 할 전문 지식을 입력하세요.\n\n문단을 빈 줄로 구분하면 자동으로 청크로 나뉩니다."}
                        rows={10}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">문단 기준 자동 청크 분할 (최대 600자 / 50자 오버랩)</p>
                </div>
                <button
                    onClick={async () => {
                        if (!knowledgeText.trim()) return;
                        setIsUploadingKnowledge(true);
                        try {
                            const result = await knowledgeApi.upload(personaId, knowledgeTitle, knowledgeText);
                            setKnowledgeTitle('');
                            setKnowledgeText('');
                            const updated = await knowledgeApi.getAll(personaId);
                            setKnowledgeList(updated);
                            if (result.action === 'kept_existing') {
                                alert(`📋 기존 문서가 더 품질이 높아 유지했습니다.\n새 문서는 저장하지 않았습니다.`);
                            } else if (result.action === 'replaced') {
                                alert(`🔄 새 문서가 더 품질이 높아 기존 문서를 교체했습니다.\n✅ ${result.total}개 청크 저장`);
                            } else {
                                alert(`✅ 저장 완료 — ${result.total}개 청크 생성`);
                            }
                        } catch (e: any) {
                            alert('저장 실패: ' + e.message);
                        } finally {
                            setIsUploadingKnowledge(false);
                        }
                    }}
                    disabled={isUploadingKnowledge || !knowledgeText.trim()}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                    {isUploadingKnowledge ? '처리 중...' : '저장'}
                </button>
            </div>

            {/* 저장된 문서 목록 */}
            {knowledgeList.length > 0 ? (
                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-white">저장된 문서 ({knowledgeList.length}개)</h3>
                    {knowledgeList.map(k => (
                        <div key={k.sourceId ?? k.createdAt} className="bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    {k.title && <p className="text-xs font-semibold text-blue-400">{k.title}</p>}
                                    <span className="text-[10px] text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded-full">{k.chunkCount}청크</span>
                                </div>
                                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{k.preview}...</p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!confirm(`"${k.title || '(제목 없음)'}" 문서 전체(${k.chunkCount}청크)를 삭제할까요?`)) return;
                                    if (k.sourceId) {
                                        await knowledgeApi.deleteSource(k.sourceId);
                                    }
                                    setKnowledgeList(prev => prev.filter(x => x.sourceId !== k.sourceId));
                                }}
                                className="shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-600 text-center py-8">아직 저장된 지식이 없습니다.</p>
            )}
        </div>
    );
};
