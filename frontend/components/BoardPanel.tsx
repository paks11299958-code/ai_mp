import React, { useState, useEffect } from 'react';
import { boardApi } from '../services/apiService';
import { BoardPost, User } from '../types';
import { Icon } from './Icons';

interface Props {
    user: User;
    onClose: () => void;
}

type View = 'list' | 'detail' | 'write' | 'edit';

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

export const BoardPanel: React.FC<Props> = ({ user, onClose }) => {
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
        boardApi.getList()
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
            await boardApi.create(formTitle, formContent);
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
        <div className="fixed inset-0 bg-gray-950 flex flex-col z-40">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-800 bg-gray-950 shrink-0">
                <div className="flex items-center gap-3">
                    {view !== 'list' && (
                        <button onClick={view === 'detail' ? goList : () => { setView(selectedPost ? 'detail' : 'list'); setError(''); }}
                            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors">
                            <Icon name="ChevronLeft" size={20} />
                        </button>
                    )}
                    <h2 className="text-base font-bold text-white">
                        {view === 'list' ? '소통게시판' : view === 'write' ? '글쓰기' : view === 'edit' ? '수정' : '게시글'}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {view === 'list' && (
                        <button onClick={goWrite}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                            <Icon name="PenLine" size={13} /> 글쓰기
                        </button>
                    )}
                    {view === 'detail' && selectedPost && (
                        <>
                            {(selectedPost.userId === user.id || isAdmin) && (
                                <button onClick={goEdit}
                                    className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">수정</button>
                            )}
                            {(selectedPost.userId === user.id || isAdmin) && (
                                <button onClick={() => handleDelete(selectedPost.id)}
                                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors">삭제</button>
                            )}
                        </>
                    )}
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                        <Icon name="X" size={18} />
                    </button>
                </div>
            </div>

            {/* 에러 */}
            {error && (
                <div className="mx-4 mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-2">
                    <Icon name="AlertCircle" size={14} className="shrink-0" />{error}
                </div>
            )}

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto">

                {/* 목록 */}
                {view === 'list' && (
                    <div className="max-w-2xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs text-gray-500">기능 개선 요청 및 문의를 남겨주세요. 관리자가 직접 답변드립니다. 비밀글로 운영됩니다.</p>
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0 ml-3">
                                <input
                                    type="checkbox"
                                    checked={onlyMine}
                                    onChange={e => setOnlyMine(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-blue-500"
                                />
                                <span className="text-xs text-gray-400 whitespace-nowrap">내 글만 보기</span>
                            </label>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-16">
                                <Icon name="Bot" size={36} className="text-blue-500 animate-bounce" />
                            </div>
                        ) : (
                            (() => {
                                const filtered = onlyMine ? posts.filter(p => p.userId === user.id) : posts;
                                return filtered.length === 0 ? (
                                    <div className="text-center py-16 text-gray-500 text-sm">
                                        <Icon name="MessageSquare" size={36} className="mx-auto mb-3 text-gray-700" />
                                        {onlyMine ? '작성한 글이 없습니다.' : '아직 게시글이 없습니다. 첫 번째 글을 남겨보세요!'}
                                    </div>
                                ) : (
                            <div className="border border-gray-800 rounded-xl overflow-hidden">
                                {filtered.map((post, i) => {
                                    const isOwn = user.id === post.userId;
                                    const canRead = isOwn || isAdmin;
                                    return (
                                        <div key={post.id}
                                            className={`flex items-center gap-3 px-4 py-3.5 ${i < filtered.length - 1 ? 'border-b border-gray-800' : ''} ${canRead ? 'hover:bg-gray-900 cursor-pointer' : 'cursor-default'} transition-colors`}
                                            onClick={() => canRead && openPost(post.id)}>
                                            <Icon name="Lock" size={13} className="text-blue-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-medium truncate ${canRead ? 'text-gray-100' : 'text-gray-500'}`}>
                                                        {post.title}
                                                    </span>
                                                    {post._count.replies > 0 && (
                                                        <span className="text-xs font-semibold text-blue-400 bg-blue-900/40 border border-blue-800/50 px-2 py-0.5 rounded-full shrink-0">답변완료</span>
                                                    )}
                                                    {!canRead && (
                                                        <span className="text-xs text-gray-600 shrink-0">비밀글</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
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
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <h3 className="text-lg font-bold text-white mb-2">{selectedPost.title}</h3>
                            <div className="text-xs text-gray-500 mb-4">
                                {selectedPost.user.username || selectedPost.user.email} · {formatDate(selectedPost.createdAt)}
                            </div>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{selectedPost.content}</p>
                        </div>

                        {/* 답글 목록 */}
                        {selectedPost.replies.length > 0 && (
                            <div className="space-y-2">
                                {selectedPost.replies.map(reply => (
                                    <div key={reply.id} className={`rounded-xl p-4 border ${reply.isAdminReply ? 'bg-blue-950/30 border-blue-800/40' : 'bg-gray-900 border-gray-800'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {reply.isAdminReply && (
                                                    <span className="text-xs font-semibold text-blue-400 bg-blue-900/40 border border-blue-800/50 px-2 py-0.5 rounded-full">관리자</span>
                                                )}
                                                <span className="text-xs text-gray-500">{reply.user.username || reply.user.email} · {formatDate(reply.createdAt)}</span>
                                            </div>
                                            {(reply.userId === user.id || isAdmin) && (
                                                <button onClick={() => handleDeleteReply(reply.id)}
                                                    className="text-xs text-red-400 hover:text-red-300 transition-colors">삭제</button>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 답글 작성 (작성자 또는 관리자) */}
                        {(selectedPost.userId === user.id || isAdmin) && (
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                                <p className="text-xs text-gray-500 mb-2">{isAdmin ? '관리자 답글' : '추가 문의'}</p>
                                <textarea
                                    value={replyContent}
                                    onChange={e => setReplyContent(e.target.value)}
                                    placeholder="내용을 입력하세요..."
                                    rows={3}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                                />
                                <div className="flex justify-end mt-2">
                                    <button onClick={handleReply} disabled={submitting || !replyContent.trim()}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors">
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
                            <label className="block text-xs text-gray-400 mb-1.5">제목</label>
                            <input
                                type="text"
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                                placeholder="제목을 입력하세요"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1.5">내용</label>
                            <textarea
                                value={formContent}
                                onChange={e => setFormContent(e.target.value)}
                                placeholder="개선하고 싶은 내용을 자세히 적어주세요..."
                                rows={10}
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setView(selectedPost ? 'detail' : 'list'); setError(''); }}
                                className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">취소</button>
                            <button onClick={view === 'write' ? handleWrite : handleEdit}
                                disabled={submitting || !formTitle.trim() || !formContent.trim()}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                                {submitting ? '저장 중...' : view === 'write' ? '등록' : '수정 완료'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
