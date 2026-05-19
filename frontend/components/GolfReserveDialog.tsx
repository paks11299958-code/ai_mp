import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, Clock, Loader, CheckCircle, ExternalLink, KeyRound, AlarmClock, List } from 'lucide-react';

interface GolfCourse {
    id: number;
    name: string;
    sido: string;
    sigungu: string;
    address: string;
    bookingUrl: string | null;
    hasAuto: boolean;
    loginId: string | null;
    hasCredential: boolean;
}

interface ScheduleItem {
    id: number;
    courseName: string;
    golfDate: string;
    timePeriod: string;
    scheduledAt: string;
    status: string;
    resultMsg: string | null;
}

interface Props {
    onClose: () => void;
}

type Step = 'select' | 'datetime' | 'running' | 'done';
type Mode = 'now' | 'schedule';

const TIME_PERIODS = [
    { value: 'morning',   label: '오전', desc: '~11:59' },
    { value: 'afternoon', label: '오후', desc: '12:00~16:59' },
    { value: 'evening',   label: '저녁', desc: '17:00~' },
];

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
    pending:  { text: '대기 중',  cls: 'bg-yellow-900 text-yellow-400' },
    running:  { text: '진행 중',  cls: 'bg-blue-900 text-blue-400' },
    success:  { text: '예약 완료', cls: 'bg-green-900 text-green-400' },
    failed:   { text: '실패',     cls: 'bg-red-900/60 text-red-400' },
};

const PERIOD_KO: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁' };

