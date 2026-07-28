import React, { useState, useEffect, useCallback } from 'react';
import { sampleVaultApi, SampleVaultRow } from '../../services/apiService';
import { fmtDateTime } from '../../utils/datetime';

// 언어/카테고리 라벨 — ShortsAdminPanel.tsx와 동일 매핑(중복 정의, 두 파일이 서로 다른
// 목적이라 공유 모듈로 안 뺌 — 기존 패턴 그대로 따름).
const LANGUAGE_LABEL: Record<string, string> = {
    ko: '한국어', zh: '중국어', ja: '일본어', en: '영어', vi: '베트남어',
};
const CATEGORY_LABEL: Record<string, string> = {
    community: '커뮤니티', product: '제품·상품', insight: '지식·인사이트',
    wellness: '웰니스', meme: '밈·POV',
};

// 샘플 영상 보관함(2026-07-25 사장 발안) — 잘 나온 완성 쇼츠를 UserShorts에서 복사해
// 독립적으로 영구 보관. ShortsAdminPanel의 "회원 쇼츠 만들기(검수용, 임시)" 섹션은
// 안정화되면 제거될 예정이라, 여기 옮겨둔 샘플은 그와 무관하게 계속 남는다.
export const SampleVaultPanel: React.FC = () => {
    const [rows, setRows] = useState<SampleVaultRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [openVideoId, setOpenVideoId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        sampleVaultApi.list()
            .then(setRows)
            .catch(() => setError('목록을 불러오지 못했어요.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const startEdit = (row: SampleVaultRow) => {
        setEditingId(row.id);
        setEditTitle(row.title);
        setEditDesc(row.description || '');
    };

    const saveEdit = async (id: number) => {
        if (!editTitle.trim()) { setError('제목을 입력해 주세요.'); return; }
        setSaving(true); setError(null);
        try {
            await sampleVaultApi.update(id, { title: editTitle.trim(), description: editDesc.trim() });
            setEditingId(null);
            load();
        } catch (e: any) {
            setError(e.message || '수정에 실패했어요.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: number) => {
        if (!confirm('이 샘플을 보관함에서 삭제할까요? (원본 회원 쇼츠는 그대로 남아요)')) return;
        try {
            await sampleVaultApi.remove(id);
            setRows(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            alert('삭제 실패: ' + e.message);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">📦 샘플 영상 보관함</h3>
                <button onClick={load} className="text-[10px] text-gray-500 hover:text-gray-300">🔄 새로고침</button>
            </div>
            <p className="text-xs text-gray-500">
                회원 쇼츠 만들기 완성본 중 잘 나온 샘플을 여기 영구 보관해요. 제목·설명 문구만
                수정할 수 있고, 삭제해도 원본 회원 쇼츠는 그대로 남아요.
            </p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            {loading && <p className="text-xs text-gray-600 text-center py-6">불러오는 중...</p>}
            {!loading && rows.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-10">
                    보관된 샘플이 없어요. "회원 쇼츠 만들기(검수용)" 탭에서 📦 버튼으로 옮겨보세요.
                </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rows.map(row => {
                    const isOpen = openVideoId === row.id;
                    const isEditing = editingId === row.id;
                    return (
                        <div key={row.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                            <div className="flex gap-3">
                                <div className="w-20 h-32 shrink-0 rounded-lg bg-black overflow-hidden flex items-center justify-center">
                                    {row.hasThumbnail ? (
                                        <img src={sampleVaultApi.thumbnailUrl(row.id)} alt={row.title}
                                             className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[10px] text-gray-500 text-center px-1">썸네일<br />생성 중</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        <div className="space-y-1.5">
                                            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                                   className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                                   placeholder="제목" />
                                            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                                                      rows={2}
                                                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white resize-y"
                                                      placeholder="설명(선택)" />
                                            <div className="flex gap-1.5">
                                                <button onClick={() => saveEdit(row.id)} disabled={saving}
                                                        className="text-[11px] px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-60">
                                                    저장
                                                </button>
                                                <button onClick={() => setEditingId(null)}
                                                        className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-white font-medium truncate">{row.title}</p>
                                            {row.description && (
                                                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{row.description}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-900/60 text-blue-200">
                                                    {LANGUAGE_LABEL[row.language] || row.language}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-900/60 text-purple-200">
                                                    {CATEGORY_LABEL[row.category] || row.category}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-600 mt-1">{fmtDateTime(row.createdAt)}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                            {!isEditing && (
                                <div className="flex gap-1.5 mt-2">
                                    <button onClick={() => setOpenVideoId(isOpen ? null : row.id)}
                                            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white transition-colors">
                                        {isOpen ? '영상 닫기' : '▶ 영상 보기'}
                                    </button>
                                    <button onClick={() => startEdit(row)}
                                            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
                                        ✏️ 수정
                                    </button>
                                    <button onClick={() => remove(row.id)}
                                            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800/60 text-red-200 transition-colors ml-auto">
                                        🗑 삭제
                                    </button>
                                </div>
                            )}
                            {isOpen && (
                                <video src={sampleVaultApi.videoUrl(row.id)} controls preload="metadata"
                                       className="w-full max-w-[220px] mx-auto rounded-lg bg-black mt-2" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
