import React, { useEffect, useState } from 'react';
import { Coins, Star, TrendingDown, X } from 'lucide-react';
import { pointApi } from '../services/pointService';

interface PointDashboardProps {
    onClose: () => void;
    onCharge: () => void;
    onBalanceRefresh?: (paidPoints: number, bonusPoints: number) => void;
}

const TYPE_LABEL: Record<string, string> = {
    SIGNUP: '가입 보너스', CHAT: '대화', LEVELUP: '레벨업 보너스',
    BALLOON: '별스타', STAR: '별스타', CHARGE: '충전', ADMIN: '관리자 지급',
};

export const PointDashboard: React.FC<PointDashboardProps> = ({ onClose, onCharge, onBalanceRefresh }) => {
    const [data, setData] = useState<any>(null);
    const [balance, setBalance] = useState<{ paidPoints: number; bonusPoints: number; points: number; transactions: any[] } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([pointApi.getStats(), pointApi.getBalance()])
            .then(([stats, bal]) => {
                setData(stats);
                setBalance(bal);
                onBalanceRefresh?.(bal.paidPoints, bal.bonusPoints);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Coins size={20} className="text-yellow-400" />포인트 현황
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                {loading && <p className="text-gray-400 text-sm text-center py-8">불러오는 중...</p>}

                {!loading && data && balance && (
                    <>
                        <div className="bg-gray-800 rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">현재 잔액</p>
                                    <p className="text-3xl font-bold text-yellow-400">
                                        {balance.points.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">pt</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">총 소비</p>
                                    <p className="text-lg font-bold text-red-400">{data.totalSpent.toLocaleString()}pt</p>
                                    <button onClick={onCharge} className="mt-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors">충전하기 →</button>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-3 border-t border-gray-700">
                                <div className="flex-1 bg-gray-900 rounded-lg px-3 py-2">
                                    <p className="text-[10px] text-gray-500 mb-0.5">유료</p>
                                    <p className="text-sm font-bold text-yellow-300">{balance.paidPoints.toLocaleString()}pt</p>
                                </div>
                                <div className="flex-1 bg-gray-900 rounded-lg px-3 py-2">
                                    <p className="text-[10px] text-gray-500 mb-0.5">무료</p>
                                    <p className="text-sm font-bold text-yellow-500">{balance.bonusPoints.toLocaleString()}pt</p>
                                </div>
                            </div>
                        </div>

                        {data.byPersona.length > 0 && (
                            <div className="mb-4">
                                <p className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-1">
                                    <TrendingDown size={14} />페르소나별 소비
                                </p>
                                {data.byPersona.map((b: any) => (
                                    <div key={b.personaId} className="flex items-center gap-2 py-1.5">
                                        {b.persona?.imageUrl && (
                                            <img src={b.persona.imageUrl} className="w-6 h-6 rounded-full object-cover object-top flex-shrink-0" alt="" />
                                        )}
                                        <span className="text-sm text-gray-300 flex-1 truncate">{b.persona?.name ?? '알 수 없음'}</span>
                                        <span className="text-sm text-yellow-400">{b.spent}pt</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {data.starsSent > 0 && (
                            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 mb-4 flex items-center gap-2">
                                <Star size={16} className="text-yellow-400 flex-shrink-0" fill="currentColor" />
                                <span className="text-sm text-gray-300">
                                    보낸 별스타 <strong className="text-yellow-400">{data.starsSent}개</strong> ({data.starsPointsSpent}pt 사용)
                                </span>
                            </div>
                        )}

                        <div>
                            <p className="text-sm font-semibold text-gray-300 mb-2">최근 내역</p>
                            <div className="space-y-0.5">
                                {balance.transactions.slice(0, 20).map((tx: any) => (
                                    <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 text-sm">
                                        <div className="min-w-0">
                                            <span className="text-gray-300">{TYPE_LABEL[tx.type] ?? tx.type}</span>
                                            {tx.persona && <span className="text-xs text-gray-500 ml-1 truncate">({tx.persona.name})</span>}
                                        </div>
                                        <span className={`flex-shrink-0 ml-2 font-medium ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {tx.amount > 0 ? '+' : ''}{tx.amount}pt
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
