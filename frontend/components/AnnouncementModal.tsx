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
    persona: { label: '신규 페르소나', color: 'text-purple-700 bg-purple-100/80 border border-purple-300/60', icon: 'Bot' },
    update:  { label: '업데이트',      color: 'text-indigo-700 bg-indigo-100/80 border border-indigo-300/60', icon: 'Zap' },
    news:    { label: '뉴스',          color: 'text-emerald-700 bg-emerald-100/80 border border-emerald-300/60', icon: 'Newspaper' },
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
                style={{ background: '#FBF8F3', border: '1px solid #E8DDD0', letterSpacing: '-0.02em' }}
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E8DDD0' }}>
                    <div className="flex items-center gap-2.5">
                        <Icon name="Megaphone" size={15} className="text-amber-500" />
                        <span className="font-bold text-sm" style={{ color: '#2D2017' }}>공지사항</span>
                        {unreadCount > 0 && (
                            <span className="text-[10px] bg-rose-400/90 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                            <button
                                onClick={handleReadAll}
                                className="text-xs transition-colors"
                                style={{ color: '#A89080' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#6B4E3D')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#A89080')}
                            >
                                모두 읽음
                            </button>
                        )}
                        <button onClick={onClose} className="transition-colors" style={{ color: '#A89080' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B4E3D'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#A89080'}
                        >
                            <Icon name="X" size={17} />
                        </button>
                    </div>
                </div>

                {/* 목록 */}
                <div className={`overflow-y-auto transition-all duration-300 ${isPlaying ? 'max-h-[80vh]' : 'max-h-[60vh]'}`}>
                    {announcements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16" style={{ color: '#B0A090' }}>
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
                                        style={{ background: '#FFFDF9', border: '1px solid #E8DDD0' }}
                                    >
                                        {/* 카드 헤더 */}
                                        <button
                                            className="w-full text-left px-4 py-3.5"
                                            onClick={() => handleExpand(a.id)}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                {a.isPinned && (
                                                    <Icon name="Pin" size={10} className="text-amber-500 shrink-0" />
                                                )}
                                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0 ${meta.color}`}>
                                                    {meta.label}
                                                </span>
                                                {!isRead && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                                )}
                                            </div>
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-sm font-bold leading-snug" style={{ color: isRead ? '#B0A090' : '#2D2017' }}>
                                                    {a.title}
                                                </span>
                                                <Icon
                                                    name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                                                    size={13}
                                                    className="shrink-0 mt-0.5"
                                                    style={{ color: '#C4B5A5' } as React.CSSProperties}
                                                />
                                            </div>
                                            <p className="text-[10px] mt-1.5" style={{ color: '#B0A090' }}>
                                                {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                                            </p>
                                        </button>

                                        {/* 펼쳐진 본문 */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4">
                                                <div
                                                    className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl px-4 py-3"
                                                    style={{ background: '#F5EFE6', color: '#5C4033', border: '1px solid #E8DDD0' }}
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
                                                                    style={{ background: '#8E6FB7' }}
                                                                    onMouseEnter={e => (e.currentTarget.style.background = '#7A5FA3')}
                                                                    onMouseLeave={e => (e.currentTarget.style.background = '#8E6FB7')}
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
