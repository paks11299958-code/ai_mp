import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, Plus, Users, QrCode, ClipboardList, RefreshCw, Loader, Copy, Check } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

// ── 타입 ─────────────────────────────────────────────────

interface Club {
    id: string;
    name: string;
    imageUrl?: string;
    region?: string;
    description?: string;
    memberCount: number;
    myRole: 'OWNER' | 'MEMBER';
    qrUuid: string;
    createdAt: string;
}

interface ClubMember {
    id: string;
    nickname: string;
    phone: string;
    role: string;
    joinedAt: string;
    attendanceCount: number;
}

interface Sheet {
    id: string;
    title: string;
    qrUuid: string;
    createdAt: string;
    attendeeCount: number;
}

interface SheetRecord {
    id: string;
    nickname: string;
    phone: string;
    role: string;
    attendedAt: string;
}

type View = 'list' | 'create' | 'detail' | 'members' | 'sheets' | 'sheet_records';

interface Props { onClose: () => void; }

// ── 유틸 ─────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '오류가 발생했습니다.' }));
        throw new Error(err.error || '요청 실패');
    }
    return res.json();
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// QR 코드 URL 생성 (출석 페이지로 연결)
function getAttendanceUrl(sheetUuid: string) {
    return `${window.location.origin}/attend/${sheetUuid}`;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export const ClubBoard: React.FC<Props> = ({ onClose }) => {
    const [view, setView]               = useState<View>('list');
    const [clubs, setClubs]             = useState<Club[]>([]);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState('');
    const [selectedClub, setSelectedClub] = useState<Club | null>(null);
    const [members, setMembers]         = useState<ClubMember[]>([]);
    const [sheets, setSheets]           = useState<Sheet[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<Sheet | null>(null);
    const [records, setRecords]         = useState<SheetRecord[]>([]);
    const [copied, setCopied]           = useState<string | null>(null);
    const [qrSheet, setQrSheet]         = useState<Sheet | null>(null);  // QR 팝업 대상 출석부

    // 모임 목록 로드
    const loadClubs = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await apiFetch<{ clubs: Club[] }>('/api/clubs');
            setClubs(data.clubs);
        } catch (e: any) {
            setError(e.message);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadClubs(); }, [loadClubs]);

    // 회원 명부 로드
    const loadMembers = useCallback(async (club: Club) => {
        setLoading(true); setError('');
        try {
            const data = await apiFetch<{ members: ClubMember[] }>(`/api/clubs/${club.id}/members`);
            setMembers(data.members);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    // 출석부 목록 로드
    const loadSheets = useCallback(async (club: Club) => {
        setLoading(true); setError('');
        try {
            const data = await apiFetch<{ sheets: Sheet[] }>(`/api/clubs/${club.id}/sheets`);
            setSheets(data.sheets);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    // 출석 명단 로드
    const loadRecords = useCallback(async (sheet: Sheet) => {
        if (!selectedClub) return;
        setLoading(true); setError('');
        try {
            const data = await apiFetch<{ records: SheetRecord[] }>(
                `/api/clubs/${selectedClub.id}/sheets/${sheet.id}/records`
            );
            setRecords(data.records);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, [selectedClub]);

    // URL 복사
    const copyUrl = async (url: string, key: string) => {
        await navigator.clipboard.writeText(url);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    // ── 뷰별 렌더링 ─────────────────────────────────────────

    const renderHeader = (title: string, onBack?: () => void) => (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
                {onBack && (
                    <button onClick={onBack} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                        <ChevronLeft size={20} className="text-white/70" />
                    </button>
                )}
                <h2 className="text-base font-semibold text-white">{title}</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} className="text-white/70" />
            </button>
        </div>
    );

    // 모임 목록
    if (view === 'list') {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#1a1b23] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {renderHeader('🤝 모임')}

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        {loading && (
                            <div className="flex justify-center py-8">
                                <Loader size={24} className="text-pink-400 animate-spin" />
                            </div>
                        )}
                        {!loading && clubs.length === 0 && (
                            <div className="text-center py-10 text-white/40">
                                <Users size={40} className="mx-auto mb-3 opacity-40" />
                                <p className="text-sm">아직 모임이 없습니다.</p>
                                <p className="text-xs mt-1">새 모임을 만들어 보세요!</p>
                            </div>
                        )}
                        {clubs.map(club => (
                            <button
                                key={club.id}
                                onClick={() => { setSelectedClub(club); setView('detail'); }}
                                className="w-full text-left p-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-white">{club.name}</p>
                                        {club.region && <p className="text-xs text-white/40 mt-0.5">{club.region}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-white/40">{club.memberCount}명</span>
                                        {club.myRole === 'OWNER' && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-400 font-medium">
                                                관리자
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={() => setView('create')}
                            className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                            style={{ background: 'rgba(255,107,157,0.2)', color: '#FF6B9D', border: '1px solid rgba(255,107,157,0.4)' }}
                        >
                            <Plus size={16} />
                            새 모임 만들기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 모임 상세
    if (view === 'detail' && selectedClub) {
        const isOwner = selectedClub.myRole === 'OWNER';
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#1a1b23] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {renderHeader(selectedClub.name, () => setView('list'))}

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedClub.region && (
                            <p className="text-xs text-white/40">📍 {selectedClub.region}</p>
                        )}
                        {selectedClub.description && (
                            <p className="text-sm text-white/60 leading-relaxed">{selectedClub.description}</p>
                        )}

                        {/* 메뉴 카드 */}
                        {isOwner && (
                            <button
                                onClick={() => { loadMembers(selectedClub); setView('members'); }}
                                className="w-full p-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-3"
                            >
                                <Users size={18} className="text-pink-400" />
                                <div className="text-left">
                                    <p className="text-sm font-medium text-white">회원 명부</p>
                                    <p className="text-xs text-white/40">전체 회원 {selectedClub.memberCount}명</p>
                                </div>
                            </button>
                        )}

                        {isOwner && (
                            <button
                                onClick={() => { loadSheets(selectedClub); setView('sheets'); }}
                                className="w-full p-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-3"
                            >
                                <QrCode size={18} className="text-pink-400" />
                                <div className="text-left">
                                    <p className="text-sm font-medium text-white">출석부 관리</p>
                                    <p className="text-xs text-white/40">QR 출석 생성 및 명단 확인</p>
                                </div>
                            </button>
                        )}

                        {!isOwner && (
                            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
                                <p className="text-sm text-white/50">가입된 모임입니다</p>
                                <p className="text-xs text-white/30 mt-1">가입일: {formatDate(selectedClub.createdAt)}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // 회원 명부
    if (view === 'members' && selectedClub) {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#1a1b23] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {renderHeader(`회원 명부 (${members.length}명)`, () => setView('detail'))}

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {loading && <div className="flex justify-center py-8"><Loader size={24} className="text-pink-400 animate-spin" /></div>}
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        {!loading && members.length === 0 && (
                            <p className="text-center text-white/40 text-sm py-8">회원이 없습니다.</p>
                        )}
                        {members.map(m => (
                            <div key={m.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-white">{m.nickname}</p>
                                        {m.role === 'OWNER' && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-400 font-medium">관리자</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-white/40 mt-0.5">{m.phone} · 가입 {formatDate(m.joinedAt)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-pink-400">{m.attendanceCount}</p>
                                    <p className="text-[10px] text-white/30">출석</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // 출석부 목록
    if (view === 'sheets' && selectedClub) {
        return (
          <>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#1a1b23] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {renderHeader('출석부 관리', () => setView('detail'))}

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {loading && <div className="flex justify-center py-8"><Loader size={24} className="text-pink-400 animate-spin" /></div>}
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        {!loading && sheets.length === 0 && (
                            <div className="text-center py-10 text-white/40">
                                <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
                                <p className="text-sm">출석부가 없습니다.</p>
                            </div>
                        )}
                        {sheets.map(s => {
                            const url = getAttendanceUrl(s.qrUuid);
                            return (
                                <div key={s.id} className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-white">{s.title}</p>
                                        <span className="text-xs text-pink-400 font-bold">{s.attendeeCount}명 출석</span>
                                    </div>
                                    <p className="text-xs text-white/30">{formatDate(s.createdAt)}</p>

                                    {/* QR URL 복사 */}
                                    <div className="flex items-center gap-2 mt-1">
                                        <input
                                            readOnly
                                            value={url}
                                            className="flex-1 text-[11px] bg-black/30 rounded-lg px-2 py-1.5 text-white/50 border border-white/10 truncate"
                                        />
                                        <button
                                            onClick={() => copyUrl(url, s.id)}
                                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                            title="출석 링크 복사"
                                        >
                                            {copied === s.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/60" />}
                                        </button>
                                        <button
                                            onClick={() => setQrSheet(s)}
                                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                            title="QR 코드 보기"
                                        >
                                            <QrCode size={14} className="text-white/60" />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedSheet(s); loadRecords(s); setView('sheet_records'); }}
                                            className="p-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 transition-colors"
                                            title="출석 명단 보기"
                                        >
                                            <Users size={14} className="text-pink-400" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 border-t border-white/10">
                        <SheetCreateForm
                            clubId={selectedClub.id}
                            onCreated={() => loadSheets(selectedClub)}
                        />
                    </div>
                </div>
            </div>

            {/* QR 코드 큰 화면 팝업 (출석 현장에서 스캔용) */}
            {qrSheet && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setQrSheet(null)}
                >
                    <div
                        className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 max-w-[90vw]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-base font-bold text-gray-900 text-center break-keep">{qrSheet.title}</p>
                        <div className="bg-white p-3 rounded-xl">
                            <QRCodeCanvas
                                value={getAttendanceUrl(qrSheet.qrUuid)}
                                size={240}
                                level="M"
                                marginSize={2}
                            />
                        </div>
                        <p className="text-xs text-gray-500 text-center">휴대폰 카메라로 QR을 스캔하면 출석됩니다.</p>
                        <button
                            onClick={() => setQrSheet(null)}
                            className="mt-1 px-6 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
          </>
        );
    }

    // 특정 출석부 명단
    if (view === 'sheet_records' && selectedSheet) {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#1a1b23] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {renderHeader(`출석 명단 (${records.length}명)`, () => { setView('sheets'); })}

                    <div className="px-4 py-2 border-b border-white/10">
                        <p className="text-sm text-white/60">{selectedSheet.title}</p>
                        <p className="text-xs text-white/30">{formatDate(selectedSheet.createdAt)}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {loading && <div className="flex justify-center py-8"><Loader size={24} className="text-pink-400 animate-spin" /></div>}
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        {!loading && records.length === 0 && (
                            <p className="text-center text-white/40 text-sm py-8">아직 출석한 회원이 없습니다.</p>
                        )}
                        {records.map((r, i) => (
                            <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                                <span className="text-xs font-bold text-pink-400 w-5 text-center">{i + 1}</span>
                                <div className="flex-1">
                                    <p className="text-sm text-white">{r.nickname}</p>
                                    <p className="text-[11px] text-white/40">{r.phone}</p>
                                </div>
                                <p className="text-[11px] text-white/30">{formatDateTime(r.attendedAt)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // 모임 생성 폼
    if (view === 'create') {
        return (
            <ClubCreateForm
                onClose={onClose}
                onBack={() => setView('list')}
                onCreated={() => { loadClubs(); setView('list'); }}
            />
        );
    }

    return null;
};

// ── 모임 생성 폼 ──────────────────────────────────────────

interface ClubCreateFormProps {
    onClose: () => void;
    onBack: () => void;
    onCreated: () => void;
}

const ClubCreateForm: React.FC<ClubCreateFormProps> = ({ onClose, onBack, onCreated }) => {
    const [name, setName]           = useState('');
    const [region, setRegion]       = useState('');
    const [description, setDesc]    = useState('');
    const [ownerNickname, setOwnerNickname] = useState('');
    const [ownerPhone, setOwnerPhone]       = useState('');
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');

    const handleSubmit = async () => {
        if (!name.trim())          return setError('모임 이름을 입력해주세요.');
        if (!ownerNickname.trim()) return setError('이름(별명)을 입력해주세요.');
        if (!ownerPhone.trim())    return setError('연락처를 입력해주세요.');

        setLoading(true); setError('');
        try {
            await apiFetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), region: region.trim(), description: description.trim(), ownerNickname: ownerNickname.trim(), ownerPhone: ownerPhone.trim() }),
            });
            onCreated();
        } catch (e: any) {
            setError(e.message);
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="w-full sm:max-w-lg bg-[#1a1b23] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                            <ChevronLeft size={20} className="text-white/70" />
                        </button>
                        <h2 className="text-base font-semibold text-white">새 모임 만들기</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                        <X size={20} className="text-white/70" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <label className="block">
                        <span className="text-xs text-white/50 mb-1 block">모임 이름 *</span>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            placeholder="예: 수요 테니스 모임"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs text-white/50 mb-1 block">활동 지역</span>
                        <input
                            value={region} onChange={e => setRegion(e.target.value)}
                            placeholder="예: 서울 강남"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs text-white/50 mb-1 block">모임 소개</span>
                        <textarea
                            value={description} onChange={e => setDesc(e.target.value)}
                            placeholder="모임에 대해 간단히 소개해주세요."
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 resize-none"
                        />
                    </label>

                    <div className="border-t border-white/10 pt-3">
                        <p className="text-xs text-white/40 mb-2">개설자 정보 (회원 명부 등록용)</p>
                        <label className="block mb-3">
                            <span className="text-xs text-white/50 mb-1 block">이름 / 별명 *</span>
                            <input
                                value={ownerNickname} onChange={e => setOwnerNickname(e.target.value)}
                                placeholder="예: 홍길동"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs text-white/50 mb-1 block">연락처 *</span>
                            <input
                                value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)}
                                placeholder="01012345678"
                                inputMode="tel"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50"
                            />
                        </label>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(255,107,157,0.25)', color: '#FF6B9D', border: '1px solid rgba(255,107,157,0.4)' }}
                    >
                        {loading ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                        모임 만들기
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── 출석부 생성 인라인 폼 ─────────────────────────────────

interface SheetCreateFormProps {
    clubId: string;
    onCreated: () => void;
}

const SheetCreateForm: React.FC<SheetCreateFormProps> = ({ clubId, onCreated }) => {
    const [title, setTitle]     = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const handleCreate = async () => {
        if (!title.trim()) return setError('출석부 제목을 입력해주세요.');
        setLoading(true); setError('');
        try {
            await apiFetch(`/api/clubs/${clubId}/sheets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim() }),
            });
            setTitle('');
            onCreated();
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-2">
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
                <input
                    value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="예: 5월 26일 정기 모임 출석"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50"
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                    style={{ background: 'rgba(255,107,157,0.2)', color: '#FF6B9D', border: '1px solid rgba(255,107,157,0.4)' }}
                >
                    {loading ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                    생성
                </button>
            </div>
        </div>
    );
};
