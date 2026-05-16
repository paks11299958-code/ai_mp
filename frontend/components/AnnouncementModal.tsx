import React, { useState } from 'react';
import { Announcement } from '../types';
import { Icon } from './Icons';
import { Play } from 'lucide-react';

interface AnnouncementModalProps {
    announcements: Announcement[];
    readIds: Set<number>;
    onRead: (ids: number[]) => void;
    onClose: () => void;
}

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
    persona: { label: '신규 페르소나', color: 'text-purple-300 bg-purple-900/20 border border-purple-700/40', icon: 'Bot' },
    update:  { label: '업데이트',      color: 'text-blue-300 bg-blue-900/20 border border-blue-700/40',     icon: 'Zap' },
    news:    { label: '뉴스',          color: 'text-emerald-300 bg-emerald-900/20 border border-emerald-700/40', icon: 'Newspaper' },
};

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ announcements, readIds, onRead, onClose }) => {
    const [expandedId, setExpandedId] = useState<number | null>(
        announcements.length > 0 ? announcements[0].id : null
    );
    const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);

    const handleExpand = (id: number) => {
        setExpandedId(prev => prev === id ? null : id);
        if (!readIds.has(id)) onRead([id]);
    };

    const handleReadAll = () => onRead(announcements.map(a => a.id));

    const unreadCount = announcements.filter(a => !readIds.has(a.id)).length;
    const isPlaying = playingVideoId !== null;

    return (
        <div
            className={`fixed inset-0 z-50 flex justify-center px-4 transition-all duration-300 ${isPlaying ? 'items-center' : 'items-start pt-16'}`}
            onClick={onClose}
        >
            <div
                className={`w-full rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${isPlaying ? 'max-w-xl' : 'max-w-md'}`}
                style={{ background: '#0e1117', border: '1px solid #1e2330', letterSpacing: '-0.02em' }}
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e2330' }}>
                    <div className="flex items-center gap-2.5">
                        <Icon name="Megaphone" size={15} className="text-yellow-500" />
                        <span className="font-bold text-white text-sm">공지사항</span>
                        {unreadCount > 0 && (
                            <span className="text-[10px] bg-red-500/90 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                            <button
                                onClick={handleReadAll}
                                className="text-xs transition-colors"
                                style={{ color: '#666' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                            >
                                모두 읽음
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors">
                            <Icon name="X" size={17} />
                        </button>
                    </div>
                </div>

                {/* 목록 */}
                <div className={`overflow-y-auto transition-all duration-300 ${isPlaying ? 'max-h-[80vh]' : 'max-h-[60vh]'}`}>
                    {announcements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16" style={{ color: '#444' }}>
                            <Icon name="Megaphone" size={28} className="mb-3 opacity-30" />
                            <p className="text-sm">공지사항이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="p-3 space-y-2">
                            {announcements.map(a => {
                                const meta = CATEGORY_META[a.category] || CATEGORY_META.update;
                                const isExpanded = expandedId === a.id;
                                const isRead = readIds.has(a.id);
                                return (
                                    <div
                                        key={a.id}
                                        className="rounded-xl overflow-hidden transition-all duration-200"
                                        style={{ background: '#161b27', border: '1px solid #1e2740' }}
                                    >
                                        {/* 카드 헤더 */}
                                        <button
                                            className="w-full text-left px-4 py-3.5"
                                            onClick={() => handleExpand(a.id)}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                {a.isPinned && (
                                                    <Icon name="Pin" size={10} className="text-yellow-500 shrink-0" />
                                                )}
                                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0 ${meta.color}`}>
                                                    {meta.label}
                                                </span>
                                                {!isRead && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                )}
                                            </div>
                                            <div className="flex items-start justify-between gap-2">
                                                <span className={`text-sm font-bold leading-snug ${isRead ? 'text-gray-500' : 'text-white'}`}>
                                                    {a.title}
                                                </span>
                                                <Icon
                                                    name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                                                    size={13}
                                                    className="text-gray-600 shrink-0 mt-0.5"
                                                />
                                            </div>
                                            <p className="text-[10px] mt-1.5" style={{ color: '#666' }}>
                                                {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                                            </p>
                                        </button>

                                        {/* 펼쳐진 본문 */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4">
                                                <div
                                                    className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl px-4 py-3"
                                                    style={{ background: '#0b0e16', color: '#b0b8cc', border: '1px solid #1a2035' }}
                                                >
                                                    {a.content}
                                                </div>
                                                {a.category === 'persona' && a.persona && (a.persona.introVideoUrl || a.persona.imageUrl) && (
                                                    <div className="mt-3">
                                                        {playingVideoId === a.id ? (
                                                            <div className="rounded-xl overflow-hidden bg-black">
                                                                {a.persona.introVideoUrl ? (
                                                                    <video
                                                                        src={a.persona.introVideoUrl}
                                                                        autoPlay
                                                                        controls
                                                                        className="w-full max-h-96 object-contain"
                                                                    />
                                                                ) : (
                                                                    <img
                                                                        src={a.persona.imageUrl!}
                                                                        alt={a.persona.name}
                                                                        className="w-full max-h-96 object-contain"
                                                                    />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex justify-end">
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); setPlayingVideoId(a.id); }}
                                                                    className="flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-semibold rounded-lg transition-colors"
                                                                    style={{ background: '#4c1d95' }}
                                                                    onMouseEnter={e => (e.currentTarget.style.background = '#5b21b6')}
                                                                    onMouseLeave={e => (e.currentTarget.style.background = '#4c1d95')}
                                                                >
                                                                    <Play size={12} />
                                                                    소개영상
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
