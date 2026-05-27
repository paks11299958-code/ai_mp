import React, { useState } from 'react';
import { Persona, User } from '../types';
import { Icon } from './Icons';
import { getStage, getStageProgress, getXpToNextStage, STAGES } from '../utils/level';

interface SidebarProps {
    personas: Persona[];
    activePersonaId: string;
    onSelectPersona: (id: string) => void;
    isOpen: boolean;
    newUi?: boolean;
    setIsOpen: (isOpen: boolean) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onAdminClick: () => void;
    onAnnouncementClick: () => void;
    unreadAnnouncementCount: number;
    onReorder: (index: number, direction: 'up' | 'down') => void;
    user: User | null;
    onLogout: () => void;
    onGoHome: () => void;
    onProfileClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    personas, activePersonaId, onSelectPersona,
    isOpen, setIsOpen, isCollapsed, onToggleCollapse,
    onAdminClick, onAnnouncementClick, unreadAnnouncementCount, onReorder,
    user, onLogout, onGoHome, onProfileClick, newUi = false,
}) => {
    const nb = newUi ? 'rgba(255,255,255,0.65)' : '';
    const nbBorder = newUi ? '#F0E9DE' : '';
    const [searchQuery, setSearchQuery] = useState('');
    const filteredPersonas = searchQuery.trim()
        ? personas.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
          )
        : personas;

    // 접힌 상태 렌더링
    if (isCollapsed) {
        return (
            <div className="hidden md:flex flex-col w-16 shrink-0 h-full"
                style={{ background: nb || '#111827', borderRight: `1px solid ${nbBorder || '#1f2937'}` }}>
                {/* 펼치기 버튼 */}
                <div className={`h-14 flex items-center justify-center shrink-0 ${newUi ? 'border-b border-[#F0E9DE]' : 'border-b border-gray-800'}`}>
                    <button
                        onClick={onToggleCollapse}
                        className={`p-2 rounded-lg transition-colors ${newUi ? 'text-[#9089A1] hover:text-[#8E6FB7] hover:bg-[#F5E6F7]' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                        title="사이드바 펼치기"
                    >
                        <Icon name="Menu" size={18} />
                    </button>
                </div>

                {/* 아이콘만 목록 */}
                <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1.5">
                    {personas.map(persona => {
                        const isActive = persona.id === activePersonaId;
                        return (
                            <button
                                key={persona.id}
                                onClick={() => onSelectPersona(persona.id)}
                                title={persona.name}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all overflow-hidden shrink-0
                                    ${isActive ? (newUi ? 'ring-2 ring-[#8E6FB7]/50 shadow-lg' : 'ring-2 ring-white/30 shadow-lg') : 'opacity-60 hover:opacity-100'}`}
                            >
                                {persona.imageUrl ? (
                                    <img src={persona.imageUrl} alt={persona.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${persona.colorClass} text-white`}>
                                        <Icon name={persona.iconName} size={18} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 하단 아이콘들 */}
                <div className={`py-3 flex flex-col items-center gap-2 shrink-0 ${newUi ? 'border-t border-[#F0E9DE]' : 'border-t border-gray-800'}`}>
                    <button onClick={onAnnouncementClick} className={`relative p-2 rounded-lg transition-colors ${newUi ? 'text-[#9089A1] hover:text-[#8E6FB7] hover:bg-[#F5E6F7]' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`} title="공지사항">
                        <Icon name="Bell" size={16} />
                        {unreadAnnouncementCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                                {unreadAnnouncementCount > 9 ? '9+' : unreadAnnouncementCount}
                            </span>
                        )}
                    </button>
                    {user?.role === 'ADMIN' && (
                        <button onClick={onAdminClick} className={`p-2 rounded-lg transition-colors ${newUi ? 'text-[#9089A1] hover:text-[#8E6FB7] hover:bg-[#F5E6F7]' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`} title="관리자 설정">
                            <Icon name="Settings" size={16} />
                        </button>
                    )}
                    <button onClick={onLogout} className={`p-2 rounded-lg transition-colors ${newUi ? 'text-[#9089A1] hover:text-red-400 hover:bg-[#F5E6F7]' : 'text-gray-500 hover:text-red-400 hover:bg-gray-800'}`} title="로그아웃">
                        <Icon name="LogOut" size={16} />
                    </button>
                </div>
            </div>
        );
    }

    // 펼쳐진 상태 렌더링
    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div
                className={`fixed md:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
                style={{ background: nb || '#111827', borderRight: `1px solid ${nbBorder || '#1f2937'}` }}
            >
                <div className={`h-14 px-4 flex justify-between items-center shrink-0 ${newUi ? 'border-b border-[#F0E9DE]' : 'border-b border-gray-800'}`}>
                    <button
                        onClick={onGoHome}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
                        title="메인 페이지로"
                    >
                        <h1 className={`text-base font-bold bg-clip-text text-transparent truncate ${newUi ? 'bg-gradient-to-r from-[#8E6FB7] to-[#E48BB0]' : 'bg-gradient-to-r from-blue-400 to-purple-500'}`}>
                            AI 페르소나
                        </h1>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full border shrink-0 ${newUi ? 'bg-[#F5E6F7] text-[#8E6FB7] border-[#D4B8E8]' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                            {personas.length}개
                        </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={onToggleCollapse}
                            className={`hidden md:flex p-1.5 rounded-lg transition-colors ${newUi ? 'text-[#9089A1] hover:text-[#8E6FB7] hover:bg-[#F5E6F7]' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                            title="사이드바 접기"
                        >
                            <Icon name="ArrowLeftToLine" size={16} />
                        </button>
                        <button
                            className={`md:hidden p-1 ${newUi ? 'text-[#9089A1] hover:text-[#2D2438]' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setIsOpen(false)}
                        >
                            <Icon name="X" size={20} />
                        </button>
                    </div>
                </div>

                {personas.length > 4 && (
                    <div className={`px-3 py-2 ${newUi ? 'border-b border-[#F0E9DE]' : 'border-b border-gray-800'}`}>
                        <div className="relative">
                            <Icon name="Search" size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${newUi ? 'text-[#9089A1]' : 'text-gray-500'}`} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="페르소나 검색..."
                                className={`w-full rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 ${newUi ? 'bg-white border border-[#EAE2D3] text-[#2D2438] placeholder-[#9089A1] focus:ring-[#8E6FB7]' : 'bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:ring-blue-500'}`}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 ${newUi ? 'text-[#9089A1] hover:text-[#2D2438]' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Icon name="X" size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredPersonas.length === 0 && searchQuery ? (
                        <p className={`text-xs text-center py-8 ${newUi ? 'text-[#9089A1]' : 'text-gray-600'}`}>검색 결과 없음</p>
                    ) : filteredPersonas.map((persona, index) => {
                        const originalIndex = personas.indexOf(persona);
                        const isActive = persona.id === activePersonaId;
                        return (
                            <div
                                key={persona.id}
                                className={`relative group rounded-xl transition-all duration-200 ${
                                    isActive
                                        ? newUi ? 'bg-[#F5E6F7] shadow-sm' : 'bg-gray-800 shadow-md'
                                        : newUi ? 'hover:bg-[#FAF5FF]' : 'hover:bg-gray-800/50'
                                }`}
                            >
                                {isActive && (
                                    <div className={`absolute inset-0 opacity-10 bg-gradient-to-r ${persona.colorClass} rounded-xl pointer-events-none`} />
                                )}
                                <div className="flex items-center w-full p-2">
                                    <div
                                        className="flex-1 flex items-center cursor-pointer pl-1 min-w-0"
                                        onClick={() => {
                                            onSelectPersona(persona.id);
                                            if (window.innerWidth < 768) setIsOpen(false);
                                        }}
                                    >
                                        {persona.imageUrl ? (
                                            <img
                                                src={persona.imageUrl}
                                                alt={persona.name}
                                                className={`w-9 h-9 rounded-lg object-cover mr-3 shrink-0 border-2 transition-all ${
                                                    isActive
                                                        ? newUi ? 'border-[#B49AC9]' : 'border-white/40'
                                                        : 'border-transparent'
                                                }`}
                                            />
                                        ) : (
                                            <div className={`p-2 rounded-lg mr-3 shrink-0 transition-colors
                                                ${isActive
                                                    ? `bg-gradient-to-br ${persona.colorClass} text-white`
                                                    : newUi ? 'bg-[#F0E9DE] text-[#8E6FB7]' : 'bg-gray-800 text-gray-400 group-hover:text-gray-200'}`}>
                                                <Icon name={persona.iconName} size={18} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-1.5 truncate">
                                                <h3 className={`font-medium shrink-0 text-sm ${
                                                    isActive
                                                        ? newUi ? 'text-[#8E6FB7]' : 'text-white'
                                                        : newUi ? 'text-[#2D2438]' : 'text-gray-300'
                                                }`}>{persona.name}</h3>
                                                {persona.jobTitle && <span className={`text-[10px] truncate ${newUi ? 'text-[#9089A1]' : 'text-gray-500'}`}>[{persona.jobTitle}]</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {!searchQuery && (
                                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                                            <button
                                                onClick={e => { e.stopPropagation(); onReorder(originalIndex, 'up'); }}
                                                disabled={originalIndex === 0}
                                                className={`p-1 disabled:opacity-20 transition-colors ${newUi ? 'text-[#9089A1] hover:text-[#8E6FB7]' : 'text-gray-500 hover:text-white'}`}
                                            >
                                                <Icon name="ChevronUp" size={14} />
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); onReorder(originalIndex, 'down'); }}
                                                disabled={originalIndex === personas.length - 1}
                                                className={`p-1 disabled:opacity-20 transition-colors ${newUi ? 'text-[#9089A1] hover:text-[#8E6FB7]' : 'text-gray-500 hover:text-white'}`}
                                            >
                                                <Icon name="ChevronDown" size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={`p-3 shrink-0 ${newUi ? 'border-t border-[#F0E9DE]' : 'border-t border-gray-800'}`}>
                    {user && (() => {
                        const xp = user.personaXp?.[activePersonaId] ?? 0;
                        const stage = getStage(xp);
                        const progress = getStageProgress(xp);
                        const toNext = getXpToNextStage(xp);
                        const isMax = stage.stage === STAGES.length;
                        return (
                            <div className="mb-3 px-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8E6FB7] to-[#E48BB0] flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2">
                                            {(user.username || user.email)[0].toUpperCase()}
                                        </div>
                                        <span className={`text-sm truncate ${newUi ? 'text-[#2D2438]' : 'text-gray-300'}`}>
                                            {user.username || user.email}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                                        {onProfileClick && (
                                            <button
                                                onClick={onProfileClick}
                                                className={`p-1.5 rounded-md transition-colors ${newUi ? 'text-[#9089A1] hover:bg-[#F5E6F7] hover:text-[#8E6FB7]' : 'hover:bg-gray-800 text-gray-500 hover:text-blue-400'}`}
                                                title="내정보"
                                            >
                                                <Icon name="UserCircle" size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={onLogout}
                                            className={`p-1.5 rounded-md transition-colors ${newUi ? 'text-[#9089A1] hover:bg-[#FDE8E8] hover:text-red-400' : 'hover:bg-gray-800 text-gray-500 hover:text-red-400'}`}
                                            title="로그아웃"
                                        >
                                            <Icon name="LogOut" size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className={`mt-2 rounded-xl px-3 py-2 ${newUi ? 'bg-[#F5E6F7]/60 border border-[#EAE2D3]' : 'bg-gray-800/60'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-bold bg-gradient-to-r ${stage.color} bg-clip-text text-transparent`}>
                                            {stage.stage}Lv · {stage.name}
                                        </span>
                                        <span className={`text-[10px] ${newUi ? 'text-[#9089A1]' : 'text-gray-600'}`}>{xp} XP</span>
                                    </div>
                                    <p className={`text-[10px] leading-relaxed mb-2 ${newUi ? 'text-[#6B5F7A]' : 'text-gray-500'}`}>
                                        {stage.description}
                                    </p>
                                    <div className={`w-full h-1 rounded-full overflow-hidden ${newUi ? 'bg-[#EAE2D3]' : 'bg-gray-700'}`}>
                                        <div
                                            className={`h-full bg-gradient-to-r ${stage.color} rounded-full transition-all duration-500`}
                                            style={{ width: `${isMax ? 100 : progress}%` }}
                                        />
                                    </div>
                                    {!isMax && (
                                        <p className={`text-[10px] mt-1 ${newUi ? 'text-[#9089A1]' : 'text-gray-600'}`}>
                                            다음 Lv까지 <span className={newUi ? 'text-[#8E6FB7] font-medium' : 'text-gray-400'}>{toNext}개</span> 더
                                        </p>
                                    )}
                                    {isMax && (
                                        <p className="text-[10px] text-yellow-600 mt-1">전설의 경지에 도달했습니다</p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                    <div className={`flex justify-between items-center text-xs ${newUi ? 'text-[#9089A1]' : 'text-gray-500'}`}>
                        <span className="text-[10px]">Gemini 2.5 Flash</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={onAnnouncementClick}
                                className={`relative p-1.5 rounded-md transition-colors ${newUi ? 'hover:bg-[#F5E6F7] hover:text-[#8E6FB7]' : 'hover:bg-gray-800 hover:text-gray-300'}`}
                                title="공지사항"
                            >
                                <Icon name="Bell" size={16} />
                                {unreadAnnouncementCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                                        {unreadAnnouncementCount > 9 ? '9+' : unreadAnnouncementCount}
                                    </span>
                                )}
                            </button>
                            {user?.role === 'ADMIN' && (
                                <button
                                    onClick={onAdminClick}
                                    className={`p-1.5 rounded-md transition-colors ${newUi ? 'hover:bg-[#F5E6F7] hover:text-[#8E6FB7]' : 'hover:bg-gray-800 hover:text-gray-300'}`}
                                    title="관리자 설정"
                                >
                                    <Icon name="Settings" size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
