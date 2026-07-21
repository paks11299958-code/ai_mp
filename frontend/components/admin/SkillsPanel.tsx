import React, { useState } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 스킬 카탈로그(Claude Code 스킬/MCP/플러그인 탐색기) 관리 — 동기화 버튼으로 최신 목록 반영.
// 실제 동기화는 서버2 워커(dev_request_worker.py → skill_ops.sync_catalog)가 큐를 폴링해 처리
// (2분 주기 크론) → build_catalog.py 재실행 → sites/skills/index.html 갱신 → git push → Vercel 재배포.
const CATALOG_URL = 'https://aichat.dbzone.kr/sites/skills/';

export const SkillsPanel: React.FC = () => {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    const sync = async () => {
        setBusy(true); setMsg('');
        try {
            await adminApi.syncSkills();
            setMsg('🔄 동기화를 요청했어요. 최대 2분 후 카탈로그에 반영됩니다.');
        } catch {
            setMsg('❌ 동기화 요청 실패. 다시 시도해 주세요.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Icon name="Zap" size={18} className="text-yellow-400" />
                        <h3 className="text-base font-bold text-white">스킬 카탈로그</h3>
                    </div>
                    <button onClick={sync} disabled={busy}
                        className="text-xs text-gray-300 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40">
                        <Icon name="RefreshCw" size={13} /> {busy ? '동기화 중…' : '동기화'}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                    Claude Code 스킬·MCP·플러그인 목록을 탭·카테고리로 정리한 탐색기입니다.
                    스킬을 추가/삭제한 뒤 동기화 버튼을 누르면 최신 목록이 반영됩니다.
                </p>

                {msg && <div className="text-xs text-amber-300 mb-3">{msg}</div>}

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <a href={CATALOG_URL} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-bold text-sky-300 hover:underline inline-flex items-center gap-1">
                        skills <Icon name="ExternalLink" size={12} />
                    </a>
                    <div className="text-[11px] text-gray-500 mt-0.5 font-mono">{CATALOG_URL}</div>
                    <div className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                        원본: ~/.claude/skills/_catalog/build_catalog.py 생성물
                    </div>
                </div>
            </div>
        </div>
    );
};
