import React from 'react';
import { Bot, LogOut, Settings } from 'lucide-react';
import { Persona, User } from '../types';
import { Icon } from './Icons';

interface MainPageProps {
    personas: Persona[];
    isLoading: boolean;
    user: User;
    onSelectPersona: (personaId: string) => void;
    onLogout: () => void;
    onAdminClick: () => void;
}

export const MainPage: React.FC<MainPageProps> = ({
    personas,
    isLoading,
    user,
    onSelectPersona,
    onLogout,
    onAdminClick,
}) => {
    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-lg text-white">
                            <Bot size={20} />
                        </div>
                        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            AI 페르소나
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400 hidden sm:block">
                            {user.username || user.email}
                        </span>
                        {user.role === 'ADMIN' && (
                            <button
                                onClick={onAdminClick}
                                className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
                            >
                                <Settings size={16} />
                                관리
                            </button>
                        )}
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
                        >
                            <LogOut size={16} />
                            로그아웃
                        </button>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-16 px-4">
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
                        <div className="flex justify-center py-20">
                            <div className="text-center">
                                <Bot size={48} className="text-blue-500 animate-bounce mx-auto mb-4" />
                                <p className="text-gray-400">페르소나 로딩 중...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {personas.map((persona) => (
                                <button
                                    key={persona.id}
                                    onClick={() => onSelectPersona(persona.id)}
                                    className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 hover:bg-gray-800/50 hover:scale-[1.02] transition-all group"
                                >
                                    {persona.imageUrl ? (
                                        <img
                                            src={persona.imageUrl}
                                            alt={persona.name}
                                            className="w-12 h-12 rounded-xl object-cover mb-4 shadow-lg"
                                        />
                                    ) : (
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${persona.colorClass} text-white flex items-center justify-center mb-4 shadow-lg`}>
                                            <Icon name={persona.iconName} size={24} />
                                        </div>
                                    )}
                                    <h3 className="text-lg font-bold text-gray-100 mb-2 group-hover:text-white">
                                        {persona.name}
                                    </h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        {persona.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
