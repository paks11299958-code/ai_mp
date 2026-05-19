import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, Clock, Loader, CheckCircle, ExternalLink } from 'lucide-react';

interface GolfCourse {
    id: number;
    name: string;
    sido: string;
    sigungu: string;
    address: string;
    bookingUrl: string | null;
    hasAuto: boolean;
}

interface Props {
    onClose: () => void;
}

type Step = 'select' | 'datetime' | 'running' | 'done';

const TIME_PERIODS = [
    { value: 'morning',   label: '오전', desc: '~11:59' },
    { value: 'afternoon', label: '오후', desc: '12:00~16:59' },
    { value: 'evening',   label: '저녁', desc: '17:00~' },
];

export const GolfReserveDialog: React.FC<Props> = ({ onClose }) => {
    const [step, setStep]         = useState<Step>('select');
    const [sidos, setSidos]       = useState<string[]>([]);
    const [sigungus, setSigungus] = useState<string[]>([]);
    const [courses, setCourses]   = useState<GolfCourse[]>([]);
    const [selectedSido, setSelectedSido]     = useState('');
    const [selectedSigungu, setSelectedSigungu] = useState('');
    const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
    const [date, setDate]         = useState('');
    const [timePeriod, setTimePeriod] = useState('morning');
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [result, setResult]     = useState('');

    // 내일 날짜를 기본값으로
    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDate(tomorrow.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        fetch('/api/golf/sido', { credentials: 'include' })
            .then(r => r.json())
            .then(data => setSidos(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedSido) { setSigungus([]); return; }
        fetch(`/api/golf/sigungu?sido=${encodeURIComponent(selectedSido)}`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setSigungus(Array.isArray(data) ? data : []))
            .catch(() => {});
        setSelectedSigungu('');
        setCourses([]);
        setSelectedCourse(null);
    }, [selectedSido]);

    useEffect(() => {
        if (!selectedSigungu) { setCourses([]); return; }
        fetch(`/api/golf/courses?sido=${encodeURIComponent(selectedSido)}&sigungu=${encodeURIComponent(selectedSigungu)}`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setCourses(Array.isArray(data) ? data : []))
            .catch(() => {});
        setSelectedCourse(null);
    }, [selectedSigungu]);

    const handleCourseSelect = (course: GolfCourse) => {
        setSelectedCourse(course);
        setStep('datetime');
        setError('');
    };

    const handleOpenBooking = () => {
        if (selectedCourse?.bookingUrl) {
            window.open(selectedCourse.bookingUrl, '_blank');
        }
    };

    const handleAutoReserve = async () => {
        if (!selectedCourse || !date) return;
        setLoading(true);
        setError('');
        setStep('running');
        try {
            const res = await fetch('/api/golf/reserve', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId: selectedCourse.id, date, timePeriod }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '예약 요청 실패');
            setResult(data.message || '예약 진행 중입니다.');
            setStep('done');
        } catch (e: any) {
            setError(e.message);
            setStep('datetime');
        } finally {
            setLoading(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-green-400" />
                        <span className="text-white font-semibold text-sm">골프장 예약</span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* STEP 1: 골프장 선택 */}
                    {(step === 'select') && (
                        <>
                            <p className="text-gray-400 text-xs">시도 → 시군구 → 골프장 순으로 선택하세요.</p>

                            {/* 시도 */}
                            <div>
                                <label className="text-gray-400 text-xs mb-1 block">시도</label>
                                <select
                                    value={selectedSido}
                                    onChange={e => setSelectedSido(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                    <option value="">-- 선택 --</option>
                                    {sidos.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* 시군구 */}
                            {selectedSido && (
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">시군구</label>
                                    <select
                                        value={selectedSigungu}
                                        onChange={e => setSelectedSigungu(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                    >
                                        <option value="">-- 선택 --</option>
                                        {sigungus.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* 골프장 목록 */}
                            {courses.length > 0 && (
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">골프장</label>
                                    <div className="space-y-2 max-h-52 overflow-y-auto">
                                        {courses.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => handleCourseSelect(c)}
                                                className="w-full text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-3 py-3 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white text-sm font-medium">{c.name}</span>
                                                    {c.hasAuto && (
                                                        <span className="text-[10px] bg-green-900 text-green-400 px-2 py-0.5 rounded-full">자동예약</span>
                                                    )}
                                                </div>
                                                <p className="text-gray-500 text-xs mt-0.5">{c.address}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* STEP 2: 날짜/시간 선택 */}
                    {step === 'datetime' && selectedCourse && (
                        <>
                            <div className="bg-gray-800 rounded-xl px-4 py-3">
                                <p className="text-white font-medium text-sm">{selectedCourse.name}</p>
                                <p className="text-gray-500 text-xs mt-0.5">{selectedCourse.address}</p>
                            </div>

                            {/* 날짜 */}
                            <div>
                                <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                    <Calendar size={12} /> 예약 날짜
                                </label>
                                <input
                                    type="date"
                                    value={date}
                                    min={today}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                            </div>

                            {/* 시간대 (자동예약 골프장만) */}
                            {selectedCourse.hasAuto && (
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                        <Clock size={12} /> 시간대
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {TIME_PERIODS.map(p => (
                                            <button
                                                key={p.value}
                                                onClick={() => setTimePeriod(p.value)}
                                                className={`py-2 rounded-xl text-xs font-medium transition-colors border ${
                                                    timePeriod === p.value
                                                        ? 'bg-green-600 border-green-500 text-white'
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                <div>{p.label}</div>
                                                <div className="text-[10px] opacity-70">{p.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && <p className="text-red-400 text-xs">{error}</p>}

                            {/* 버튼 */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => { setStep('select'); setSelectedCourse(null); }}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors"
                                >
                                    뒤로
                                </button>
                                {selectedCourse.hasAuto ? (
                                    <button
                                        onClick={handleAutoReserve}
                                        disabled={!date || loading}
                                        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                                    >
                                        자동 예약
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleOpenBooking}
                                        disabled={!selectedCourse.bookingUrl}
                                        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <ExternalLink size={13} />
                                        예약 사이트
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* STEP 3: 진행 중 */}
                    {step === 'running' && (
                        <div className="text-center py-8 space-y-3">
                            <Loader size={32} className="animate-spin text-green-400 mx-auto" />
                            <p className="text-white text-sm">예약 진행 중...</p>
                            <p className="text-gray-500 text-xs">가장 빠른 티타임을 찾아 예약합니다.</p>
                        </div>
                    )}

                    {/* STEP 4: 완료 */}
                    {step === 'done' && (
                        <div className="text-center py-8 space-y-3">
                            <CheckCircle size={40} className="text-green-400 mx-auto" />
                            <p className="text-white font-medium">예약 요청 완료</p>
                            <p className="text-gray-400 text-xs">{result}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
                            >
                                확인
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
