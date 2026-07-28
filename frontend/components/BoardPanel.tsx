import React, { useState, useEffect } from 'react';
import { boardApi } from '../services/apiService';
import { BoardPost, User } from '../types';
import { Icon } from './Icons';

interface Props {
    user: User;
    personaId: string;
    onClose: () => void;
}

type View = 'list' | 'detail' | 'write' | 'edit';

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',  year: 'numeric', month: '2-digit', day: '2-digit' });

export const BoardPanel: React.FC<Props> = ({ user, personaId, onClose }) => {
    const [view, setView] = useState<View>('list');
    const [posts, setPosts] = useState<{ id: number; title: string; createdAt: string; userId: number; user: { username?: string; email: string }; _count: { replies: number } }[]>([]);
    const [onlyMine, setOnlyMine] = useState(false);
    const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [replyContent, setReplyContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isAdmin = user.role === 'ADMIN';

    const loadList = () => {
        setLoading(true);
        setError('');
        boardApi.getList(personaId)
            .then(setPosts)
            .catch(() => setError('목록을 불러오지 못했습니다.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadList(); }, []);

    const openPost = async (id: number) => {
        setLoading(true);
        setError('');
        try {
            const post = await boardApi.getPost(id);
            setSelectedPost(post);
            setReplyContent('');
            setView('detail');
        } catch (e: any) {
            setError(e.message || '게시글을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleWrite = async () => {
        if (!formTitle.trim() || !formContent.trim()) return;
        setSubmitting(true);
        try {
            await boardApi.create(formTitle, formContent, personaId);
            setFormTitle(''); setFormContent('');
            setView('list');
            loadList();
        } catch (e: any) {
            setError(e.message || '등록 실패');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = async () => {
        if (!selectedPost || !formTitle.trim() || !formContent.trim()) return;
        setSubmitting(true);
        try {
            await boardApi.update(selectedPost.id, formTitle, formContent);
            await openPost(selectedPost.id);
            setView('detail');
        } catch (e: any) {
            setError(e.message || '수정 실패');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('게시글을 삭제하시겠습니까?')) return;
        try {
            await boardApi.delete(id);
            setView('list');
            setSelectedPost(null);
            loadList();
        } catch (e: any) {
            setError(e.message || '삭제 실패');
        }
    };

    const handleReply = async () => {
        if (!selectedPost || !replyContent.trim()) return;
        setSubmitting(true);
        try {
            await boardApi.addReply(selectedPost.id, replyContent);
            setReplyContent('');
            await openPost(selectedPost.id);
        } catch (e: any) {
            setError(e.message || '답글 등록 실패');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteReply = async (replyId: number) => {
        if (!selectedPost || !confirm('답글을 삭제하시겠습니까?')) return;
        try {
            await boardApi.deleteReply(selectedPost.id, replyId);
            await openPost(selectedPost.id);
        } catch (e: any) {
            setError(e.message || '답글 삭제 실패');
        }
    };

    const goWrite = () => { setFormTitle(''); setFormContent(''); setError(''); setView('write'); };
    const goEdit = () => {
        if (!selectedPost) return;
        setFormTitle(selectedPost.title);
        setFormContent(selectedPost.content);
        setError('');
        setView('edit');
    };
    const goList = () => { setView('list'); setSelectedPost(null); setError(''); loadList(); };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60" onClick={onClose}>
        <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#FBF8F3', border: '1px solid #F0E9DE' }} onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-[#F0E9DE] bg-white shrink-0">
                <div className="flex items-center gap-3">
                    {view !== 'list' && (
                        <button onClick={view === 'detail' ? goList : () => { setView(selectedPost ? 'detail' : 'list'); setError(''); }}
                            className="text-[#9089A1] hover:text-[#2D2438] p-1 rounded-lg hover:bg-[#F5EFE6] transition-colors">
                            <Icon name="ChevronLeft" size={20} />
                        </button>
                    )}
                    <h2 className="text-base font-bold text-[#2D2438]">
                        {view === 'list' ? '건의 게시판' : view === 'write' ? '글쓰기' : view === 'edit' ? '수정' : '게시글'}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {view === 'list' && (
                        <button onClick={goWrite}
                            className="flex items-center gap-1.5 bg-[#8E6FB7] hover:bg-[#7d5ea6] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                            <Icon name="PenLine" size={13} /> 글쓰기
                        </button>
                    )}
                    {view === 'detail' && selectedPost && (
                        <>
                            {(selectedPost.userId === user.id || isAdmin) && (
                                <button onClick={goEdit}
                                    className="text-xs text-[#9089A1] hover:text-[#2D2438] px-2 py-1 rounded hover:bg-[#F5EFE6] transition-colors">수정</button>
                            )}
                            {(selectedPost.userId === user.id || isAdmin) && (
                                <button onClick={() => handleDelete(selectedPost.id)}
                                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-[#F5EFE6] transition-colors">삭제</button>
                            )}
                        </>
                    )}
                    <button onClick={onClose} className="text-[#9089A1] hover:text-[#2D2438] p-1.5 rounded-lg hover:bg-[#F5EFE6] transition-colors">
                        <Icon name="X" size={18} />
                    </button>
                </div>
            </div>

            {/* 에러 */}
            {error && (
                <div className="mx-4 mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                    <Icon name="AlertCircle" size={14} className="shrink-0" />{error}
                </div>
            )}

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto">

                {/* 목록 */}
                {view === 'list' && (
                    <div className="max-w-2xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs text-[#9089A1]">기능 개선 요청 및 문의를 남겨주세요. 관리자가 직접 답변드립니다. 비밀글로 운영됩니다.</p>
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0 ml-3">
                                <input
                                    type="checkbox"
                                    checked={onlyMine}
                                    onChange={e => setOnlyMine(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-[#8E6FB7]"
                                />
                                <span className="text-xs text-[#9089A1] whitespace-nowrap">내 글만 보기</span>
                            </label>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-16">
                                <Icon name="Bot" size={36} className="text-[#8E6FB7] animate-bounce" />
                            </div>
                        ) : (
                            (() => {
                                const filtered = onlyMine ? posts.filter(p => p.userId === user.id) : posts;
                                return filtered.length === 0 ? (
                                    <div className="text-center py-16 text-[#9089A1] text-sm">
                                        <Icon name="MessageSquare" size={36} className="mx-auto mb-3 text-[#C9BEDB]" />
                                        {onlyMine ? '작성한 글이 없습니다.' : '아직 게시글이 없습니다. 첫 번째 글을 남겨보세요!'}
                                    </div>
                                ) : (
                            <div className="border border-[#F0E9DE] rounded-xl overflow-hidden">
                                {filtered.map((post, i) => {
                                    const isOwn = user.id === post.userId;
                                    const canRead = isOwn || isAdmin;
                                    return (
                                        <div key={post.id}
                                            className={`flex items-center gap-3 px-4 py-3.5 ${i < filtered.length - 1 ? 'border-b border-[#F0E9DE]' : ''} ${canRead ? 'hover:bg-[#F5EFE6] cursor-pointer' : 'cursor-default'} transition-colors`}
                                            onClick={() => canRead && openPost(post.id)}>
                                            <Icon name="Lock" size={13} className="text-[#8E6FB7] shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-medium truncate ${canRead ? 'text-[#2D2438]' : 'text-[#9089A1]'}`}>
                                                        {post.title}
                                                    </span>
                                                    {post._count.replies > 0 && (
                                                        <span className="text-xs font-semibold text-[#8E6FB7] bg-[#F5E6F7] border border-[#D4B8E8] px-2 py-0.5 rounded-full shrink-0">답변완료</span>
                                                    )}
                                                    {!canRead && (
                                                        <span className="text-xs text-[#9089A1] shrink-0">비밀글</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-[#9089A1] mt-0.5">
                                                    {post.user.username || post.user.email} · {formatDate(post.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                                );
                            })()
                        )}
                    </div>
                )}

                {/* 상세 */}
                {view === 'detail' && selectedPost && (
                    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
                        <div className="bg-white border border-[#F0E9DE] rounded-xl p-5">
                            <h3 className="text-lg font-bold text-[#2D2438] mb-2">{selectedPost.title}</h3>
                            <div className="text-xs text-[#9089A1] mb-4">
                                {selectedPost.user.username || selectedPost.user.email} · {formatDate(selectedPost.createdAt)}
                            </div>
                            <p className="text-sm text-[#5C5468] whitespace-pre-wrap leading-relaxed">{selectedPost.content}</p>
                        </div>

                        {/* 답글 목록 */}
                        {selectedPost.replies.length > 0 && (
                            <div className="space-y-2">
                                {selectedPost.replies.map(reply => (
                                    <div key={reply.id} className={`rounded-xl p-4 border ${reply.isAdminReply ? 'bg-[#F5E6F7] border-[#D4B8E8]' : 'bg-white border-[#F0E9DE]'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {reply.isAdminReply && (
                                                    <span className="text-xs font-semibold text-[#8E6FB7] bg-[#F5E6F7] border border-[#D4B8E8] px-2 py-0.5 rounded-full">관리자</span>
                                                )}
                                                <span className="text-xs text-[#9089A1]">{reply.user.username || reply.user.email} · {formatDate(reply.createdAt)}</span>
                                            </div>
                                            {(reply.userId === user.id || isAdmin) && (
                                                <button onClick={() => handleDeleteReply(reply.id)}
                                                    className="text-xs text-red-400 hover:text-red-300 transition-colors">삭제</button>
                                            )}
                                        </div>
                                        <p className="text-sm text-[#5C5468] whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 답글 작성 (작성자 또는 관리자) */}
                        {(selectedPost.userId === user.id || isAdmin) && (
                            <div className="bg-white border border-[#F0E9DE] rounded-xl p-4">
                                <p className="text-xs text-[#9089A1] mb-2">{isAdmin ? '관리자 답글' : '추가 문의'}</p>
                                <textarea
                                    value={replyContent}
                                    onChange={e => setReplyContent(e.target.value)}
                                    placeholder="내용을 입력하세요..."
                                    rows={3}
                                    className="w-full bg-white border border-[#EAE2D3] rounded-lg px-3 py-2 text-sm text-[#2D2438] placeholder-[#9089A1] focus:outline-none focus:border-[#8E6FB7] resize-none"
                                />
                                <div className="flex justify-end mt-2">
                                    <button onClick={handleReply} disabled={submitting || !replyContent.trim()}
                                        className="bg-[#8E6FB7] hover:bg-[#7d5ea6] disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors">
                                        {submitting ? '등록 중...' : '답글 등록'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 글쓰기 / 수정 폼 */}
                {(view === 'write' || view === 'edit') && (
                    <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
                        <div>
                            <label className="block text-xs text-[#9089A1] mb-1.5">제목</label>
                            <input
                                type="text"
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                                placeholder="제목을 입력하세요"
                                className="w-full bg-white border border-[#EAE2D3] rounded-xl px-4 py-3 text-sm text-[#2D2438] placeholder-[#9089A1] focus:outline-none focus:border-[#8E6FB7]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[#9089A1] mb-1.5">내용</label>
                            <textarea
                                value={formContent}
                                onChange={e => setFormContent(e.target.value)}
                                placeholder="개선하고 싶은 내용을 자세히 적어주세요..."
                                rows={10}
                                className="w-full bg-white border border-[#EAE2D3] rounded-xl px-4 py-3 text-sm text-[#2D2438] placeholder-[#9089A1] focus:outline-none focus:border-[#8E6FB7] resize-none"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setView(selectedPost ? 'detail' : 'list'); setError(''); }}
                                className="text-sm text-[#9089A1] hover:text-[#2D2438] px-4 py-2 rounded-lg hover:bg-[#F5EFE6] transition-colors">취소</button>
                            <button onClick={view === 'write' ? handleWrite : handleEdit}
                                disabled={submitting || !formTitle.trim() || !formContent.trim()}
                                className="bg-[#8E6FB7] hover:bg-[#7d5ea6] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                                {submitting ? '저장 중...' : view === 'write' ? '등록' : '수정 완료'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </div>
    );
};
