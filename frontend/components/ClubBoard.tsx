import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, Plus, Users, QrCode, ClipboardList, RefreshCw, Loader, Copy, Check, Bell, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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

interface Notice {
    id: string;
    title: string;
    content: string;
    createdAt: string;
}

type View = 'list' | 'create' | 'detail' | 'members' | 'sheets' | 'sheet_records' | 'notices' | 'edit';

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
    const [notices, setNotices]         = useState<Notice[]>([]);
    const [copied, setCopied]           = useState<string | null>(null);
    const [noticeTitle, setNoticeTitle]     = useState('');
    const [noticeContent, setNoticeContent] = useState('');
    const [noticeLoading, setNoticeLoading] = useState(false);
    const [expandedSheetId, setExpandedSheetId] = useState<string | null>(null);
    const [editName, setEditName]           = useState('');
    const [editRegion, setEditRegion]       = useState('');
    const [editDesc, setEditDesc]           = useState('');
    const [editLoading, setEditLoading]     = useState(false);

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

    // 모임 삭제
    const deleteClub = async () => {
        if (!selectedClub) return;
        if (!window.confirm(`"${selectedClub.name}" 모임을 삭제하시겠습니까?\n모든 회원, 출석부, 공지가 함께 삭제됩니다.`)) return;
        try {
            await apiFetch(`/api/clubs/${selectedClub.id}`, { method: 'DELETE' });
            setSelectedClub(null);
            loadClubs();
            setView('list');
        } catch (e: any) { setError(e.message); }
    };

    // 모임 수정 저장
    const submitEdit = async () => {
        if (!selectedClub || !editName.trim()) return;
        setEditLoading(true); setError('');
        try {
            const data = await apiFetch<{ club: Club }>(`/api/clubs/${selectedClub.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim(), region: editRegion.trim(), description: editDesc.trim() }),
            });
            setSelectedClub({ ...selectedClub, ...data.club });
            setClubs(prev => prev.map(c => c.id === selectedClub.id ? { ...c, ...data.club } : c));
            setView('detail');
        } catch (e: any) { setError(e.message); }
        finally { setEditLoading(false); }
    };

    // 공지 목록 로드
    const loadNotices = useCallback(async (club: Club) => {
        setLoading(true); setError('');
        try {
            const data = await apiFetch<{ notices: Notice[] }>(`/api/clubs/${club.id}/notices`);
            setNotices(data.notices);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    // 공지 작성
    const submitNotice = async () => {
        if (!selectedClub || !noticeTitle.trim() || !noticeContent.trim()) return;
        setNoticeLoading(true);
        try {
            await apiFetch(`/api/clubs/${selectedClub.id}/notices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: noticeTitle.trim(), content: noticeContent.trim() }),
            });
            setNoticeTitle(''); setNoticeContent('');
            loadNotices(selectedClub);
        } catch (e: any) { setError(e.message); }
        finally { setNoticeLoading(false); }
    };

    // 공지 삭제
    const deleteNotice = async (noticeId: string) => {
        if (!selectedClub) return;
        try {
            await apiFetch(`/api/clubs/${selectedClub.id}/notices/${noticeId}`, { method: 'DELETE' });
            setNotices(prev => prev.filter(n => n.id !== noticeId));
        } catch (e: any) { setError(e.message); }
    };

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

                        <button
                            onClick={() => { loadNotices(selectedClub); setView('notices'); }}
                            className="w-full p-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-3"
                        >
                            <Bell size={18} className="text-pink-400" />
                            <div className="text-left">
                                <p className="text-sm font-medium text-white">공지사항</p>
                                <p className="text-xs text-white/40">{isOwner ? '공지 작성 및 관리' : '모임 공지 확인'}</p>
                            </div>
                        </button>

                        {!isOwner && (
                            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
                                <p className="text-sm text-white/50">가입된 모임입니다</p>
                                <p className="text-xs text-white/30 mt-1">가입일: {formatDate(selectedClub.createdAt)}</p>
                            </div>
                        )}

                        {isOwner && (
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => {
                                        setEditName(selectedClub.name);
                                        setEditRegion(selectedClub.region || '');
                                        setEditDesc(selectedClub.description || '');
                                        setError('');
                                        setView('edit');
                                    }}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
                                >
                                    ✏️ 모임 수정
                                </button>
                                <button
                                    onClick={deleteClub}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'rgba(239,68,68,0.8)' }}
                                >
                                    🗑️ 모임 삭제
                                </button>
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
                            const isExpanded = expandedSheetId === s.id;
                            return (
                                <div key={s.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                                    {/* 헤더 — 클릭으로 펼치기/닫기 */}
                                    <button
                                        onClick={() => setExpandedSheetId(isExpanded ? null : s.id)}
                                        className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">{s.title}</p>
                                            <p className="text-xs text-white/30 mt-0.5">{formatDate(s.createdAt)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-pink-400 font-bold">{s.attendeeCount}명 출석</span>
                                            <ChevronLeft size={15} className={`text-white/30 transition-transform ${isExpanded ? '-rotate-90' : 'rotate-180'}`} />
                                        </div>
                                    </button>

                                    {/* 펼쳐지는 내용 */}
                                    {isExpanded && (
                                        <div className="px-3.5 pb-3.5 border-t border-white/10 pt-3">
                                            <div className="flex gap-3 items-start">
                                                <div className="p-2 rounded-xl bg-white">
                                                    <QRCodeSVG value={url} size={110} />
                                                </div>
                                                <div className="flex flex-col gap-2 flex-1">
                                                    <button
                                                        onClick={() => copyUrl(url, s.id)}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs text-white/70"
                                                    >
                                                        {copied === s.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                                                        {copied === s.id ? '복사됨' : '링크 복사'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedSheet(s); loadRecords(s); setView('sheet_records'); }}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 transition-colors text-xs text-pink-400"
                                                    >
                                                        <Users size={13} />
                                                        출석 명단
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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

    // 모임 수정
    if (view === 'edit' && selectedClub) {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#1a1b23] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {renderHeader('모임 수정', () => setView('detail'))}

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {error && <p className="text-red-400 text-sm">{error}</p>}

                        <div className="space-y-1">
                            <p className="text-xs text-white/50">모임 이름 *</p>
                            <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                maxLength={30}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-white/50">지역 (선택)</p>
                            <input
                                type="text"
                                value={editRegion}
                                onChange={e => setEditRegion(e.target.value)}
                                placeholder="예: 서울 강남"
                                maxLength={20}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-white/50">설명 (선택)</p>
                            <textarea
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                                placeholder="모임 소개를 입력해주세요"
                                maxLength={200}
                                rows={3}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={submitEdit}
                            disabled={editLoading || !editName.trim()}
                            className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #FF6B9D, #C84B8F)', color: '#fff' }}
                        >
                            {editLoading ? <Loader size={16} className="animate-spin" /> : '저장'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 공지사항
    if (view === 'notices' && selectedClub) {
        const isOwner = selectedClub.myRole === 'OWNER';
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#1a1b23] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {renderHeader('공지사항', () => { setView('detail'); setNoticeTitle(''); setNoticeContent(''); })}

                    {/* 공지 목록 */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        {loading && <div className="flex justify-center py-8"><Loader size={24} className="text-pink-400 animate-spin" /></div>}
                        {!loading && notices.length === 0 && (
                            <div className="text-center py-10 text-white/40">
                                <Bell size={36} className="mx-auto mb-3 opacity-40" />
                                <p className="text-sm">등록된 공지가 없습니다.</p>
                            </div>
                        )}
                        {notices.map(n => {
                            const isExpanded = expandedSheetId === `notice-${n.id}`;
                            return (
                                <div key={n.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                                    <button
                                        onClick={() => setExpandedSheetId(isExpanded ? null : `notice-${n.id}`)}
                                        className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-white/5 transition-colors"
                                    >
                                        <p className="text-sm font-medium text-white text-left truncate pr-2">{n.title}</p>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-[11px] text-white/25">{formatDate(n.createdAt)}</span>
                                            <ChevronLeft size={15} className={`text-white/30 transition-transform ${isExpanded ? '-rotate-90' : 'rotate-180'}`} />
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="px-3.5 pb-3.5 border-t border-white/10 pt-3 space-y-2">
                                            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                                            {isOwner && (
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={() => deleteNotice(n.id)}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 size={12} /> 삭제
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 하단 — OWNER만 새 공지 작성 */}
                    {isOwner && (
                        <div className="p-4 border-t border-white/10 space-y-3">
                            {noticeTitle !== '' || noticeContent !== '' ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={noticeTitle}
                                        onChange={e => setNoticeTitle(e.target.value)}
                                        placeholder="제목"
                                        maxLength={50}
                                        className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
                                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                                    />
                                    <textarea
                                        value={noticeContent}
                                        onChange={e => setNoticeContent(e.target.value)}
                                        placeholder="내용"
                                        maxLength={500}
                                        rows={3}
                                        className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-pink-500/50 resize-none"
                                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setNoticeTitle(''); setNoticeContent(''); }}
                                            className="flex-1 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition-colors"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={submitNotice}
                                            disabled={noticeLoading || !noticeTitle.trim() || !noticeContent.trim()}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                            style={{ background: 'linear-gradient(135deg, #FF6B9D, #C84B8F)', color: '#fff' }}
                                        >
                                            {noticeLoading ? <Loader size={14} className="animate-spin" /> : '등록'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setNoticeTitle(' ')}
                                    className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                    style={{ background: 'rgba(255,107,157,0.15)', border: '1px solid rgba(255,107,157,0.3)', color: '#FF6B9D' }}
                                >
                                    <Plus size={15} /> 새 공지 작성
                                </button>
                            )}
                        </div>
                    )}
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
