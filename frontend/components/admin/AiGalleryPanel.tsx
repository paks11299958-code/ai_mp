import React, { useCallback, useEffect, useState } from 'react';
import { aiStudioApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 🗂 AI 보관함 — 2026-08-05 분리
//
// ★왜 별도 탭인가: AI 스튜디오 탭 안에 접이식으로 두었더니 "만드는 곳"과 "보는 곳"이
//   한 화면에 섞여 헷갈린다는 지적이 있었다(사장, 08-05). 생성은 스튜디오, 관리는 여기.
//
// ★'최근 작업'(스튜디오 탭)과 다르다 — 그쪽은 DB(`GpuJob`)를 최근 12건만 본다.
//   큐를 거치지 않고 만든 이미지는 job 기록이 없어 거기엔 **영원히 안 보인다**
//   (실측: 파일 33장 vs job 28건). 여기는 **서버3의 실제 파일이 정본**이라 전부 보인다.
//
// ★썸네일은 한 번의 왕복으로 전부 받는다 — 장당 원본을 받으면 서버1→서버2→서버3
//   2단 SSH 에 6~8MB 씩이라 28장에 34초가 걸렸다. 320px JPEG 로 4.9초(1/200 전송량).
//   원본은 ⤓ 를 누를 때만 가져온다.

const fmtSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${kb}KB`);

const fmtTime = (sec: number) =>
    new Date(sec * 1000).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

/** ★탭을 벗어나도 유지되는 캐시(모듈 스코프).
 *
 *  왜 필요한가: 탭을 옮기면 이 컴포넌트는 **언마운트되어 상태가 통째로 사라진다.**
 *  다시 들어올 때마다 목록+썸네일을 처음부터 받으면(약 5초) 탭을 누를 때마다
 *  "불러오는 중…"을 다시 보게 된다(사장 지적, 2026-08-05).
 *  → 받아둔 것을 모듈에 남겨 **두 번째부터는 즉시 보여주고**, 갱신은 뒤에서 조용히 한다.
 *
 *  ★유효시간을 둔다 — 서버가 꺼지거나 다른 곳에서 이미지가 늘 수 있어 영원히 믿으면 안 된다.
 *    (그래도 화면은 먼저 뜨고, 새 데이터가 오면 갈아끼운다 = 빈 화면을 보지 않는다)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache: {
    at: number;
    files: { file: string; kb: number; mtime: number }[];
    thumbs: Record<string, string>;
} = { at: 0, files: [], thumbs: {} };

export const AiGalleryPanel: React.FC = () => {
    const [running, setRunning] = useState<boolean | null>(null);
    // ★캐시가 있으면 그것으로 시작한다 — 탭을 다시 열 때 빈 화면·로딩을 보지 않는다
    const [files, setFiles] = useState(cache.files);
    const [thumbs, setThumbs] = useState(cache.thumbs);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState('');

    /** 목록 + 썸네일을 함께 읽는다. ★순차로 하면 왕복이 2배가 된다.
     *  @param force 새로고침 버튼처럼 캐시를 무시하고 다시 받아야 할 때 */
    const load = useCallback(async (force = false) => {
        // ★캐시가 아직 쓸 만하면 요청 자체를 하지 않는다(탭 이동마다 5초 대기가 사라진다).
        const fresh = Date.now() - cache.at < CACHE_TTL_MS && cache.files.length > 0;
        if (!force && fresh) {
            setFiles(cache.files);
            setThumbs(cache.thumbs);
            setRunning(true);      // 캐시가 있다는 건 마지막 조회 때 켜져 있었다는 뜻
            return;
        }
        // ★이미 보여줄 게 있으면 '불러오는 중'으로 화면을 비우지 않는다 — 뒤에서 갱신한다
        setBusy(cache.files.length > 0 ? 'refresh' : 'load');
        setMsg('');
        try {
            const st = await aiStudioApi.getStatus();
            const on = st.server?.status === 'RUNNING';
            setRunning(on);
            if (!on) {
                // ★서버가 꺼지면 캐시도 버린다 — 다시 켰을 때 옛 목록을 보여주면 안 된다
                cache.at = 0; cache.files = []; cache.thumbs = {};
                setFiles([]); setThumbs({});
                return;
            }

            const [g, t] = await Promise.all([
                aiStudioApi.getGallery(),
                aiStudioApi.getThumbs().catch(() => ({ ok: false, thumbs: {} as Record<string, string> })),
            ]);
            const nextFiles = g.files ?? [];
            const nextThumbs = t.thumbs ?? {};
            setFiles(nextFiles);
            setThumbs(nextThumbs);
            // ★탭을 나갔다 와도 남도록 모듈 캐시에 적어 둔다
            cache.at = Date.now(); cache.files = nextFiles; cache.thumbs = nextThumbs;
            if (!g.ok && g.reason) setMsg(g.reason);
        } catch (e: any) {
            setMsg(e?.message ?? '보관함을 불러오지 못했습니다.');
        } finally {
            setBusy(null);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const togglePick = (f: string) => {
        setPicked((prev) => {
            const n = new Set(prev);
            n.has(f) ? n.delete(f) : n.add(f);
            return n;
        });
    };

    /** 원본 내려받기 — ★격자에 뜬 건 320px 썸네일이다. 원본은 장당 6~8MB 라
     *  필요할 때만 따로 받는다. 인증 헤더가 필요해 fetch 로 받는다. */
    const downloadOriginal = async (file: string) => {
        try {
            const url = await aiStudioApi.fetchImage(file);
            const a = document.createElement('a');
            a.href = url; a.download = file;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);   // blob 은 해제해야 메모리에서 빠진다
        } catch {
            setMsg('원본을 가져오지 못했습니다(서버가 꺼졌을 수 있습니다).');
        }
    };

    /** 고른 이미지 삭제 — ★되돌릴 수 없으므로 장수를 명시해 확인받는다. */
    const doDelete = async () => {
        const list = [...picked];
        if (list.length === 0) return;
        if (!window.confirm(
            `이미지 ${list.length}장을 삭제합니다.\n★되돌릴 수 없습니다. 필요한 건 먼저 내려받으세요.\n계속할까요?`)) return;
        setBusy('delete'); setMsg('');
        try {
            const r = await aiStudioApi.deleteImages(list);
            setMsg(r.failed ? `${r.deleted}장 삭제 — ${r.failed}장은 실패했습니다.`
                            : `${r.deleted}장을 삭제했습니다.`);
            // ★서버를 다시 부르지 않는다 — 지운 건 이미 안다. 화면에서만 빼면 된다.
            const gone = new Set(list);
            const nextFiles = files.filter((x) => !gone.has(x.file));
            const nextThumbs = { ...thumbs };
            for (const f of list) delete nextThumbs[f];
            setFiles(nextFiles);
            setThumbs(nextThumbs);
            // ★캐시도 같이 지운다 — 안 하면 탭을 다시 열었을 때 **지운 게 되살아나 보인다**
            cache.files = nextFiles; cache.thumbs = nextThumbs;
            setPicked(new Set());
        } catch (e: any) {
            setMsg(e?.message ?? '삭제에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const totalMb = files.reduce((s, f) => s + f.kb, 0) / 1024;

    return (
        /* ★flex-1 + overflow-y-auto 필수 — 부모(AdminPanel 본문)가 overflow-hidden 이라
           패널이 스스로 스크롤하지 않으면 아래 내용이 잘려서 아예 못 본다. */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-gray-200">
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Icon name="Image" className="w-5 h-5 text-purple-400" />
                            AI 보관함
                        </h2>
                        <p className="text-[13px] text-gray-300 mt-1">
                            AI 스튜디오에서 만든 이미지가 모두 여기 있습니다
                            {files.length > 0 && ` — ${files.length}장 · ${totalMb.toFixed(1)}MB`}
                        </p>
                    </div>
                    <button onClick={() => load(true)} disabled={busy !== null}
                        className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50">
                        {busy === 'load' ? '불러오는 중…' : busy === 'refresh' ? '갱신 중…' : '새로고침'}
                    </button>
                </div>
                {msg && <p className="text-xs text-amber-300 mt-2">{msg}</p>}
            </div>

            {running === false ? (
                /* ★이미지는 서버3에만 있다 — 꺼져 있으면 목록조차 읽을 수 없다.
                     "비어 있음"으로 보이면 지워진 줄 알기 때문에 이유를 분명히 적는다. */
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6 text-center">
                    <p className="text-3xl mb-2">🌙</p>
                    <p className="text-sm text-gray-200 font-medium">서버가 꺼져 있습니다</p>
                    <p className="text-[13px] text-gray-300 mt-1">
                        이미지는 그대로 있습니다 — <b className="text-gray-200">AI 스튜디오</b> 탭에서
                        서버를 켜면 보입니다.
                    </p>
                </div>
            ) : busy === 'load' ? (
                <p className="text-sm text-amber-300">불러오는 중…</p>
            ) : files.length === 0 ? (
                <p className="text-sm text-gray-300 py-8 text-center">저장된 이미지가 없습니다.</p>
            ) : (
                <>
                    <div className="flex items-center justify-between gap-2 flex-wrap
                                    bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2">
                        <div className="flex gap-1.5">
                            <button onClick={() => setPicked(new Set(files.map((f) => f.file)))}
                                className="text-[12px] px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
                                전체 선택
                            </button>
                            <button onClick={() => setPicked(new Set())}
                                className="text-[12px] px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
                                선택 해제
                            </button>
                        </div>
                        {/* ★고른 게 있을 때만 삭제 버튼을 보인다 — 실수로 누를 여지를 줄인다 */}
                        {picked.size > 0 && (
                            <button onClick={doDelete} disabled={busy !== null}
                                className="text-[12px] px-3 py-1 rounded bg-red-800 hover:bg-red-700
                                           font-bold text-red-100 disabled:opacity-50">
                                {busy === 'delete' ? '삭제 중…' : `선택한 ${picked.size}장 삭제`}
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {files.map((g) => {
                            const on = picked.has(g.file);
                            return (
                                <div key={g.file} onClick={() => togglePick(g.file)}
                                    className={`relative rounded-lg border-2 cursor-pointer overflow-hidden
                                        ${on ? 'border-purple-500' : 'border-gray-700 hover:border-gray-500'}`}>
                                    {thumbs[g.file] ? (
                                        <img src={`data:image/jpeg;base64,${thumbs[g.file]}`}
                                            alt={g.file} loading="lazy"
                                            className="w-full aspect-square object-cover" />
                                    ) : (
                                        <div className="w-full aspect-square bg-gray-800 animate-pulse" />
                                    )}
                                    <span className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center
                                        justify-center text-[12px] font-bold
                                        ${on ? 'bg-purple-600 text-white' : 'bg-gray-900/80 text-gray-400'}`}>
                                        {on ? '✓' : ''}
                                    </span>
                                    <div className="px-1.5 py-1 bg-gray-900/80 flex items-center justify-between gap-1">
                                        <span className="min-w-0">
                                            <span className="text-[11px] text-gray-300 block">
                                                {fmtTime(g.mtime)}
                                            </span>
                                            <span className="text-[11px] text-gray-400">{fmtSize(g.kb)}</span>
                                        </span>
                                        {/* ★stopPropagation 필수 — 안 하면 선택 토글까지 같이 눌린다 */}
                                        <button onClick={(e) => { e.stopPropagation(); downloadOriginal(g.file); }}
                                            title="원본 내려받기"
                                            className="text-[12px] px-1.5 py-0.5 rounded bg-gray-700
                                                       hover:bg-gray-600 text-gray-200 shrink-0">
                                            ⤓
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-[12px] text-gray-300 leading-relaxed border-t border-gray-800 pt-3">
                        눌러서 고르고 삭제합니다. 원본은 <b className="text-gray-200">⤓</b> 로 받습니다
                        (격자에 보이는 건 빠르게 보려고 줄인 미리보기입니다).
                        ★<b className="text-gray-200">지우면 되돌릴 수 없습니다</b> —
                        필요한 이미지는 먼저 내려받아 두세요.
                        <br />
                        이미지는 서버3에 저장되며, 서버가 꺼져도 사라지지 않습니다.
                    </p>
                </>
            )}
        </div>
    );
};
