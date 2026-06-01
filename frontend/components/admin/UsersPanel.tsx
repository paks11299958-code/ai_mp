import React, { useState, useEffect } from 'react';
import { adminApi, AdminUser } from '../../services/apiService';
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
                                            <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
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
                                                <button
                                                    onClick={() => { setGrantTarget(u); setGrantMsg(null); setGrantAmount(''); setGrantDesc(''); }}
                                                    className="px-3 py-1 rounded-lg bg-blue-900/50 hover:bg-blue-800/70 text-blue-300 text-xs transition-colors"
                                                >
                                                    포인트 지급
                                                </button>
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
        </div>
    );
};
