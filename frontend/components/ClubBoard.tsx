import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, Plus, Users, QrCode, ClipboardList, RefreshCw, Loader, Copy, Check, Save, Trash2 } from 'lucide-react';
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

type View = 'list' | 'create' | 'detail' | 'sheet_records';
type DetailTab = 'info' | 'members' | 'sheets' | 'settings';

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
    const [detailTab, setDetailTab]     = useState<DetailTab>('info');   // 모임 상세 내 탭

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

    // 모임 삭제 (OWNER)
    const handleDeleteClub = useCallback(async (club: Club) => {
        await apiFetch(`/api/clubs/${club.id}`, { method: 'DELETE' });
        await loadClubs();
        setView('list');
    }, [loadClubs]);

    // ── 뷰별 렌더링 ─────────────────────────────────────────

    const renderHeader = (title: string, onBack?: () => void) => (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0E9DE]">
            <div className="flex items-center gap-2">
                {onBack && (
                    <button onClick={onBack} className="p-1 rounded-full hover:bg-[#F0E9DE] transition-colors">
                        <ChevronLeft size={20} className="text-[#5C5468]" />
                    </button>
                )}
                <h2 className="text-base font-semibold text-[#2D2438]">{title}</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-[#F0E9DE] transition-colors">
                <X size={20} className="text-[#5C5468]" />
            </button>
        </div>
    );

    // 모임 목록
    if (view === 'list') {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#FBF8F3] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                    {renderHeader('🤝 모임')}

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        {loading && (
                            <div className="flex justify-center py-8">
                                <Loader size={24} className="text-[#8E6FB7] animate-spin" />
                            </div>
                        )}
                        {!loading && clubs.length === 0 && (
                            <div className="text-center py-10 text-[#9089A1]">
                                <Users size={40} className="mx-auto mb-3 opacity-40" />
                                <p className="text-sm">아직 모임이 없습니다.</p>
                                <p className="text-xs mt-1">새 모임을 만들어 보세요!</p>
                            </div>
                        )}
                        {clubs.map(club => (
                            <button
                                key={club.id}
                                onClick={() => { setSelectedClub(club); setDetailTab('info'); setView('detail'); if (club.myRole === 'OWNER') { loadMembers(club); loadSheets(club); } }}
                                className="w-full text-left p-3.5 rounded-xl bg-white hover:bg-[#F0E9DE] transition-colors border border-[#F0E9DE]"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-[#2D2438]">{club.name}</p>
                                        {club.region && <p className="text-xs text-[#9089A1] mt-0.5">{club.region}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-[#9089A1]">{club.memberCount}명</span>
                                        {club.myRole === 'OWNER' && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5E6F7] text-[#8E6FB7] font-medium">
                                                관리자
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="p-4 border-t border-[#F0E9DE]">
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

    // 모임 상세 — 탭(정보/회원/출석부/설정) 통합
    if (view === 'detail' && selectedClub) {
        const isOwner = selectedClub.myRole === 'OWNER';
        const tabs: { key: DetailTab; label: string }[] = isOwner
            ? [
                { key: 'info',     label: '정보' },
                { key: 'members',  label: '회원' },
                { key: 'sheets',   label: '출석부' },
                { key: 'settings', label: '설정' },
              ]
            : [{ key: 'info', label: '정보' }];

        return (
          <>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                <div className="w-full sm:max-w-lg bg-[#FBF8F3] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                    {renderHeader(selectedClub.name, () => setView('list'))}

                    {/* 상단 탭 */}
                    {isOwner && (
                        <div className="flex border-b border-[#F0E9DE] px-2">
                            {tabs.map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => { setError(''); setDetailTab(t.key); }}
                                    className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
                                        detailTab === t.key ? 'text-[#8E6FB7]' : 'text-[#9089A1] hover:text-[#5C5468]'
                                    }`}
                                >
                                    {t.label}
                                    {detailTab === t.key && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#8E6FB7]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── 정보 탭 ── */}
                    {detailTab === 'info' && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {selectedClub.region && (
                                <p className="text-xs text-[#9089A1]">📍 {selectedClub.region}</p>
                            )}
                            {selectedClub.description && (
                                <p className="text-sm text-[#5C5468] leading-relaxed whitespace-pre-wrap">{selectedClub.description}</p>
                            )}
                            <div className="p-3.5 rounded-xl bg-white border border-[#F0E9DE] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-[#8E6FB7]" />
                                    <span className="text-sm text-[#5C5468]">전체 회원</span>
                                </div>
                                <span className="text-sm font-bold text-[#2D2438]">{selectedClub.memberCount}명</span>
                            </div>
                            {!isOwner && (
                                <p className="text-xs text-[#C9BEDB] text-center pt-1">가입일: {formatDate(selectedClub.createdAt)}</p>
                            )}
                        </div>
                    )}

                    {/* ── 회원 탭 ── */}
                    {isOwner && detailTab === 'members' && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loading && <div className="flex justify-center py-8"><Loader size={24} className="text-[#8E6FB7] animate-spin" /></div>}
                            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                            {!loading && members.length === 0 && (
                                <p className="text-center text-[#9089A1] text-sm py-8">회원이 없습니다.</p>
                            )}
                            {members.map(m => (
                                <div key={m.id} className="p-3 rounded-xl bg-white border border-[#F0E9DE] flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-[#2D2438]">{m.nickname}</p>
                                            {m.role === 'OWNER' && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5E6F7] text-[#8E6FB7] font-medium">관리자</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#9089A1] mt-0.5">{m.phone} · 가입 {formatDate(m.joinedAt)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-[#8E6FB7]">{m.attendanceCount}</p>
                                        <p className="text-[10px] text-[#C9BEDB]">출석</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── 출석부 탭 ── */}
                    {isOwner && detailTab === 'sheets' && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {loading && <div className="flex justify-center py-8"><Loader size={24} className="text-[#8E6FB7] animate-spin" /></div>}
                                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                                {!loading && sheets.length === 0 && (
                                    <div className="text-center py-10 text-[#9089A1]">
                                        <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
                                        <p className="text-sm">출석부가 없습니다.</p>
                                    </div>
                                )}
                                {sheets.map(s => {
                                    const url = getAttendanceUrl(s.qrUuid);
                                    return (
                                        <div key={s.id} className="p-3.5 rounded-xl bg-white border border-[#F0E9DE] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-[#2D2438]">{s.title}</p>
                                                <span className="text-xs text-[#8E6FB7] font-bold">{s.attendeeCount}명 출석</span>
                                            </div>
                                            <p className="text-xs text-[#C9BEDB]">{formatDate(s.createdAt)}</p>

                                            <div className="flex items-center gap-2 mt-1">
                                                <input
                                                    readOnly
                                                    value={url}
                                                    className="flex-1 min-w-0 text-[11px] bg-black/30 rounded-lg px-2 py-1.5 text-[#9089A1] border border-[#F0E9DE] truncate"
                                                />
                                                <button
                                                    onClick={() => copyUrl(url, s.id)}
                                                    className="p-1.5 shrink-0 rounded-lg bg-[#F0E9DE] hover:bg-[#EAE2D3] transition-colors"
                                                    title="출석 링크 복사"
                                                >
                                                    {copied === s.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-[#5C5468]" />}
                                                </button>
                                                <button
                                                    onClick={() => setQrSheet(s)}
                                                    className="p-1.5 shrink-0 rounded-lg bg-[#F0E9DE] hover:bg-[#EAE2D3] transition-colors"
                                                    title="QR 코드 보기"
                                                >
                                                    <QrCode size={14} className="text-[#5C5468]" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedSheet(s); loadRecords(s); setView('sheet_records'); }}
                                                    className="p-1.5 shrink-0 rounded-lg bg-[#F5E6F7] hover:bg-[#EADBF5] transition-colors"
                                                    title="출석 명단 보기"
                                                >
                                                    <Users size={14} className="text-[#8E6FB7]" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-4 border-t border-[#F0E9DE]">
                                <SheetCreateForm
                                    clubId={selectedClub.id}
                                    onCreated={() => loadSheets(selectedClub)}
                                />
                            </div>
                        </>
                    )}

                    {/* ── 설정 탭 (수정/삭제) ── */}
                    {isOwner && detailTab === 'settings' && (
                        <ClubSettingsTab
                            club={selectedClub}
                            onUpdated={(updated) => {
                                setSelectedClub({ ...selectedClub, ...updated });
                                loadClubs();
                            }}
                            onDelete={() => handleDeleteClub(selectedClub)}
                        />
                    )}
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
                            className="mt-1 px-6 py-2 rounded-xl bg-[#8E6FB7] hover:bg-[#7d5ea6] text-[#2D2438] text-sm font-medium transition-colors"
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
                <div className="w-full sm:max-w-lg bg-[#FBF8F3] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                    {renderHeader(`출석 명단 (${records.length}명)`, () => { setDetailTab('sheets'); setView('detail'); })}

                    <div className="px-4 py-2 border-b border-[#F0E9DE]">
                        <p className="text-sm text-[#5C5468]">{selectedSheet.title}</p>
                        <p className="text-xs text-[#C9BEDB]">{formatDate(selectedSheet.createdAt)}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {loading && <div className="flex justify-center py-8"><Loader size={24} className="text-[#8E6FB7] animate-spin" /></div>}
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        {!loading && records.length === 0 && (
                            <p className="text-center text-[#9089A1] text-sm py-8">아직 출석한 회원이 없습니다.</p>
                        )}
                        {records.map((r, i) => (
                            <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-[#F0E9DE]">
                                <span className="text-xs font-bold text-[#8E6FB7] w-5 text-center">{i + 1}</span>
                                <div className="flex-1">
                                    <p className="text-sm text-[#2D2438]">{r.nickname}</p>
                                    <p className="text-[11px] text-[#9089A1]">{r.phone}</p>
                                </div>
                                <p className="text-[11px] text-[#C9BEDB]">{formatDateTime(r.attendedAt)}</p>
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
            <div className="w-full sm:max-w-lg bg-[#FBF8F3] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0E9DE]">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="p-1 rounded-full hover:bg-[#F0E9DE] transition-colors">
                            <ChevronLeft size={20} className="text-[#5C5468]" />
                        </button>
                        <h2 className="text-base font-semibold text-[#2D2438]">새 모임 만들기</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[#F0E9DE] transition-colors">
                        <X size={20} className="text-[#5C5468]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <label className="block">
                        <span className="text-xs text-[#9089A1] mb-1 block">모임 이름 *</span>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            placeholder="예: 수요 테니스 모임"
                            className="w-full bg-white border border-[#F0E9DE] rounded-xl px-3 py-2.5 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs text-[#9089A1] mb-1 block">활동 지역</span>
                        <input
                            value={region} onChange={e => setRegion(e.target.value)}
                            placeholder="예: 서울 강남"
                            className="w-full bg-white border border-[#F0E9DE] rounded-xl px-3 py-2.5 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs text-[#9089A1] mb-1 block">모임 소개</span>
                        <textarea
                            value={description} onChange={e => setDesc(e.target.value)}
                            placeholder="모임에 대해 간단히 소개해주세요."
                            rows={3}
                            className="w-full bg-white border border-[#F0E9DE] rounded-xl px-3 py-2.5 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50 resize-none"
                        />
                    </label>

                    <div className="border-t border-[#F0E9DE] pt-3">
                        <p className="text-xs text-[#9089A1] mb-2">개설자 정보 (회원 명부 등록용)</p>
                        <label className="block mb-3">
                            <span className="text-xs text-[#9089A1] mb-1 block">이름 / 별명 *</span>
                            <input
                                value={ownerNickname} onChange={e => setOwnerNickname(e.target.value)}
                                placeholder="예: 홍길동"
                                className="w-full bg-white border border-[#F0E9DE] rounded-xl px-3 py-2.5 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs text-[#9089A1] mb-1 block">연락처 *</span>
                            <input
                                value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)}
                                placeholder="01012345678"
                                inputMode="tel"
                                className="w-full bg-white border border-[#F0E9DE] rounded-xl px-3 py-2.5 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50"
                            />
                        </label>
                    </div>
                </div>

                <div className="p-4 border-t border-[#F0E9DE]">
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
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
                <input
                    value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="예: 5월 26일 정기 모임 출석"
                    className="flex-1 bg-white border border-[#F0E9DE] rounded-xl px-3 py-2 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50"
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

// ── 설정 탭: 모임 수정 + 삭제 (OWNER) ─────────────────────

interface ClubSettingsTabProps {
    club: Club;
    onUpdated: (patch: { name: string; region: string; description: string }) => void;
    onDelete: () => Promise<void>;
}

const ClubSettingsTab: React.FC<ClubSettingsTabProps> = ({ club, onUpdated, onDelete }) => {
    const [name, setName]        = useState(club.name);
    const [region, setRegion]    = useState(club.region ?? '');
    const [description, setDesc] = useState(club.description ?? '');
    const [saving, setSaving]    = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError]      = useState('');
    const [saved, setSaved]      = useState(false);

    const dirty = name !== club.name || region !== (club.region ?? '') || description !== (club.description ?? '');

    const handleSave = async () => {
        if (!name.trim()) return setError('모임 이름을 입력해주세요.');
        setSaving(true); setError(''); setSaved(false);
        try {
            await apiFetch(`/api/clubs/${club.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), region: region.trim(), description: description.trim() }),
            });
            onUpdated({ name: name.trim(), region: region.trim(), description: description.trim() });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setDeleting(true); setError('');
        try {
            await onDelete();
        } catch (e: any) { setError(e.message); setDeleting(false); }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <label className="block">
                <span className="text-xs text-[#9089A1] mb-1 block">모임 이름 *</span>
                <input
                    value={name} onChange={e => setName(e.target.value)}
                    className="w-full bg-white border border-[#F0E9DE] rounded-xl px-3 py-2.5 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50"
                />
            </label>

            <label className="block">
                <span className="text-xs text-[#9089A1] mb-1 block">활동 지역</span>
                <input
                    value={region} onChange={e => setRegion(e.target.value)}
                    placeholder="예: 서울 강남"
                    className="w-full bg-white border border-[#F0E9DE] rounded-xl px-3 py-2.5 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50"
                />
            </label>

            <label className="block">
                <span className="text-xs text-[#9089A1] mb-1 block">모임 소개</span>
                <textarea
                    value={description} onChange={e => setDesc(e.target.value)}
                    placeholder="모임에 대해 간단히 소개해주세요."
                    rows={3}
                    className="w-full bg-white border border-[#F0E9DE] rounded-xl px-3 py-2.5 text-sm text-[#2D2438] placeholder:text-[#C9BEDB] focus:outline-none focus:border-[#8E6FB7]/50 resize-none"
                />
            </label>

            <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                style={{ background: 'rgba(255,107,157,0.25)', color: '#FF6B9D', border: '1px solid rgba(255,107,157,0.4)' }}
            >
                {saving ? <Loader size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? '저장됨' : '변경사항 저장'}
            </button>

            {/* 위험 구역: 삭제 */}
            <div className="border-t border-[#F0E9DE] pt-4 mt-2">
                {!confirmDelete ? (
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                        <Trash2 size={16} />
                        모임 삭제
                    </button>
                ) : (
                    <div className="space-y-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                        <p className="text-sm text-red-300 font-medium">정말 삭제할까요?</p>
                        <p className="text-xs text-red-300/70 leading-relaxed">
                            모임의 <b>회원 명부·출석부·출석 기록·공지</b>가 모두 영구 삭제됩니다. 되돌릴 수 없습니다.
                        </p>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => setConfirmDelete(false)}
                                disabled={deleting}
                                className="flex-1 py-2 rounded-lg text-sm bg-[#F0E9DE] text-[#5C5468] hover:bg-[#EAE2D3] transition-colors disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-500 text-[#2D2438] hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {deleting ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                삭제
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
