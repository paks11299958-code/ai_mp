import React, { useState, useEffect, useRef } from 'react';
import { TriggerVideo } from '../types';
import { triggerVideoApi } from '../services/apiService';
import { Icon } from './Icons';

interface PersonaTriggersTabProps {
    personaId: string;
}

export const PersonaTriggersTab: React.FC<PersonaTriggersTabProps> = ({ personaId }) => {
    const [triggerVideos, setTriggerVideos] = useState<TriggerVideo[]>([]);
    const [tvTitle, setTvTitle] = useState('');
    const [tvDescription, setTvDescription] = useState('');
    const [tvKeywords, setTvKeywords] = useState('');
    const [tvTag, setTvTag] = useState('');
    const [tvUploading, setTvUploading] = useState(false);
    const [tvExtracting, setTvExtracting] = useState(false);
    const [tvEditingId, setTvEditingId] = useState<number | null>(null);
    const [tvEditKeywords, setTvEditKeywords] = useState('');
    const [tvEditTag, setTvEditTag] = useState('');
    const tvFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        triggerVideoApi.getAll(personaId).then(setTriggerVideos).catch(() => setTriggerVideos([]));
    }, [personaId]);

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">

            {/* 업로드 폼 */}
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">트리거 영상 추가</h3>
                <p className="text-xs text-gray-500">채팅 중 키워드가 감지되면 자동으로 팝업 재생됩니다.</p>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">제목 <span className="text-red-400">*</span></label>
                        <input
                            type="text" value={tvTitle} onChange={e => setTvTitle(e.target.value)}
                            placeholder="예: 아침 인사 반응"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">태그 (상황/감정)</label>
                        <input
                            type="text" value={tvTag} onChange={e => setTvTag(e.target.value)}
                            placeholder="예: 인사 / 밝음"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">설명 (AI 키워드 추출에 활용)</label>
                    <input
                        type="text" value={tvDescription} onChange={e => setTvDescription(e.target.value)}
                        placeholder="예: 아침 인사를 받았을 때 밝게 반응하는 영상"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-400">트리거 키워드 <span className="text-red-400">*</span></label>
                        <button
                            onClick={async () => {
                                if (!tvTitle.trim()) { alert('제목을 먼저 입력해주세요.'); return; }
                                setTvExtracting(true);
                                try {
                                    const res = await triggerVideoApi.extractKeywords(tvTitle, tvDescription);
                                    setTvKeywords(res.keywords.join(', '));
                                } catch (e: any) { alert('키워드 추출 실패: ' + e.message); }
                                finally { setTvExtracting(false); }
                            }}
                            disabled={tvExtracting || !tvTitle.trim()}
                            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
                        >
                            <Icon name="Bot" size={12} />
                            {tvExtracting ? 'AI 추출 중...' : 'AI 자동 추출'}
                        </button>
                    </div>
                    <textarea
                        value={tvKeywords} onChange={e => setTvKeywords(e.target.value)}
                        placeholder={"안녕, 안녕하세요, 좋은아침, 방가워, 반가워\n쉼표로 구분. AI 자동 추출 후 수정 가능"}
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">쉼표(,)로 구분. 직접 입력하거나 AI 자동 추출 후 수정하세요.</p>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">영상 파일 <span className="text-red-400">*</span></label>
                    <input ref={tvFileInputRef} type="file" accept="video/*" className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !tvTitle.trim() || !tvKeywords.trim()) {
                                alert('제목과 키워드를 먼저 입력해주세요.');
                                e.target.value = '';
                                return;
                            }
                            setTvUploading(true);
                            try {
                                const { signedUrl, publicUrl } = await triggerVideoApi.getSignedUrl(file.type, file.name);
                                await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
                                const created = await triggerVideoApi.create({
                                    personaId,
                                    videoUrl: publicUrl,
                                    title: tvTitle.trim(),
                                    description: tvDescription.trim() || undefined,
                                    keywords: tvKeywords.trim(),
                                    tag: tvTag.trim() || undefined,
                                });
                                setTriggerVideos(prev => [...prev, created]);
                                setTvTitle(''); setTvDescription(''); setTvKeywords(''); setTvTag('');
                            } catch (err: any) { alert('업로드 실패: ' + err.message); }
                            finally { setTvUploading(false); e.target.value = ''; }
                        }}
                    />
                    <button
                        onClick={() => tvFileInputRef.current?.click()}
                        disabled={tvUploading || !tvTitle.trim() || !tvKeywords.trim()}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                    >
                        <Icon name="Upload" size={14} />
                        {tvUploading ? '업로드 중...' : '영상 업로드 & 저장'}
                    </button>
                </div>
            </div>

            {/* 저장된 목록 */}
            {triggerVideos.length > 0 ? (
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white">등록된 트리거 영상 ({triggerVideos.length}개)</h3>
                    {triggerVideos.map(tv => (
                        <div key={tv.id} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 space-y-3">
                            <div className="flex gap-3">
                                <video
                                    src={tv.videoUrl}
                                    className="w-28 h-20 object-cover rounded-lg bg-black shrink-0 cursor-pointer"
                                    onClick={e => { const v = e.currentTarget; v.paused ? v.play() : v.pause(); }}
                                    title="클릭하여 재생/정지"
                                    muted preload="metadata"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-white">{tv.title || '(제목 없음)'}</span>
                                                {tv.tag && <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full">{tv.tag}</span>}
                                            </div>
                                            {tv.description && <p className="text-xs text-gray-500 mt-0.5">{tv.description}</p>}
                                            <p className="text-[10px] text-gray-600 mt-1 truncate">{tv.videoUrl.split('/').pop()}</p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`"${tv.title}" 트리거 영상을 삭제할까요?`)) return;
                                                await triggerVideoApi.delete(tv.id);
                                                setTriggerVideos(prev => prev.filter(x => x.id !== tv.id));
                                            }}
                                            className="shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                                        >
                                            <Icon name="Trash2" size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 키워드 편집 */}
                            {tvEditingId === tv.id ? (
                                <div className="space-y-2">
                                    <input
                                        type="text" value={tvEditKeywords} onChange={e => setTvEditKeywords(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                    <input
                                        type="text" value={tvEditTag} onChange={e => setTvEditTag(e.target.value)}
                                        placeholder="태그 (예: 인사 / 밝음)"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                await triggerVideoApi.update(tv.id, { keywords: tvEditKeywords, tag: tvEditTag });
                                                setTriggerVideos(prev => prev.map(x => x.id === tv.id ? { ...x, keywords: tvEditKeywords, tag: tvEditTag } : x));
                                                setTvEditingId(null);
                                            }}
                                            className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                                        >저장</button>
                                        <button onClick={() => setTvEditingId(null)}
                                            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                                        >취소</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-wrap gap-1 flex-1">
                                        {tv.keywords.split(',').map(k => k.trim()).filter(Boolean).map((kw, i) => (
                                            <span key={i} className="text-[10px] bg-gray-700/80 text-gray-300 px-2 py-0.5 rounded-full">{kw}</span>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => { setTvEditingId(tv.id); setTvEditKeywords(tv.keywords); setTvEditTag(tv.tag || ''); }}
                                        className="shrink-0 text-xs text-gray-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                                    >
                                        <Icon name="PenLine" size={11} /> 수정
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-600 text-center py-8">등록된 트리거 영상이 없습니다.</p>
            )}
        </div>
    );
};
