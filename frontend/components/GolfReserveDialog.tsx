import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Calendar, Clock, Loader, CheckCircle, ExternalLink, KeyRound, AlarmClock, List, Search } from 'lucide-react';

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
    advanceDays: number;
    openHour: number;
    openMinute: number;
}

interface ScheduleItem {
    id: number;
    courseName: string;
    golfDate: string;
    timePeriod: string;
    preferredTime: string | null;
    scheduledAt: string;
    openAt: string | null;
    status: string;
    resultMsg: string | null;
}

interface Props {
    onClose: () => void;
}

type Step = 'select' | 'datetime' | 'running' | 'done';
type Mode = 'now' | 'schedule';

const TIME_PERIODS = [
    { value: 'morning',   label: '오전', desc: '~11:59',   start: 6,  end: 12 },
    { value: 'afternoon', label: '오후', desc: '12:00~16:59', start: 12, end: 17 },
    { value: 'evening',   label: '저녁', desc: '17:00~',   start: 17, end: 21 },
];

// 시간대별 30분 슬롯 생성
function genTimeSlots(period: typeof TIME_PERIODS[0]): string[] {
    const slots: string[] = [];
    for (let h = period.start; h < period.end; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        if (h < period.end - 1 || period.value !== 'evening') {
            slots.push(`${String(h).padStart(2, '0')}:30`);
        }
    }
    return slots;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
    pending:  { text: '대기 중',   cls: 'bg-yellow-900 text-yellow-400' },
    running:  { text: '진행 중',   cls: 'bg-blue-900 text-blue-400' },
    success:  { text: '예약 완료', cls: 'bg-green-900 text-green-400' },
    failed:   { text: '실패',      cls: 'bg-red-900/60 text-red-400' },
};

const PERIOD_KO: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁' };

function pad(n: number) { return String(n).padStart(2, '0'); }

function toKST(date: Date) {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth()+1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}

// KST YYYY-MM-DD + HH:MM → UTC Date
function kstToDate(date: string, time: string): Date | null {
    try {
        const [y, m, d] = date.split('-').map(Number);
        const [h, min]  = time.split(':').map(Number);
        const utcH = h - 9 < 0 ? h - 9 + 24 : h - 9;
        const base = new Date(Date.UTC(y, m - 1, d, utcH, min));
        if (h < 9) base.setUTCDate(base.getUTCDate() + 1);
        return base;
    } catch { return null; }
}

