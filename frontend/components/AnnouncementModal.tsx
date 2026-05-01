import React, { useState } from 'react';
import { Announcement } from '../types';
import { Icon } from './Icons';

interface AnnouncementModalProps {
    announcements: Announcement[];
    readIds: Set<number>;
    onRead: (ids: number[]) => void;
    onClose: () => void;
}

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
    persona: { label: '신규 페르소나', color: 'text-purple-400 bg-purple-900/30 border-purple-700/50', icon: 'Bot' },
    update:  { label: '업데이트',      color: 'text-blue-400 bg-blue-900/30 border-blue-700/50',     icon: 'Zap' },
    news:    { label: '뉴스',          color: 'text-green-400 bg-green-900/30 border-green-700/50',   icon: 'Newspaper' },
};

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ announcements, readIds, onRead, onClose }) => {
    const [expandedId, setExpandedId] = useState<number | null>(
        announcements.length > 0 ? announcements[0].id : null
    );

    const handleExpand = (id: number) => {
        setExpandedId(prev => prev === id ? null : id);
        if (!readIds.has(id)) onRead([id]);
    };

    const handleReadAll = () => {
        onRead(announcements.map(a => a.id));
    };

    const unreadCount = announcements.filter(a => !readIds.has(a.id)).length;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onClick={onClose}>
            <div
                className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <Icon name="Megaphone" size={16} className="text-yellow-400" />
                        <span className="font-semibold text-white">공지사항</span>
                        {unreadCount > 0 && (
                            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={handleReadAll}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                모두 읽음
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <Icon name="X" size={18} />
                        </button>
                    </div>
                </div>

                {/* 목록 */}
                <div className="overflow-y-auto max-h-[60vh]">
                    {announcements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                            <Icon name="Megaphone" size={32} className="mb-3 opacity-30" />
                            <p className="text-sm">공지사항이 없습니다.</p>
                        </div>
                    ) : (
                        announcements.map(a => {
                            const meta = CATEGORY_META[a.category] || CATEGORY_META.update;
                            const isExpanded = expandedId === a.id;
                            const isRead = readIds.has(a.id);
                            return (
                                <div
                                    key={a.id}
                                    className={`border-b border-gray-800 last:border-b-0 transition-colors ${isExpanded ? 'bg-gray-800/40' : 'hover:bg-gray-800/20'}`}
                                >
                                    <button
                                        className="w-full text-left px-5 py-3.5"
                                        onClick={() => handleExpand(a.id)}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            {a.isPinned && (
                                                <Icon name="Pin" size={11} className="text-yellow-400 shrink-0" />
                                            )}
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${meta.color}`}>
                                                {meta.label}
                                            </span>
                                            {!isRead && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-sm font-medium leading-snug ${isRead ? 'text-gray-400' : 'text-white'}`}>
                                                {a.title}
                                            </span>
                                            <Icon
                                                name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                                                size={14}
                                                className="text-gray-500 shrink-0"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-600 mt-0.5">
                                            {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                                        </p>
                                    </button>
                                    {isExpanded && (
                                        <div className="px-5 pb-4">
                                            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-800/60 rounded-xl p-3">
                                                {a.content}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
