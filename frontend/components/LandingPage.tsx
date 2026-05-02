import React, { useState } from 'react';
import { Bot, Menu, X, Bell } from 'lucide-react';
import { Persona } from '../types';
import { Icon } from './Icons';

interface LandingPageProps {
    personas: Persona[];
    isLoading: boolean;
    onStart: () => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
}

export const LandingPage: React.FC<LandingPageProps> = ({ personas, isLoading, onStart, onAnnouncementClick, unreadAnnouncementCount = 0 }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    {/* 로고 */}
                    <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="/aichat_log2.png" alt="logo" className="h-[60px] w-auto" />
                        <span className="text-sm font-bold whitespace-nowrap">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">AI 페르소나</span>
                            <span className="text-gray-100">Chat</span>
                        </span>
                    </a>

                    {/* 데스크톱 버튼 */}
                    <div className="hidden sm:flex items-center gap-3">
                        {onAnnouncementClick && (
                            <button
                                onClick={onAnnouncementClick}
                                className="relative p-2 text-gray-400 hover:text-white transition-colors"
                                title="공지사항"
                            >
                                <Bell size={18} />
                                {unreadAnnouncementCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                                        {unreadAnnouncementCount > 9 ? '9+' : unreadAnnouncementCount}
                                    </span>
                                )}
                            </button>
                        )}
                        <button onClick={onStart} className="text-gray-400 hover:text-white text-sm font-medium transition-colors">로그인</button>
                        <button onClick={onStart} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all">무료 시작</button>
                    </div>

                    {/* 모바일 햄버거 */}
                    <button
                        className="sm:hidden text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
                        onClick={() => setMenuOpen(v => !v)}
                    >
                        {menuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {/* 모바일 드롭다운 */}
                {menuOpen && (
                    <div className="sm:hidden border-t border-gray-800 bg-gray-950 px-4 py-3 flex flex-col gap-2">
                        <button onClick={() => { setMenuOpen(false); onStart(); }} className="w-full text-left text-gray-300 hover:text-white py-2 px-3 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">로그인</button>
                        <button onClick={() => { setMenuOpen(false); onStart(); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 px-3 rounded-lg transition-all">무료 시작</button>
                    </div>
                )}
            </nav>

            <main className="pt-24 pb-16 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                            어떤 AI와{' '}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                                대화할까요?
                            </span>
                        </h1>
                        <p className="text-gray-400 text-lg">페르소나를 선택해 대화를 시작하세요.</p>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center py-20 gap-4">
                            <Bot size={48} className="text-blue-500 animate-bounce" />
                            <p className="text-gray-200 text-sm">AI 페르소나를 불러오는 중입니다...</p>
                            <p className="text-gray-400 text-xs">잠시만 기다려주세요...</p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {personas
                                .filter(p => p.isVisible !== false)
                                .slice()
                                .sort((a, b) => {
                                    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                                    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                                    return tb - ta;
                                })
                                .map((persona) => {
                                    const isNew = persona.createdAt
                                        ? Date.now() - new Date(persona.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
                                        : false;
                                    return (
                                        <button
                                            key={persona.id}
                                            onClick={onStart}
                                            className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 hover:bg-gray-800/50 hover:scale-[1.02] transition-all group"
                                        >
                                            {isNew && (
                                                <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40">
                                                    NEW
                                                </span>
                                            )}
                                            {persona.imageUrl ? (
                                                <img src={persona.imageUrl} alt={persona.name} className="w-[72px] h-[72px] rounded-xl object-cover mb-4 shadow-lg" />
                                            ) : (
                                                <div className={`w-[72px] h-[72px] rounded-xl bg-gradient-to-br ${persona.colorClass} text-white flex items-center justify-center mb-4 shadow-lg`}>
                                                    <Icon name={persona.iconName} size={36} />
                                                </div>
                                            )}
                                            <div className="flex items-baseline gap-2 mb-2">
                                                <h3 className="text-lg font-bold text-gray-100 group-hover:text-white">{persona.name}</h3>
                                                {persona.jobTitle && <span className="text-xs text-gray-400 shrink-0">[{persona.jobTitle}]</span>}
                                            </div>
                                            <p className="text-sm text-gray-400 leading-relaxed">{persona.description}</p>
                                        </button>
                                    );
                                })
                            }
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
