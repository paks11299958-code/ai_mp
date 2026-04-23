import React from 'react';
import { Bot, Zap, BrainCircuit, MessageSquare, ShieldCheck, ArrowRight, Github } from 'lucide-react';

interface LandingPageProps {
    onStart: () => void;
}

const features = [
    {
        icon: <BrainCircuit size={24} className="text-blue-400" />,
        title: '다중 AI 페르소나',
        description: '코딩 전문가, 작가, 번역가 등 목적에 맞는 페르소나를 선택해 더 정확한 답변을 받으세요.',
        bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
        icon: <MessageSquare size={24} className="text-purple-400" />,
        title: '대화 기록 저장',
        description: '모든 대화가 자동으로 저장됩니다. 언제 어디서든 이전 대화를 이어갈 수 있습니다.',
        bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
        icon: <Zap size={24} className="text-amber-400" />,
        title: 'Gemini 2.5 Flash',
        description: 'Google의 최신 Gemini 2.5 Flash 모델을 기반으로 빠르고 정확한 응답을 제공합니다.',
        bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
        icon: <ShieldCheck size={24} className="text-emerald-400" />,
        title: '안전한 데이터 관리',
        description: '계정으로 로그인하면 모든 대화와 설정이 안전하게 보호됩니다.',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
];

const personas = [
    { name: '일반 어시스턴트', color: 'from-blue-500 to-cyan-500', desc: '일상적인 질문과 대화' },
    { name: '코딩 전문가',   color: 'from-violet-500 to-purple-500', desc: '코드 작성 및 디버깅' },
    { name: '창작 작가',     color: 'from-pink-500 to-rose-500',   desc: '글쓰기 및 창작 지원' },
    { name: '번역 전문가',   color: 'from-orange-500 to-amber-500', desc: '다국어 번역 및 교정' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 overflow-x-hidden">

            {/* Navbar */}
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

            {/* Hero */}
            <section className="relative pt-32 pb-24 px-4 overflow-hidden">
                {/* Background blobs */}
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob pointer-events-none" />
                <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob pointer-events-none" style={{ animationDelay: '2s' }} />
                <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob pointer-events-none" style={{ animationDelay: '4s' }} />

                <div className="max-w-4xl mx-auto text-center relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        Gemini 2.5 Flash 기반
                    </div>

                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
                        목적에 맞는{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                            AI와 대화하세요
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        다양한 페르소나를 선택해 더 전문적인 AI 대화를 경험하세요.
                        코딩, 글쓰기, 번역 등 상황에 딱 맞는 AI가 기다립니다.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button
                            onClick={onStart}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold px-8 py-4 rounded-full text-lg transition-all shadow-xl shadow-blue-500/20 group"
                        >
                            무료로 시작하기
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={onStart}
                            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-semibold px-8 py-4 rounded-full text-lg transition-all"
                        >
                            로그인
                        </button>
                    </div>

                    {/* Persona preview */}
                    <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                        {personas.map((p) => (
                            <div
                                key={p.name}
                                className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left hover:border-gray-600 transition-colors cursor-default"
                            >
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.color} mb-3`} />
                                <div className="text-sm font-semibold text-gray-200">{p.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{p.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-24 px-4 bg-gray-900/50">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                            왜 AI 페르소나인가요?
                        </h2>
                        <p className="text-gray-400 text-lg max-w-xl mx-auto">
                            단순한 AI 채팅을 넘어, 목적에 최적화된 대화 경험을 제공합니다.
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
                        {features.map((f) => (
                            <div
                                key={f.title}
                                className={`border rounded-2xl p-6 ${f.bg} hover:scale-[1.02] transition-transform`}
                            >
                                <div className="w-12 h-12 bg-gray-900/50 rounded-xl flex items-center justify-center mb-4">
                                    {f.icon}
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="py-24 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-3xl p-12">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                            지금 바로 시작하세요
                        </h2>
                        <p className="text-gray-400 mb-8 text-lg">
                            회원가입 후 즉시 모든 페르소나를 무료로 이용할 수 있습니다.
                        </p>
                        <button
                            onClick={onStart}
                            className="inline-flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 font-bold px-8 py-4 rounded-full text-lg transition-all shadow-xl group"
                        >
                            무료 회원가입
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-800 py-10 px-4">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-lg text-white">
                            <Bot size={16} />
                        </div>
                        <span className="font-bold text-gray-300">AI 페르소나</span>
                    </div>
                    <p className="text-gray-600 text-sm">
                        &copy; {new Date().getFullYear()} AI 페르소나. Powered by Gemini 2.5 Flash.
                    </p>
                    <button
                        onClick={onStart}
                        className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        로그인 / 회원가입
                    </button>
                </div>
            </footer>
        </div>
    );
};
