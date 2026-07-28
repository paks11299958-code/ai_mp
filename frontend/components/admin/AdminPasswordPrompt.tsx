import React, { useState } from 'react';

// 위험 작업 비밀번호 재확인 모달 (2026-07-29)
// ★전체 어드민 작업이 아니라 "돈이 걸리거나 되돌리기 어려운" 것에만 쓴다.
//   전부에 걸면 손이 먼저 외워서 정작 위험한 순간에도 생각 없이 치게 된다.
// 사용법:
//   const [ask, setAsk] = useState<null | ((pw: string) => void)>(null);
//   ... <AdminPasswordPrompt title="봇 재시작" onConfirm={pw => run(pw)} onCancel={() => setAsk(null)} />

interface Props {
    title: string;               // 무슨 작업인지 (예: "토스봇 재시작")
    detail?: string;             // 부연 (예: "긴급정지가 해제됩니다")
    danger?: boolean;            // 실거래·자산 이동이면 true → 빨강 강조
    onConfirm: (password: string) => Promise<void> | void;
    onCancel: () => void;
}

export const AdminPasswordPrompt: React.FC<Props> = ({ title, detail, danger, onConfirm, onCancel }) => {
    const [pw, setPw] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!pw) { setErr('비밀번호를 입력하세요.'); return; }
        setBusy(true); setErr('');
        try {
            await onConfirm(pw);
        } catch (e: any) {
            // 서버가 PASSWORD_INVALID로 거절하면 모달을 닫지 않고 재입력을 받는다
            setErr(e?.message || '확인에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm"
                onClick={e => e.stopPropagation()}>
                <p className={`text-sm font-semibold mb-1 ${danger ? 'text-red-300' : 'text-white'}`}>
                    {danger ? '⚠️ ' : '🔒 '}{title}
                </p>
                {detail && <p className="text-xs text-gray-400 mb-3">{detail}</p>}
                <p className="text-xs text-gray-500 mb-3">확인을 위해 로그인 비밀번호를 입력하세요.</p>

                <input
                    type="password"
                    value={pw}
                    autoFocus
                    onChange={e => { setPw(e.target.value); setErr(''); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !busy) submit(); }}
                    placeholder="비밀번호"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white mb-2"
                />
                {err && <p className="text-xs text-red-400 mb-2">{err}</p>}

                <div className="flex gap-2 mt-2">
                    <button onClick={onCancel} disabled={busy}
                        className="flex-1 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm disabled:opacity-50">
                        취소
                    </button>
                    <button onClick={submit} disabled={busy || !pw}
                        className={`flex-1 py-2 rounded-lg text-white text-sm disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'}`}>
                        {busy ? '확인 중…' : '확인'}
                    </button>
                </div>
            </div>
        </div>
    );
};
