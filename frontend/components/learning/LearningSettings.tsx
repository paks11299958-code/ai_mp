import React, { useEffect, useState } from 'react';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';

// ⚙️ 설정 (/learning/settings) — S11 (app/learning/PRD.md 5장).
// 알림 시간·학습 요일·알림 수신 방식(이메일 고정, 웹 푸시는 준비 중)을 다룬다.
// ★웹 푸시는 2026-08-11 확정대로 보류 — UI에 노출은 하되 "준비 중" 배지로 비활성 표시,
// 선택 자체를 받지 않는다(서버도 항상 이메일로만 발송).

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const HOUR_OPTIONS = [7, 8, 9, 12, 18, 19, 20, 21, 22];

type Settings = { level: string; notifyHour: number | null; studyDays: number[] };

export const LearningSettings: React.FC = () => {
    const auth = useLearnAuth();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (auth === 'checking') return;
        if (auth === 'guest') { goLoginTo('/learning/settings'); return; }

        fetch('/api/aimp/learning/settings', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '설정을 불러오지 못했습니다.');
                return r.json();
            })
            .then((d: Settings) => setSettings(d))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [auth]);

    const toggleDay = (day: number) => {
        if (!settings) return;
        const studyDays = settings.studyDays.includes(day)
            ? settings.studyDays.filter(d => d !== day)
            : [...settings.studyDays, day].sort();
        setSettings({ ...settings, studyDays });
    };

    const save = () => {
        if (!settings) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        fetch('/api/aimp/learning/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ notifyHour: settings.notifyHour, studyDays: settings.studyDays }),
        })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '저장에 실패했습니다.');
                return r.json();
            })
            .then((d: Settings) => { setSettings(d); setSaved(true); setTimeout(() => setSaved(false), 2000); })
            .catch(e => setError(e.message))
            .finally(() => setSaving(false));
    };

    if (auth === 'checking' || loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-sm text-gray-400">불러오는 중…</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-white/10">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/learning/dashboard'; }} className="flex items-center gap-1.5 h-full text-sm text-indigo-300 font-semibold">
                        ← 대시보드
                    </button>
                    <span className="text-sm font-extrabold">⚙️ 설정</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
                )}

                {settings && (
                    <div className="space-y-6">
                        <section className="bg-white/5 border border-white/10 rounded-xl px-4 py-4">
                            <h2 className="text-sm font-extrabold mb-3">알림 시간</h2>
                            <div className="flex flex-wrap gap-2">
                                {HOUR_OPTIONS.map(h => (
                                    <button
                                        key={h}
                                        onClick={() => setSettings({ ...settings, notifyHour: h })}
                                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                            settings.notifyHour === h
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-white/10 text-gray-300 hover:bg-white/15'
                                        }`}
                                    >
                                        {h}시
                                    </button>
                                ))}
                                <button
                                    onClick={() => setSettings({ ...settings, notifyHour: null })}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                        settings.notifyHour === null
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-white/10 text-gray-300 hover:bg-white/15'
                                    }`}
                                >
                                    끄기
                                </button>
                            </div>
                        </section>

                        <section className="bg-white/5 border border-white/10 rounded-xl px-4 py-4">
                            <h2 className="text-sm font-extrabold mb-3">학습 요일</h2>
                            <div className="flex gap-1.5">
                                {DAY_LABELS.map((label, day) => (
                                    <button
                                        key={day}
                                        onClick={() => toggleDay(day)}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                                            settings.studyDays.includes(day)
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-white/10 text-gray-300 hover:bg-white/15'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="bg-white/5 border border-white/10 rounded-xl px-4 py-4">
                            <h2 className="text-sm font-extrabold mb-3">알림 수신 방식</h2>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-indigo-500/20 border border-indigo-400">
                                    <span className="text-sm font-bold text-white">이메일</span>
                                    <span className="text-xs text-indigo-300">사용 중</span>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 opacity-60">
                                    <span className="text-sm font-bold text-gray-400">웹 푸시</span>
                                    <span className="text-xs text-gray-500">준비 중</span>
                                </div>
                            </div>
                        </section>

                        <button
                            onClick={save}
                            disabled={saving}
                            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                        >
                            {saving ? '저장 중…' : saved ? '저장됨 ✓' : '저장'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};
