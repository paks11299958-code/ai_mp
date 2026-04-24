import React from 'react';
import { Bot } from 'lucide-react';
import { Persona } from '../types';
import { Icon } from './Icons';

interface LandingPageProps {
    personas: Persona[];
    isLoading: boolean;
    onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ personas, isLoading, onStart }) => {
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
                        <button
                            onClick={onStart}
                            className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            로그인
                        </button>
                        <button
                            onClick={onStart}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all shadow-lg shadow-blue-500/20"
                        >
                            무료 시작
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
                            <Bot size={48} className="text-blue-500 animate-bounce" />
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {personas.map((persona) => (
                                <button
                                    key={persona.id}
                                    onClick={onStart}
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
