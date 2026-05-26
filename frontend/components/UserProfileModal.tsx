import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authApi, pointsApi, PointsStats } from '../services/apiService';
import { getStage } from '../utils/level';
import { X, User as UserIcon, BarChart2, Lock, Eye, EyeOff, ChevronDown, Heart } from 'lucide-react';

interface Props {
    user: User;
    onClose: () => void;
}

type Tab = 'info' | 'stats';

export const UserProfileModal: React.FC<Props> = ({ user, onClose }) => {
    const [tab, setTab] = useState<Tab>('info');

    // 비밀번호 변경
    const [curPw, setCurPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [newPwConfirm, setNewPwConfirm] = useState('');
    const [showCur, setShowCur] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [pwOpen, setPwOpen] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // 전화번호 등록
    const [phoneOpen, setPhoneOpen] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [phoneMsg, setPhoneMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [currentPhone, setCurrentPhone] = useState(user.phone || '');

    const handleRegisterPhone = async () => {
        const raw = phoneInput.replace(/-/g, '').trim();
        if (!/^\d{10,11}$/.test(raw)) {
            setPhoneMsg({ type: 'err', text: '올바른 전화번호를 입력해주세요. (숫자 10~11자리)' });
            return;
        }
        setPhoneLoading(true); setPhoneMsg(null);
        try {
            await fetch('/api/user/phone', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: raw }),
            }).then(async r => {
                if (!r.ok) throw new Error((await r.json()).error || '오류가 발생했습니다.');
            });
            setCurrentPhone(raw);
            setPhoneOpen(false);
            setPhoneInput('');
            setPhoneMsg({ type: 'ok', text: '전화번호가 등록되었습니다.' });
        } catch (e: any) {
            setPhoneMsg({ type: 'err', text: e.message });
        } finally { setPhoneLoading(false); }
    };

    // 통계
    const [stats, setStats] = useState<PointsStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState('');

    useEffect(() => {
        if (tab === 'stats' && !stats) {
            setStatsLoading(true);
            pointsApi.getStats()
                .then(setStats)
                .catch(() => setStatsError('통계를 불러오지 못했습니다.'))
                .finally(() => setStatsLoading(false));
        }
    }, [tab]);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwMsg(null);
        if (newPw !== newPwConfirm) {
            setPwMsg({ type: 'err', text: '새 비밀번호가 일치하지 않습니다.' });
            return;
        }
        if (newPw.length < 6) {
            setPwMsg({ type: 'err', text: '새 비밀번호는 6자 이상이어야 합니다.' });
            return;
        }
        setPwLoading(true);
        try {
            const res = await authApi.changePassword(curPw, newPw);
            setPwMsg({ type: 'ok', text: res.message });
            setCurPw(''); setNewPw(''); setNewPwConfirm('');
        } catch (e: any) {
            setPwMsg({ type: 'err', text: e.message });
        } finally {
            setPwLoading(false);
        }
    };

    const receivedTotal = stats
        ? stats.received.charge + stats.received.signup + stats.received.levelup + stats.received.admin
        : 0;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
                    <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
                        <button
                            onClick={() => setTab('info')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                tab === 'info' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            <UserIcon size={14} />내정보
                        </button>
                        <button
                            onClick={() => setTab('stats')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                tab === 'stats' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            <BarChart2 size={14} />페르소나 통계
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* 바디 */}
                <div className="flex-1 overflow-y-auto p-5">

                    {/* ── 내정보 탭 ── */}
                    {tab === 'info' && (
                        <div className="space-y-6">
                            {/* 기본 정보 */}
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">기본 정보</h3>
                                <div className="bg-gray-800/60 rounded-xl divide-y divide-gray-700/50">
                                    <InfoRow label="이름" value={user.username || '—'} />
                                    <InfoRow label="이메일" value={user.email || '—'} />
                                    {/* 전화번호 — 없으면 등록 버튼 */}
                                    {currentPhone ? (
                                        <InfoRow label="전화번호" value={formatPhone(currentPhone)} />
                                    ) : (
                                        <div className="flex items-center justify-between px-4 py-3">
                                            <span className="text-sm text-gray-400">전화번호</span>
                                            <button
                                                onClick={() => { setPhoneOpen(v => !v); setPhoneMsg(null); }}
                                                className="text-xs px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors"
                                            >
                                                + 등록
                                            </button>
                                        </div>
                                    )}
                                    {phoneOpen && !currentPhone && (
                                        <div className="px-4 pb-3 space-y-2 border-t border-gray-700/50 pt-3">
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                value={phoneInput}
                                                onChange={e => setPhoneInput(e.target.value)}
                                                placeholder="01012345678"
                                                maxLength={13}
                                                onKeyDown={e => e.key === 'Enter' && handleRegisterPhone()}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                                            />
                                            {phoneMsg && (
                                                <p className={`text-xs ${phoneMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{phoneMsg.text}</p>
                                            )}
                                            <button
                                                onClick={handleRegisterPhone}
                                                disabled={phoneLoading}
                                                className="w-full py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                                                style={{ background: 'linear-gradient(135deg, #FF6B9D, #C84B8F)', color: '#fff' }}
                                            >
                                                {phoneLoading ? '저장 중...' : '저장'}
                                            </button>
                                        </div>
                                    )}
                                    {phoneMsg?.type === 'ok' && currentPhone && (
                                        <p className="px-4 pb-2 text-xs text-green-400">{phoneMsg.text}</p>
                                    )}
                                </div>
                            </div>

                            {/* 비밀번호 변경 */}
                            <div className="bg-gray-800/60 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => { setPwOpen(v => !v); setPwMsg(null); }}
                                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Lock size={14} className="text-gray-400" />
                                        비밀번호 변경
                                    </span>
                                    <ChevronDown size={15} className={`text-gray-500 transition-transform duration-200 ${pwOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {pwOpen && (
                                    <form onSubmit={handleChangePassword} className="px-4 pb-4 space-y-3 border-t border-gray-700/50 pt-3">
                                        <div className="relative">
                                            <input
                                                type={showCur ? 'text' : 'password'}
                                                value={curPw}
                                                onChange={e => setCurPw(e.target.value)}
                                                placeholder="현재 비밀번호"
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-10"
                                                required
                                            />
                                            <button type="button" onClick={() => setShowCur(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                                {showCur ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type={showNew ? 'text' : 'password'}
                                                value={newPw}
                                                onChange={e => setNewPw(e.target.value)}
                                                placeholder="새 비밀번호 (6자 이상)"
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-10"
                                                required
                                            />
                                            <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <input
                                            type="password"
                                            value={newPwConfirm}
                                            onChange={e => setNewPwConfirm(e.target.value)}
                                            placeholder="새 비밀번호 확인"
                                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            required
                                        />
                                        {pwMsg && (
                                            <p className={`text-xs px-1 ${pwMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                                                {pwMsg.text}
                                            </p>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={pwLoading}
                                            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
                                        >
                                            {pwLoading ? '변경 중...' : '비밀번호 변경'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── 페르소나 통계 탭 ── */}
                    {tab === 'stats' && (
                        <div className="space-y-5">
                            {statsLoading && (
                                <div className="text-center py-12 text-gray-500 text-sm">불러오는 중...</div>
                            )}
                            {statsError && (
                                <div className="text-center py-12 text-red-400 text-sm">{statsError}</div>
                            )}
                            {stats && !statsLoading && (
                                <>
                                    {/* 페르소나별 랭킹 */}
                                    {stats.byPersona.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500 text-sm">아직 사용 내역이 없습니다.</div>
                                    ) : (
                                        <div>
                                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">페르소나별 사용 랭킹</h3>
                                            <div className="space-y-2">
                                                {stats.byPersona.map((row, i) => {
                                                    const stage = getStage(row.xp);
                                                    const isShineuby = row.persona?.name === '신은비';
                                                    const meetDays = row.firstChatAt
                                                        ? Math.floor((Date.now() - new Date(row.firstChatAt).getTime()) / 86400000) + 1
                                                        : null;
                                                    return (
                                                        <div key={row.personaId} className="bg-gray-800/60 rounded-xl p-3">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <span className="text-xs font-bold text-gray-500 w-5 text-center">{i + 1}</span>
                                                                {row.persona?.imageUrl ? (
                                                                    <img src={row.persona.imageUrl} alt={row.persona.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                                                                        <UserIcon size={14} className="text-gray-400" />
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="text-sm font-semibold text-white truncate">
                                                                            {row.persona?.name ?? '알 수 없음'}
                                                                        </span>
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${stage.color} text-white shrink-0`}>
                                                                            Lv.{stage.stage} {stage.name}
                                                                        </span>
                                                                    </div>
                                                                    {isShineuby && meetDays !== null && (
                                                                        <div className="flex items-center gap-1 mt-0.5">
                                                                            <Heart size={10} className="text-pink-400 shrink-0" />
                                                                            <span className="text-[11px] text-pink-300">만남 {meetDays}일째</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm font-bold text-purple-400 shrink-0">
                                                                    {row.total.toLocaleString()}pt
                                                                </span>
                                                            </div>
                                                            <div className="ml-8 grid grid-cols-3 gap-1.5">
                                                                <StatChip label="채팅" value={row.chat} color="blue" />
                                                                <StatChip label="퀵메뉴" value={row.menu} color="yellow" />
                                                                <StatChip label="별스타" value={row.balloon} color="pink" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 지급 받은 포인트 */}
                                    <div>
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">받은 포인트</h3>
                                        <div className="bg-gray-800/60 rounded-xl divide-y divide-gray-700/50">
                                            <InfoRow label="유료 충전" value={`${stats.received.charge.toLocaleString()}pt`} />
                                            <InfoRow label="가입 보너스" value={`${stats.received.signup.toLocaleString()}pt`} />
                                            <InfoRow label="레벨업 보너스" value={`${stats.received.levelup.toLocaleString()}pt`} />
                                            <InfoRow label="관리자 지급" value={`${stats.received.admin.toLocaleString()}pt`} />
                                            <div className="px-4 py-2.5 flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-300">합계</span>
                                                <span className="text-sm font-bold text-green-400">{receivedTotal.toLocaleString()}pt</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="px-4 py-2.5 flex justify-between items-center">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-sm text-gray-200">{value}</span>
    </div>
);

const StatChip: React.FC<{ label: string; value: number; color: 'blue' | 'yellow' | 'pink' }> = ({ label, value, color }) => {
    const cls = {
        blue: 'bg-blue-900/40 text-blue-300',
        yellow: 'bg-yellow-900/40 text-yellow-300',
        pink: 'bg-pink-900/40 text-pink-300',
    }[color];
    return (
        <div className={`rounded-lg px-2 py-1 text-center ${cls}`}>
            <div className="text-[10px] opacity-70">{label}</div>
            <div className="text-xs font-semibold">{value.toLocaleString()}pt</div>
        </div>
    );
};

function formatPhone(phone: string): string {
    if (phone.length === 11) return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    if (phone.length === 10) return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    return phone;
}
