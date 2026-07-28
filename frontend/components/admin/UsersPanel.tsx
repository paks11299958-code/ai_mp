import React, { useState, useEffect } from 'react';
import { adminApi, AdminUser, UserTransactionRow } from '../../services/apiService';
import { Icon } from '../Icons';

// 회원 관리 탭 — 일괄/개인 포인트 지급 + 회원 목록 + 역할 변경.
// AdminPanel #6 분해(2026-06-01). 상태 12개·핸들러가 모두 이 탭에만 갇혀 있어
// props 없이 자족 추출(adminApi만 사용). mount 시 회원 목록 로드.
export const UsersPanel: React.FC = () => {
    const [userList, setUserList] = useState<AdminUser[]>([]);
    const [userListLoading, setUserListLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
    const [grantAmount, setGrantAmount] = useState('');
    const [grantDesc, setGrantDesc] = useState('');
    const [granting, setGranting] = useState(false);
    const [grantMsg, setGrantMsg] = useState<string | null>(null);
    const [bulkAmount, setBulkAmount] = useState('');
    const [bulkDesc, setBulkDesc] = useState('');
    const [bulkGranting, setBulkGranting] = useState(false);
    const [bulkMsg, setBulkMsg] = useState<string | null>(null);
    // 회원 탈퇴(하드 삭제) — 복구 불가라 이메일/식별자 타이핑 2단계 확인
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    // 포인트 사용 내역 모달 — 날짜·시간 desc(2026-07-20 사장 지시)
    const [historyTarget, setHistoryTarget] = useState<AdminUser | null>(null);
    const [historyRows, setHistoryRows] = useState<UserTransactionRow[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    useEffect(() => {
        setUserListLoading(true);
        adminApi.getUsers().then(setUserList).catch(() => {}).finally(() => setUserListLoading(false));
    }, []);

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 일괄 포인트 지급 */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <Icon name="Zap" size={15} className="text-yellow-400" />
                    전체 회원 일괄 무료 포인트 지급
                </h3>
                <div className="flex gap-3 flex-wrap">
                    <input
                        type="number"
                        placeholder="지급 포인트"
                        value={bulkAmount}
                        onChange={e => setBulkAmount(e.target.value)}
                        className="w-36 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <input
                        type="text"
                        placeholder="지급 사유 (선택)"
                        value={bulkDesc}
                        onChange={e => setBulkDesc(e.target.value)}
                        className="flex-1 min-w-40 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                        disabled={bulkGranting || !bulkAmount || Number(bulkAmount) <= 0}
                        onClick={async () => {
                            if (!window.confirm(`전체 ${userList.length}명에게 ${bulkAmount}포인트를 지급합니다. 계속하시겠습니까?`)) return;
                            setBulkGranting(true); setBulkMsg(null);
                            try {
                                const r = await adminApi.bulkGrant(Number(bulkAmount), bulkDesc || undefined);
                                setBulkMsg(`✅ ${r.userCount}명에게 ${r.granted}포인트 지급 완료`);
                                setBulkAmount(''); setBulkDesc('');
                                adminApi.getUsers().then(setUserList).catch(() => {});
                            } catch { setBulkMsg('❌ 오류가 발생했습니다.'); }
                            finally { setBulkGranting(false); }
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {bulkGranting ? '지급 중...' : '전체 지급'}
                    </button>
                </div>
                {bulkMsg && <p className="mt-2 text-xs text-gray-300">{bulkMsg}</p>}
            </div>

            {/* 개인 포인트 지급 */}
            {grantTarget && (
                <div className="bg-gray-800 rounded-xl p-5 border border-blue-700">
                    <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                        <Icon name="Gift" size={15} className="text-blue-400" />
                        개인 포인트 지급 — <span className="text-blue-300">{grantTarget.email ?? grantTarget.phone}</span>
                    </h3>
                    <div className="flex gap-3 flex-wrap">
                        <input
                            type="number"
                            placeholder="지급 포인트"
                            value={grantAmount}
                            onChange={e => setGrantAmount(e.target.value)}
                            className="w-36 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                        <input
                            type="text"
                            placeholder="지급 사유 (선택)"
                            value={grantDesc}
                            onChange={e => setGrantDesc(e.target.value)}
                            className="flex-1 min-w-40 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                        <button
                            disabled={granting || !grantAmount || Number(grantAmount) <= 0}
                            onClick={async () => {
                                setGranting(true); setGrantMsg(null);
                                try {
                                    const r = await adminApi.grantPoints(grantTarget.email ?? grantTarget.phone ?? '', Number(grantAmount), grantDesc || undefined);
                                    setGrantMsg(`✅ ${r.email}에게 ${r.granted}포인트 지급 완료 (잔액: ${r.newBalance})`);
                                    setGrantAmount(''); setGrantDesc(''); setGrantTarget(null);
                                    adminApi.getUsers().then(setUserList).catch(() => {});
                                } catch { setGrantMsg('❌ 오류가 발생했습니다.'); }
                                finally { setGranting(false); }
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {granting ? '지급 중...' : '지급'}
                        </button>
                        <button onClick={() => { setGrantTarget(null); setGrantMsg(null); }}
                            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
                            취소
                        </button>
                    </div>
                    {grantMsg && <p className="mt-2 text-xs text-gray-300">{grantMsg}</p>}
                </div>
            )}

            {/* 유저 목록 */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                        <Icon name="Users" size={15} className="text-gray-400" />
                        전체 회원 목록 ({userList.length}명)
                    </h3>
                    <input
                        type="text"
                        placeholder="이메일 / 이름 검색"
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        className="w-48 px-3 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                </div>
                {userListLoading ? (
                    <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-500 text-left">
                                    <th className="px-4 py-3 font-medium">이메일</th>
                                    <th className="px-4 py-3 font-medium">닉네임</th>
                                    <th className="px-4 py-3 font-medium text-right">유료P</th>
                                    <th className="px-4 py-3 font-medium text-right">무료P</th>
                                    <th className="px-4 py-3 font-medium text-right">세션</th>
                                    <th className="px-4 py-3 font-medium">가입일</th>
                                    <th className="px-4 py-3 font-medium">최근 접속</th>
                                    <th className="px-4 py-3 font-medium">역할</th>
                                    <th className="px-4 py-3 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {userList
                                    .filter(u => {
                                        const q = userSearch.toLowerCase();
                                        const identifier = u.email ?? u.phone ?? '';
                                        return !q || identifier.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
                                    })
                                    .map(u => (
                                        <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                                            <td className="px-4 py-3 text-gray-200">{u.email ?? u.phone}</td>
                                            <td className="px-4 py-3 text-gray-400">{u.username || '—'}</td>
                                            <td className="px-4 py-3 text-right text-blue-300">{u.paidPoints.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-yellow-300">{u.bonusPoints.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-gray-400">{u.sessionCount}</td>
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(u.createdAt).toLocaleString('sv-SE').slice(0, 16)}</td>
                                            {/* 최근 접속 — 가입일만으론 "가입만 하고 안 오는 사람"과
                                                "계속 쓰는 사람"이 구분되지 않는다(2026-07-28 사장 지시).
                                                lastLoginAt 도입 이전 로그인은 기록이 없어 '—'로 뜬다. */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {u.lastLoginAt
                                                    ? <span className="text-gray-500">{new Date(u.lastLoginAt).toLocaleString('sv-SE').slice(0, 16)}</span>
                                                    : <span className="text-gray-600">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={u.role}
                                                    onChange={async (e) => {
                                                        const newRole = e.target.value;
                                                        if (!window.confirm(`${u.email ?? u.phone} 의 등급을 ${newRole}로 변경하시겠습니까?`)) return;
                                                        try {
                                                            await adminApi.changeRole(u.id, newRole);
                                                            adminApi.getUsers().then(setUserList).catch(() => {});
                                                        } catch { alert('역할 변경 실패'); }
                                                    }}
                                                    className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${u.role === 'ADMIN' ? 'bg-red-900/50 text-red-300' : u.role === 'MANAGE' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-gray-700 text-gray-400'}`}
                                                >
                                                    <option value="USER">USER</option>
                                                    <option value="MANAGE">MANAGE</option>
                                                    <option value="ADMIN">ADMIN</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => { setGrantTarget(u); setGrantMsg(null); setGrantAmount(''); setGrantDesc(''); }}
                                                        className="px-3 py-1 rounded-lg bg-blue-900/50 hover:bg-blue-800/70 text-blue-300 text-xs transition-colors"
                                                    >
                                                        포인트 지급
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setHistoryTarget(u); setHistoryRows([]); setHistoryError(null);
                                                            setHistoryLoading(true);
                                                            adminApi.getUserTransactions(u.id)
                                                                .then(setHistoryRows)
                                                                .catch(e => setHistoryError(e?.message || '내역을 불러오지 못했습니다.'))
                                                                .finally(() => setHistoryLoading(false));
                                                        }}
                                                        className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                                                    >
                                                        내역보기
                                                    </button>
                                                    <button
                                                        onClick={() => { setDeleteTarget(u); setDeleteConfirmText(''); setDeleteError(null); }}
                                                        className="px-3 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 text-xs transition-colors"
                                                    >
                                                        탈퇴
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                        {userList.length === 0 && (
                            <div className="p-8 text-center text-sm text-gray-500">회원이 없습니다.</div>
                        )}
                    </div>
                )}
            </div>

            {/* 회원 탈퇴(하드 삭제) 확인 모달 — 복구 불가라 식별자 타이핑 2단계 확인 */}
            {deleteTarget && (() => {
                const identifier = deleteTarget.email ?? deleteTarget.phone ?? String(deleteTarget.id);
                const confirmed = deleteConfirmText.trim() === identifier;
                const hasPaid = (deleteTarget.paidPoints ?? 0) > 0;
                return (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={() => !deleting && setDeleteTarget(null)}>
                        <div className="w-full max-w-md bg-gray-900 border border-red-800/60 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-2">
                                <Icon name="Trash2" size={16} className="text-red-400" />
                                <h3 className="text-sm font-semibold text-red-300">회원 탈퇴 (완전 삭제)</h3>
                            </div>
                            <div className="px-5 py-4 space-y-3 text-sm">
                                <p className="text-gray-300">
                                    <span className="font-semibold text-white">{identifier}</span> 회원을 영구 삭제합니다.
                                </p>
                                <div className="rounded-lg bg-red-900/20 border border-red-800/40 p-3 text-xs text-red-200 space-y-1">
                                    <div>⚠️ 이 작업은 <b>되돌릴 수 없습니다.</b></div>
                                    <div>채팅 세션({deleteTarget.sessionCount}개)·포인트·게시글·기록이 모두 삭제됩니다.</div>
                                    {hasPaid && <div className="text-yellow-300">💰 유료 포인트 {deleteTarget.paidPoints.toLocaleString()}P 보유 — 결제 이력도 함께 삭제됩니다. 정산 확인 후 진행하세요.</div>}
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">
                                        확인을 위해 <span className="font-mono text-gray-200">{identifier}</span> 를 입력하세요
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={e => setDeleteConfirmText(e.target.value)}
                                        placeholder={identifier}
                                        autoFocus
                                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:outline-none focus:border-red-500"
                                    />
                                </div>
                                {deleteError && <div className="text-xs text-red-400">{deleteError}</div>}
                            </div>
                            <div className="px-5 py-3 border-t border-gray-700 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={deleting}
                                    className="px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs transition-colors disabled:opacity-50"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!confirmed) return;
                                        setDeleting(true); setDeleteError(null);
                                        try {
                                            await adminApi.deleteUser(deleteTarget.id);
                                            setDeleteTarget(null);
                                            adminApi.getUsers().then(setUserList).catch(() => {});
                                        } catch (e: any) {
                                            setDeleteError(e?.message || '삭제에 실패했습니다.');
                                        } finally {
                                            setDeleting(false);
                                        }
                                    }}
                                    disabled={!confirmed || deleting}
                                    className="px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {deleting ? '삭제 중...' : '영구 삭제'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* 포인트 사용 내역 모달 — 날짜·시간 desc(2026-07-20 사장 지시) */}
            {historyTarget && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={() => setHistoryTarget(null)}>
                    <div className="w-full max-w-lg max-h-[80vh] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                                <Icon name="Clock" size={16} className="text-gray-400" />
                                사용 내역 — <span className="text-blue-300">{historyTarget.email ?? historyTarget.phone}</span>
                            </h3>
                            <button onClick={() => setHistoryTarget(null)} className="text-gray-400 hover:text-white">
                                <Icon name="X" size={16} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {historyLoading ? (
                                <div className="p-8 text-center text-sm text-gray-500">불러오는 중...</div>
                            ) : historyError ? (
                                <div className="p-8 text-center text-sm text-red-400">{historyError}</div>
                            ) : historyRows.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-500">사용 내역이 없습니다.</div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-gray-900">
                                        <tr className="border-b border-gray-700 text-gray-500 text-left">
                                            <th className="px-4 py-2 font-medium">일시</th>
                                            <th className="px-4 py-2 font-medium">내용</th>
                                            <th className="px-4 py-2 font-medium text-right">증감</th>
                                            <th className="px-4 py-2 font-medium text-right">잔액</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyRows.map(r => (
                                            <tr key={r.id} className="border-b border-gray-800/60">
                                                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                                                    {new Date(r.createdAt).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-2 text-gray-200">
                                                    {r.description || r.type}
                                                    {r.personaName && <span className="text-gray-500"> · {r.personaName}</span>}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-medium ${r.amount >= 0 ? 'text-blue-300' : 'text-gray-300'}`}>
                                                    {r.amount >= 0 ? '+' : ''}{r.amount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-500">{r.balanceAfter.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