export const GolfReserveDialog: React.FC<Props> = ({ onClose }) => {
    const [step, setStep]             = useState<Step>('select');
    const [allCourses, setAllCourses] = useState<GolfCourse[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [coursesLoading, setCoursesLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);

    // 라운드 날짜 / 시간대 / 희망 티타임
    const [date, setDate]                 = useState('');
    const [timePeriod, setTimePeriod]     = useState('morning');
    const [preferredTime, setPreferredTime] = useState('');

    // 예약 방식
    const [mode, setMode] = useState<Mode>('now');

    // 오픈 시각 (사용자 직접 입력)
    const [openDate, setOpenDate] = useState('');
    const [openTime, setOpenTime] = useState('00:00');

    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [result, setResult]     = useState('');

    const [showCredForm, setShowCredForm] = useState(false);
    const [inputId, setInputId]   = useState('');
    const [inputPw, setInputPw]   = useState('');

    const [showSchedules, setShowSchedules] = useState(false);
    const [schedules, setSchedules]         = useState<ScheduleItem[]>([]);
    const [schedLoading, setSchedLoading]   = useState(false);

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const t = tomorrow.toISOString().split('T')[0];
        setDate(t);
        // 오픈 날짜 기본값: 오늘
        setOpenDate(today);
    }, []);

    // 모든 골프장 로드
    useEffect(() => {
        setCoursesLoading(true);
        fetch('/api/golf/courses', { credentials: 'include' })
            .then(r => r.json())
            .then(d => {
                const all = Array.isArray(d) ? d : [];
                setAllCourses(all.filter((c: GolfCourse) => c.hasAuto || (c.bookingUrl && c.bookingUrl.length > 0)));
            })
            .catch(() => {})
            .finally(() => setCoursesLoading(false));
    }, []);

    const filteredCourses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return allCourses;
        return allCourses.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.sido.toLowerCase().includes(q) ||
            c.sigungu.toLowerCase().includes(q)
        );
    }, [allCourses, searchQuery]);

    // 선택한 시간대의 슬롯
    const timeSlots = useMemo(() => {
        const p = TIME_PERIODS.find(p => p.value === timePeriod);
        return p ? genTimeSlots(p) : [];
    }, [timePeriod]);

    // 봇 실행 시각 계산 (오픈 3분 전)
    const botAt = useMemo(() => {
        if (!openDate || !openTime) return null;
        const open = kstToDate(openDate, openTime);
        if (!open) return null;
        return new Date(open.getTime() - 3 * 60 * 1000);
    }, [openDate, openTime]);

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
        setPreferredTime('');
    };

    const handleSubmit = async () => {
        if (!selectedCourse || !date) return;
        if (showCredForm && (!inputId.trim() || !inputPw.trim())) {
            setError('아이디와 비밀번호를 입력해주세요.'); return;
        }
        if (mode === 'schedule' && (!openDate || !openTime)) {
            setError('예약 오픈 날짜와 시간을 입력해주세요.'); return;
        }

        setLoading(true); setError('');

        try {
            const credBody = (showCredForm && inputId && inputPw)
                ? { loginId: inputId.trim(), loginPw: inputPw }
                : {};

            if (mode === 'now') {
                setStep('running');
                const res = await fetch('/api/golf/reserve', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        courseId: selectedCourse.id, date, timePeriod,
                        preferredTime: preferredTime || undefined,
                        ...credBody,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '예약 요청 실패');
                setResult(data.message || '예약 진행 중입니다.');
                setStep('done');
            } else {
                const res = await fetch('/api/golf/schedule', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        courseId: selectedCourse.id, golfDate: date, timePeriod,
                        preferredTime: preferredTime || undefined,
                        openDate, openTime,
                        ...credBody,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '스케줄 등록 실패');
                const openStr = botAt ? toKST(new Date(botAt.getTime() + 3 * 60 * 1000)) : openDate + ' ' + openTime;
                const botStr  = botAt ? toKST(botAt) : '';
                setResult(`예약 오픈: ${openStr} KST\n봇 접속: ${botStr} KST (3분 전)\n오픈 즉시 자동 예약합니다.`);
                setStep('done');
            }
        } catch (e: any) {
            setError(e.message);
            if (step === 'running') setStep('datetime');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSchedule = async (id: number) => {
        if (!confirm('이 스케줄을 취소하시겠습니까?')) return;
        await fetch(`/api/golf/schedule/${id}`, { method: 'DELETE', credentials: 'include' });
        loadSchedules();
    };

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
                                                        {s.preferredTime && <span className="ml-1 text-green-400">{s.preferredTime}</span>}
                                                    </p>
                                                    {s.openAt && (
                                                        <p className="text-gray-500 text-xs">
                                                            오픈: {toKST(new Date(s.openAt))} KST
                                                        </p>
                                                    )}
                                                    <p className="text-gray-500 text-xs">
                                                        봇 실행: {toKST(new Date(s.scheduledAt))} KST
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
                        {/* STEP 1: 골프장 목록 */}
                        {step === 'select' && (
                            <>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="골프장 이름 또는 지역 검색"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500"
                                    />
                                </div>

                                {coursesLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader size={24} className="animate-spin text-green-400" />
                                    </div>
                                ) : filteredCourses.length === 0 ? (
                                    <p className="text-gray-500 text-xs text-center py-6">
                                        {searchQuery ? '검색 결과가 없습니다.' : '예약 가능한 골프장이 없습니다.'}
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredCourses.map(c => (
                                            <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-white text-sm font-medium">{c.name}</span>
                                                            {c.hasAuto && (
                                                                <span className="text-[10px] bg-green-900 text-green-400 px-2 py-0.5 rounded-full shrink-0">자동예약</span>
                                                            )}
                                                        </div>
                                                        <p className="text-gray-500 text-xs mt-0.5">{c.sido} {c.sigungu}</p>
                                                    </div>
                                                    <div className="shrink-0">
                                                        {c.hasAuto ? (
                                                            <button
                                                                onClick={() => handleCourseSelect(c)}
                                                                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors"
                                                            >
                                                                예약
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => c.bookingUrl && window.open(c.bookingUrl, '_blank')}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium transition-colors"
                                                            >
                                                                <ExternalLink size={11} /> 예약 사이트
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* STEP 2: 날짜/시간/방식 선택 */}
                        {step === 'datetime' && selectedCourse && (
                            <>
                                <div className="bg-gray-800 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <p className="text-white font-medium text-sm">{selectedCourse.name}</p>
                                        <span className="text-[10px] bg-green-900 text-green-400 px-2 py-0.5 rounded-full">자동예약</span>
                                    </div>
                                    <p className="text-gray-500 text-xs mt-0.5">{selectedCourse.sido} {selectedCourse.sigungu}</p>
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
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                        <Clock size={12} /> 시간대
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {TIME_PERIODS.map(p => (
                                            <button key={p.value}
                                                onClick={() => { setTimePeriod(p.value); setPreferredTime(''); }}
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

                                    {/* 희망 티타임 선택 */}
                                    <div className="mt-2">
                                        <p className="text-gray-500 text-[11px] mb-1.5">희망 티타임 (선택)</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {timeSlots.map(t => (
                                                <button key={t}
                                                    onClick={() => setPreferredTime(prev => prev === t ? '' : t)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                                                        preferredTime === t
                                                            ? 'bg-green-600 border-green-500 text-white'
                                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                                                    }`}>
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                        {preferredTime && (
                                            <p className="text-green-400 text-[11px] mt-1">
                                                {preferredTime} 티타임 우선 예약 시도
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* 예약 방식 */}
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
                                            <AlarmClock size={12} /> 오픈 시각 예약
                                        </button>
                                    </div>

                                    {/* 오픈 시각 직접 입력 */}
                                    {mode === 'schedule' && (
                                        <div className="mt-2 bg-blue-950/40 border border-blue-800/50 rounded-xl px-4 py-3 space-y-3">
                                            <p className="text-blue-300 text-xs font-medium flex items-center gap-1">
                                                <AlarmClock size={11} /> 예약 오픈 일시 설정
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-gray-500 text-[11px] mb-1">오픈 날짜</p>
                                                    <input type="date" value={openDate} min={today}
                                                        onChange={e => setOpenDate(e.target.value)}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-[11px] mb-1">오픈 시각 (KST)</p>
                                                    <input type="time" value={openTime}
                                                        onChange={e => setOpenTime(e.target.value)}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                </div>
                                            </div>
                                            {botAt && (
                                                <div className="space-y-0.5">
                                                    <p className="text-gray-300 text-xs">
                                                        예약 오픈: <span className="text-white font-medium">{openDate} {openTime} KST</span>
                                                    </p>
                                                    <p className="text-gray-300 text-xs">
                                                        봇 접속: <span className="text-white font-medium">{toKST(botAt)} KST</span>
                                                        <span className="text-gray-500"> (3분 전 대기)</span>
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 로그인 정보 */}
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

                                {error && <p className="text-red-400 text-xs">{error}</p>}

                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => { setStep('select'); setSelectedCourse(null); }}
                                        className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors">
                                        뒤로
                                    </button>
                                    <button onClick={handleSubmit} disabled={!date || loading}
                                        className={`flex-1 py-2.5 rounded-xl disabled:opacity-40 text-white text-sm font-medium transition-colors ${
                                            mode === 'schedule' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'
                                        }`}>
                                        {loading
                                            ? <Loader size={14} className="animate-spin mx-auto" />
                                            : mode === 'schedule' ? '오픈 시각 예약 등록' : '자동 예약'}
                                    </button>
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
                                <p className="text-gray-400 text-xs whitespace-pre-line">{result}</p>
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
