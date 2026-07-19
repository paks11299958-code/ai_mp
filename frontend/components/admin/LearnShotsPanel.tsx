import React, { useEffect, useState } from 'react';
import { learnShotApi, type LearnShotSlot } from '../../services/apiService';

// 📸 학습자료 이미지 — 사장이 실제 화면(깃허브·버셀)을 캡처해 강의 본문의 고정 자리에 채운다.
// 자리 목록은 서버(SHOT_SLOTS)가 정본이라 여기서 추가/삭제하지 않는다(채우기·비우기만).
// 새 편이 생기면 서버 SHOT_SLOTS + 아래 COURSES에 한 줄씩 추가.
// 정본 메모리=[[project_learn_course]].

const COURSES = [
    { key: 'homepage2', label: '2편 — 내 홈페이지를 인터넷에 올리기' },
];

export const LearnShotsPanel: React.FC = () => {
    const [course, setCourse] = useState(COURSES[0].key);
    const [slots, setSlots] = useState<LearnShotSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);   // 업로드 중인 slotKey
    const [err, setErr] = useState('');

    const load = React.useCallback(() => {
        setLoading(true);
        learnShotApi.adminList(course)
            .then(setSlots)
            .catch(e => setErr(e?.message || '목록을 불러오지 못했어요.'))
            .finally(() => setLoading(false));
    }, [course]);
    useEffect(load, [load]);

    const pick = async (slotKey: string, file: File) => {
        if (!file.type.startsWith('image/')) { setErr('이미지 파일만 올릴 수 있어요.'); return; }
        setErr(''); setBusy(slotKey);
        try {
            const url = await learnShotApi.upload(course, slotKey, file);
            setSlots(prev => prev.map(s => s.key === slotKey ? { ...s, imageUrl: url, updatedAt: new Date().toISOString() } : s));
        } catch (e: any) {
            setErr(e?.message || '업로드에 실패했어요.');
        } finally {
            setBusy(null);
        }
    };

    const clear = async (slotKey: string) => {
        if (!confirm('이 자리의 이미지를 지울까요? 강의에서는 다시 안내 박스로 보입니다.')) return;
        setErr(''); setBusy(slotKey);
        try {
            await learnShotApi.save(course, slotKey, '');
            setSlots(prev => prev.map(s => s.key === slotKey ? { ...s, imageUrl: '', updatedAt: null } : s));
        } catch (e: any) {
            setErr(e?.message || '삭제에 실패했어요.');
        } finally {
            setBusy(null);
        }
    };

    const filled = slots.filter(s => s.imageUrl).length;

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-bold text-white">📸 학습자료 이미지</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        강의에 넣을 실제 화면 캡처예요. 올리면 <b>바로</b> 강의에 반영됩니다.
                    </p>
                </div>
                <select value={course} onChange={e => setCourse(e.target.value)}
                        className="border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-800 text-gray-100">
                    {COURSES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
            </div>

            {!loading && (
                <div className="bg-indigo-950 border border-indigo-500/40 rounded-xl px-4 py-3 text-sm text-indigo-100">
                    {filled}/{slots.length} 자리 채워짐
                    {filled < slots.length && ' — 빈 자리는 강의에서 📸 안내 박스로 보여요(글만으로도 읽힙니다).'}
                </div>
            )}

            {err && (
                <div className="bg-red-950 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-100 flex items-center justify-between gap-3">
                    <span>{err}</span>
                    <button onClick={() => setErr('')} className="text-xs font-bold underline flex-shrink-0">닫기</button>
                </div>
            )}

            {loading ? (
                <p className="text-sm text-gray-500 py-8 text-center">불러오는 중...</p>
            ) : (
                <div className="space-y-3">
                    {slots.map(s => (
                        <div key={s.key} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm text-gray-100">{s.label}</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">
                                        {s.imageUrl
                                            ? `올림 · ${s.updatedAt ? new Date(s.updatedAt).toLocaleString('ko-KR') : ''}`
                                            : '아직 없음'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <label className={`text-xs font-bold px-3 py-2 rounded-lg cursor-pointer ${
                                        busy === s.key ? 'bg-gray-700 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}>
                                        {busy === s.key ? '올리는 중...' : s.imageUrl ? '📷 바꾸기' : '📷 사진 올리기'}
                                        <input type="file" accept="image/*" className="hidden" disabled={busy === s.key}
                                               onChange={e => { const f = e.target.files?.[0]; if (f) pick(s.key, f); e.target.value = ''; }} />
                                    </label>
                                    {s.imageUrl && (
                                        <button onClick={() => clear(s.key)} disabled={busy === s.key}
                                                className="text-xs font-bold px-3 py-2 rounded-lg border border-gray-700 text-red-400 hover:bg-red-500/10 disabled:opacity-40">
                                            지우기
                                        </button>
                                    )}
                                </div>
                            </div>

                            {s.imageUrl && (
                                <a href={s.imageUrl} target="_blank" rel="noreferrer" className="block mt-3">
                                    <img src={s.imageUrl} alt={s.label}
                                         className="w-full max-w-md rounded-lg border border-gray-700 hover:opacity-90 transition-opacity" />
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
