import React from 'react';
import { Persona, User } from '../types';
import { Icon } from './Icons';
import { getStage, getStageProgress, getXpToNextStage, STAGES } from '../utils/level';

interface SidebarProps {
    personas: Persona[];
    activePersonaId: string;
    onSelectPersona: (id: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    onAdminClick: () => void;
    onReorder: (index: number, direction: 'up' | 'down') => void;
    user: User | null;
    onLogout: () => void;
    onGoHome: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    personas, activePersonaId, onSelectPersona,
    isOpen, setIsOpen, onAdminClick, onReorder,
    user, onLogout, onGoHome,
}) => {
    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className={`
                fixed md:static inset-y-0 left-0 z-30 w-72 bg-gray-900 border-r border-gray-800
                transform transition-transform duration-300 ease-in-out flex flex-col
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-5 border-b border-gray-800 flex justify-between items-center shrink-0">
                    <button
                        onClick={onGoHome}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        title="메인 페이지로"
                    >
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                            AI 페르소나
                        </h1>
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-800 text-gray-300 rounded-full border border-gray-700">
                            {personas.length}개
                        </span>
                    </button>
                    <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsOpen(false)}>
                        <Icon name="X" size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {personas.map((persona, index) => {
                        const isActive = persona.id === activePersonaId;
                        return (
                            <div
                                key={persona.id}
                                className={`relative group rounded-xl transition-all duration-200
                                    ${isActive ? 'bg-gray-800 shadow-md' : 'hover:bg-gray-800/50'}`}
                            >
                                {isActive && (
                                    <div className={`absolute inset-0 opacity-10 bg-gradient-to-r ${persona.colorClass} rounded-xl pointer-events-none`} />
                                )}
                                <div className="flex items-center w-full p-2">
                                    <div
                                        className="flex-1 flex items-center cursor-pointer pl-1"
                                        onClick={() => {
                                            onSelectPersona(persona.id);
                                            if (window.innerWidth < 768) setIsOpen(false);
                                        }}
                                    >
                                        <div className={`p-2 rounded-lg mr-3 shrink-0 transition-colors
                                            ${isActive ? `bg-gradient-to-br ${persona.colorClass} text-white` : 'bg-gray-800 text-gray-400 group-hover:text-gray-200'}`}>
                                            <Icon name={persona.iconName} size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-medium truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                                {persona.name}
                                            </h3>
                                            <p className="text-xs text-gray-500 truncate mt-0.5">{persona.description}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                                        <button
                                            onClick={e => { e.stopPropagation(); onReorder(index, 'up'); }}
                                            disabled={index === 0}
                                            className="p-1 text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
                                        >
                                            <Icon name="ChevronUp" size={16} />
                                        </button>
                                        <button
                                            onClick={e => { e.stopPropagation(); onReorder(index, 'down'); }}
                                            disabled={index === personas.length - 1}
                                            className="p-1 text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
                                        >
                                            <Icon name="ChevronDown" size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-gray-800 shrink-0">
                    {user && (() => {
                        const xp = user.xp ?? 0;
                        const stage = getStage(xp);
                        const progress = getStageProgress(xp);
                        const toNext = getXpToNextStage(xp);
                        const isMax = stage.stage === STAGES.length;
                        return (
                            <div className="mb-3 px-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2">
                                            {(user.username || user.email)[0].toUpperCase()}
                                        </div>
                                        <span className="text-sm text-gray-300 truncate">
                                            {user.username || user.email}
                                        </span>
                                    </div>
                                    <button
                                        onClick={onLogout}
                                        className="p-1.5 rounded-md hover:bg-gray-800 text-gray-500 hover:text-red-400 transition-colors shrink-0 ml-2"
                                        title="로그아웃"
                                    >
                                        <Icon name="LogOut" size={16} />
                                    </button>
                                </div>

                                {/* 단계 이름 + 설명 */}
                                <div className="mt-2 bg-gray-800/60 rounded-xl px-3 py-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-bold bg-gradient-to-r ${stage.color} bg-clip-text text-transparent`}>
                                            {stage.stage}단계 · {stage.name}
                                        </span>
                                        <span className="text-[10px] text-gray-600">{xp} XP</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 leading-relaxed mb-2">
                                        {stage.description}
                                    </p>
                                    {/* 진행 바 */}
                                    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full bg-gradient-to-r ${stage.color} rounded-full transition-all duration-500`}
                                            style={{ width: `${isMax ? 100 : progress}%` }}
                                        />
                                    </div>
                                    {!isMax && (
                                        <p className="text-[10px] text-gray-600 mt-1">
                                            다음 단계까지 <span className="text-gray-400">{toNext}개</span> 더
                                        </p>
                                    )}
                                    {isMax && (
                                        <p className="text-[10px] text-yellow-600 mt-1">전설의 경지에 도달했습니다</p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                    <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Gemini 2.5 Flash 기반</span>
                        {user?.role === 'ADMIN' && (
                            <button
                                onClick={onAdminClick}
                                className="p-1.5 rounded-md hover:bg-gray-800 hover:text-gray-300 transition-colors"
                                title="관리자 설정"
                            >
                                <Icon name="Settings" size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
