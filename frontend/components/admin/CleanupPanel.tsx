import React, { useState } from 'react';
import { sessionApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 메시지 정리 + DART 기업코드 갱신 탭 (AdminPanel #6 분해, 2026-06-01).
// 상태가 이 탭에만 갇혀 있어 AdminPanel 본체에서 통째로 추출 — 동작 보존.
export const CleanupPanel: React.FC = () => {
    const [cleanupDays, setCleanupDays] = useState(30);
    const [cleanupKeepCount, setCleanupKeepCount] = useState(10);
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleanupResult, setCleanupResult] = useState<{ cleanedSessions: number; deletedMessages: number } | null>(null);
    const [isDartImporting, setIsDartImporting] = useState(false);
    const [dartImportResult, setDartImportResult] = useState<{ count: number } | null>(null);

    const handleCleanup = async () => {
        if (!window.confirm(`${cleanupDays}일 이상 비활성 세션의 오래된 메시지를 삭제합니다. 계속하시겠습니까?`)) return;
        setIsCleaning(true);
        setCleanupResult(null);
        try {
            const result = await sessionApi.cleanup(cleanupDays, cleanupKeepCount);
            setCleanupResult(result);
        } catch {
            alert('메시지 정리 중 오류가 발생했습니다.');
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-md mx-auto space-y-5">
                <div className="flex items-center gap-2">
                    <Icon name="Trash2" size={16} className="text-red-400" />
                    <h3 className="text-sm font-bold text-white">오래된 메시지 정리</h3>
                </div>
                <div className="bg-red-900/10 border border-red-800/30 rounded-xl px-4 py-3 text-xs text-red-300 leading-relaxed">
                    요약이 생성된 세션 중 <span className="font-semibold">X일 이상 비활성</span> 세션의 오래된 메시지를 삭제합니다.<br />
                    최근 N개 메시지는 보존되며, 요약 및 세션은 유지됩니다.
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">비활성 기준 (일)</label>
                        <input
                            type="number"
                            value={cleanupDays}
                            onChange={e => setCleanupDays(Number(e.target.value))}
                            min={1}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <p className="text-[10px] text-gray-600 mt-1">마지막 활동 후 이 기간이 지난 세션 대상</p>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">보존할 최근 메시지 수</label>
                        <input
                            type="number"
                            value={cleanupKeepCount}
                            onChange={e => setCleanupKeepCount(Number(e.target.value))}
                            min={0}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <p className="text-[10px] text-gray-600 mt-1">0 입력 시 전체 삭제</p>
                    </div>
                </div>
                {cleanupResult && (
                    <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-4 py-3 text-xs text-green-300">
                        ✓ 완료: {cleanupResult.cleanedSessions}개 세션, {cleanupResult.deletedMessages}개 메시지 삭제
                    </div>
                )}
                <button
                    onClick={handleCleanup}
                    disabled={isCleaning}
                    className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-medium py-2 px-5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                    <Icon name="Trash2" size={14} />
                    {isCleaning ? '정리 중...' : '메시지 정리 실행'}
                </button>

                {/* DART 기업코드 갱신 */}
                <div className="pt-4 border-t border-gray-700/50">
                    <div className="flex items-center gap-2 mb-3">
                        <Icon name="TrendingUp" size={16} className="text-green-400" />
                        <h3 className="text-sm font-bold text-white">DART 기업코드 갱신</h3>
                    </div>
                    <div className="bg-green-900/10 border border-green-800/30 rounded-xl px-4 py-3 text-xs text-green-300 leading-relaxed mb-3">
                        DART 전체 상장·비상장 기업 코드를 DB에 저장합니다.<br />
                        최초 1회 실행 필수. 이후 분기별 갱신 권장. 약 2~3분 소요.
                    </div>
                    {dartImportResult && (
                        <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-4 py-3 text-xs text-green-300 mb-3">
                            ✓ 완료: 기업 코드 {dartImportResult.count.toLocaleString()}개 저장
                        </div>
                    )}
                    <button
                        onClick={async () => {
                            if (!window.confirm('DART에서 전체 기업코드를 다운받아 DB에 저장합니다. 2~3분 소요됩니다.')) return;
                            setIsDartImporting(true);
                            setDartImportResult(null);
                            try {
                                const res = await fetch('/api/dart-import', { method: 'POST', credentials: 'include' });
                                const data = await res.json();
                                if (data.ok) setDartImportResult({ count: data.count });
                                else alert(data.error || '오류 발생');
                            } catch { alert('요청 실패'); }
                            finally { setIsDartImporting(false); }
                        }}
                        disabled={isDartImporting}
                        className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white font-medium py-2 px-5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        <Icon name="TrendingUp" size={14} />
                        {isDartImporting ? '갱신 중... (2~3분)' : 'DART 기업코드 갱신'}
                    </button>
                </div>
            </div>
        </div>
    );
};