export const GolfReserveDialog: React.FC<Props> = ({ onClose }) => {
    const [step, setStep]         = useState<Step>('select');
    const [sidos, setSidos]       = useState<string[]>([]);
    const [sigungus, setSigungus] = useState<string[]>([]);
    const [courses, setCourses]   = useState<GolfCourse[]>([]);
    const [selectedSido, setSelectedSido]       = useState('');
    const [selectedSigungu, setSelectedSigungu] = useState('');
    const [selectedCourse, setSelectedCourse]   = useState<GolfCourse | null>(null);
    const [date, setDate]         = useState('');
    const [timePeriod, setTimePeriod] = useState('morning');
    const [mode, setMode]         = useState<Mode>('now');
    const [scheduledAt, setScheduledAt] = useState('');
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [result, setResult]     = useState('');

    const [showCredForm, setShowCredForm] = useState(false);
    const [inputId, setInputId]   = useState('');
    const [inputPw, setInputPw]   = useState('');

    const [showSchedules, setShowSchedules] = useState(false);
    const [schedules, setSchedules]         = useState<ScheduleItem[]>([]);
    const [schedLoading, setSchedLoading]   = useState(false);

    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDate(tomorrow.toISOString().split('T')[0]);
        // 기본 시도 시각: 내일 00:00
        const def = new Date(); def.setDate(def.getDate() + 1); def.setHours(0, 0, 0, 0);
        setScheduledAt(toLocalDatetimeInput(def));
    }, []);

    useEffect(() => {
        fetch('/api/golf/sido', { credentials: 'include' })
            .then(r => r.json()).then(d => setSidos(Array.isArray(d) ? d : [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedSido) { setSigungus([]); return; }
        fetch(`/api/golf/sigungu?sido=${encodeURIComponent(selectedSido)}`, { credentials: 'include' })
            .then(r => r.json()).then(d => setSigungus(Array.isArray(d) ? d : [])).catch(() => {});
        setSelectedSigungu(''); setCourses([]); setSelectedCourse(null);
    }, [selectedSido]);

    useEffect(() => {
        if (!selectedSigungu) { setCourses([]); return; }
        fetch(`/api/golf/courses?sido=${encodeURIComponent(selectedSido)}&sigungu=${encodeURIComponent(selectedSigungu)}`, { credentials: 'include' })
            .then(r => r.json()).then(d => setCourses(Array.isArray(d) ? d : [])).catch(() => {});
        setSelectedCourse(null);
    }, [selectedSigungu]);

    function toLocalDatetimeInput(d: Date) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    const loadSchedules = () => {
        setSchedLoading(true);
        fetch('/api/golf/schedules', { credentials: 'include' })
            .then(r => r.json()).then(d => setSchedules(Array.isArray(d) ? d : [])).catch(() => {})
            .finally(() => setSchedLoading(false));
    };

    const handleCourseSelect = (course: GolfCourse) => {
        setSelectedCourse(course);
        setStep('datetime');
        setError('');
        setShowCredForm(course.hasAuto && !course.hasCredential);
        setInputId(course.loginId || '');
        setInputPw('');
    };

    const handleOpenBooking = () => {
        if (selectedCourse?.bookingUrl) window.open(selectedCourse.bookingUrl, '_blank');
    };

    const handleSubmit = async () => {
        if (!selectedCourse || !date) return;
        if (showCredForm && (!inputId.trim() || !inputPw.trim())) {
            setError('아이디와 비밀번호를 입력해주세요.'); return;
        }
        if (mode === 'schedule' && !scheduledAt) {
            setError('예약 시도 시각을 선택해주세요.'); return;
        }

        setLoading(true); setError('');

        try {
            const credBody = (showCredForm && inputId && inputPw)
                ? { loginId: inputId.trim(), loginPw: inputPw }
                : {};

            if (mode === 'now') {
                // 즉시 예약
                setStep('running');
                const res = await fetch('/api/golf/reserve', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId: selectedCourse.id, date, timePeriod, ...credBody }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '예약 요청 실패');
                setResult(data.message || '예약 진행 중입니다.');
                setStep('done');
            } else {
                // 시간 예약 (스케줄 등록)
                const schedAt = new Date(scheduledAt).toISOString();
                const res = await fetch('/api/golf/schedule', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId: selectedCourse.id, golfDate: date, timePeriod, scheduledAt: schedAt, ...credBody }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '스케줄 등록 실패');
                const schedDate = new Date(scheduledAt);
                setResult(`${schedDate.toLocaleString('ko-KR')}에 자동으로 예약을 시도합니다.`);
                setStep('done');
            }
        } catch (e: any) {
            setError(e.message);
            setStep('datetime');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSchedule = async (id: number) => {
        if (!confirm('이 스케줄을 취소하시겠습니까?')) return;
        await fetch(`/api/golf/schedule/${id}`, { method: 'DELETE', credentials: 'include' });
        loadSchedules();
    };

    const today = new Date().toISOString().split('T')[0];
    const nowStr = toLocalDatetimeInput(new Date());

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-green-400" />
                        <span className="text-white font-semibold text-sm">골프장 예약</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setShowSchedules(v => !v); if (!showSchedules) loadSchedules(); }}
                            className="flex items-center gap-1 text-gray-400 hover:text-white text-xs"
                        >
                            <List size={14} /> 예약 목록
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-1">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {/* 예약 목록 패널 */}
                    {showSchedules && (
                        <div className="p-5 border-b border-gray-800">
                            <p className="text-xs font-semibold text-gray-300 mb-3">예약 목록 (최근 20건)</p>
                            {schedLoading ? (
                                <p className="text-gray-500 text-xs text-center py-4">불러오는 중...</p>
                            ) : schedules.length === 0 ? (
                                <p className="text-gray-500 text-xs text-center py-4">예약 내역이 없습니다.</p>
                            ) : (
                                <div className="space-y-2">
                                    {schedules.map(s => {
                                        const st = STATUS_LABEL[s.status] ?? STATUS_LABEL.failed;
                                        return (
                                            <div key={s.id} className="bg-gray-800 rounded-xl px-3 py-2.5 flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-white text-xs font-medium">{s.courseName}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                                                    </div>
                                                    <p className="text-gray-400 text-xs mt-0.5">
                                                        라운드: {s.golfDate} {PERIOD_KO[s.timePeriod]}
                                                    </p>
                                                    <p className="text-gray-500 text-xs">
                                                        시도: {new Date(s.scheduledAt).toLocaleString('ko-KR')}
                                                    </p>
                                                    {s.resultMsg && <p className="text-gray-500 text-xs mt-0.5 truncate">{s.resultMsg}</p>}
                                                </div>
                                                {s.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleCancelSchedule(s.id)}
                                                        className="shrink-0 text-[10px] text-red-400 hover:text-red-300 mt-0.5"
                                                    >취소</button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-5 space-y-4">
                        {/* STEP 1: 골프장 선택 */}
                        {step === 'select' && (
                            <>
                                <p className="text-gray-400 text-xs">시도 → 시군구 → 골프장 순으로 선택하세요.</p>
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">시도</label>
                                    <select value={selectedSido} onChange={e => setSelectedSido(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500">
                                        <option value="">-- 선택 --</option>
                                        {sidos.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                {selectedSido && (
                                    <div>
                                        <label className="text-gray-400 text-xs mb-1 block">시군구</label>
                                        <select value={selectedSigungu} onChange={e => setSelectedSigungu(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500">
                                            <option value="">-- 선택 --</option>
                                            {sigungus.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                )}
                                {courses.length > 0 && (
                                    <div>
                                        <label className="text-gray-400 text-xs mb-1 block">골프장</label>
                                        <div className="space-y-2 max-h-52 overflow-y-auto">
                                            {courses.map(c => (
                                                <button key={c.id} onClick={() => handleCourseSelect(c)}
                                                    className="w-full text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-3 py-3 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-white text-sm font-medium">{c.name}</span>
                                                        {c.hasAuto && <span className="text-[10px] bg-green-900 text-green-400 px-2 py-0.5 rounded-full">자동예약</span>}
                                                    </div>
                                                    <p className="text-gray-500 text-xs mt-0.5">{c.address}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* STEP 2: 날짜/시간/방식 선택 */}
                        {step === 'datetime' && selectedCourse && (
                            <>
                                <div className="bg-gray-800 rounded-xl px-4 py-3">
                                    <p className="text-white font-medium text-sm">{selectedCourse.name}</p>
                                    <p className="text-gray-500 text-xs mt-0.5">{selectedCourse.address}</p>
                                </div>

                                {/* 라운드 날짜 */}
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                        <Calendar size={12} /> 라운드 날짜
                                    </label>
                                    <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                                </div>

                                {/* 시간대 */}
                                {selectedCourse.hasAuto && (
                                    <div>
                                        <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                            <Clock size={12} /> 시간대
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {TIME_PERIODS.map(p => (
                                                <button key={p.value} onClick={() => setTimePeriod(p.value)}
                                                    className={`py-2 rounded-xl text-xs font-medium transition-colors border ${
                                                        timePeriod === p.value
                                                            ? 'bg-green-600 border-green-500 text-white'
                                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                                                    }`}>
                                                    <div>{p.label}</div>
                                                    <div className="text-[10px] opacity-70">{p.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 예약 방식 선택 */}
                                {selectedCourse.hasAuto && (
                                    <div>
                                        <label className="text-gray-400 text-xs mb-1 block">예약 방식</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => setMode('now')}
                                                className={`py-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                                                    mode === 'now'
                                                        ? 'bg-green-600 border-green-500 text-white'
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                                                }`}>
                                                <Clock size={12} /> 지금 바로
                                            </button>
                                            <button onClick={() => setMode('schedule')}
                                                className={`py-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                                                    mode === 'schedule'
                                                        ? 'bg-blue-600 border-blue-500 text-white'
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                                                }`}>
                                                <AlarmClock size={12} /> 시간 예약
                                            </button>
                                        </div>

                                        {mode === 'schedule' && (
                                            <div className="mt-2">
                                                <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                                    <AlarmClock size={12} /> 예약 시도 시각
                                                </label>
                                                <input type="datetime-local" value={scheduledAt} min={nowStr}
                                                    onChange={e => setScheduledAt(e.target.value)}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                <p className="text-gray-600 text-xs mt-1">설정한 시각에 자동으로 예약을 시도합니다.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 로그인 정보 */}
                                {selectedCourse.hasAuto && (
                                    <div className="border border-gray-700 rounded-xl overflow-hidden">
                                        <button onClick={() => setShowCredForm(v => !v)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-750 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <KeyRound size={13} className="text-gray-400" />
                                                <span className="text-xs text-gray-300">로그인 정보</span>
                                                {selectedCourse.hasCredential
                                                    ? <span className="text-[10px] bg-blue-900 text-blue-400 px-2 py-0.5 rounded-full">등록됨</span>
                                                    : <span className="text-[10px] bg-red-900/60 text-red-400 px-2 py-0.5 rounded-full">미등록</span>
                                                }
                                            </div>
                                            <span className="text-gray-500 text-xs">{showCredForm ? '▲' : '▼'}</span>
                                        </button>
                                        {showCredForm && (
                                            <div className="px-4 py-3 bg-gray-800/50 space-y-2 border-t border-gray-700">
                                                <p className="text-gray-500 text-xs">골프장 사이트 아이디/비밀번호를 입력하면 저장 후 사용합니다.</p>
                                                <input type="text" value={inputId} onChange={e => setInputId(e.target.value)} placeholder="아이디"
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500" />
                                                <input type="password" value={inputPw} onChange={e => setInputPw(e.target.value)} placeholder="비밀번호"
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {error && <p className="text-red-400 text-xs">{error}</p>}

                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => { setStep('select'); setSelectedCourse(null); }}
                                        className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors">
                                        뒤로
                                    </button>
                                    {selectedCourse.hasAuto ? (
                                        <button onClick={handleSubmit} disabled={!date || loading}
                                            className={`flex-1 py-2.5 rounded-xl disabled:opacity-40 text-white text-sm font-medium transition-colors ${
                                                mode === 'schedule' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'
                                            }`}>
                                            {mode === 'schedule' ? '시간 예약 등록' : '자동 예약'}
                                        </button>
                                    ) : (
                                        <button onClick={handleOpenBooking} disabled={!selectedCourse.bookingUrl}
                                            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                                            <ExternalLink size={13} /> 예약 사이트
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
                                <p className="text-white font-medium">
                                    {mode === 'schedule' ? '예약 등록 완료' : '예약 요청 완료'}
                                </p>
                                <p className="text-gray-400 text-xs">{result}</p>
                                <button onClick={onClose}
                                    className="mt-4 px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors">
                                    확인
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
