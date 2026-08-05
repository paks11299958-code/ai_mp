import React, { useCallback, useEffect, useRef, useState } from 'react';
import { aiStudioApi } from '../../services/apiService';
import { Icon } from '../Icons';
import { STYLE_PRESETS, buildPrompt, modelNote, type StylePreset } from './aiStudioPresets';

// 🎨 AI 스튜디오(서버3 GPU) 어드민 — 2026-08-05 신설
//
// 서버3은 **꺼져 있는 것이 기본**인 온디맨드 GPU 서버다(시간당 약 1,260원).
// 이 화면의 목적은 셋이다:
//   ① 켜져 있는지 한눈에 보이게 — 끄는 걸 잊으면 요금이 계속 나간다
//   ② 터미널 없이 켜고/끄기
//   ③ 프롬프트를 넣어 이미지를 만들고 결과를 바로 보기
//
// ★서버가 꺼져 있어도 생성 요청이 된다 — 큐에 쌓이면 디스패처(서버2 크론)가
//   알아서 켜고 워커가 처리한다. 그래서 '켜고 나서 요청'할 필요가 없다.

const SIZES = [
    { label: '정사각 1024×1024', w: 1024, h: 1024 },
    { label: '인물 세로 832×1216', w: 832, h: 1216 },
    { label: '가로 1216×832', w: 1216, h: 832 },
];

const won = (n: number) => Math.round(n).toLocaleString('ko-KR');
/** MB → 읽기 쉬운 단위. 1GB 미만은 MB 로 둔다(0.0GB 로 보이면 오히려 헷갈린다). */
const gb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.round(mb)}MB`);

/** 디노이징 강도 눈금 — 숫자만 보여주면 무슨 뜻인지 알 수 없다.
 *  ★값의 의미를 말로 붙여야 "0.55가 뭔데?"가 안 생긴다. */
const DENOISE_GUIDE: { max: number; label: string; desc: string }[] = [
    { max: 0.35, label: '살짝 다듬기',   desc: '원본과 거의 같게 — 화질·디테일만 정리' },
    { max: 0.65, label: '스타일 바꾸기', desc: '구도·포즈는 그대로, 분위기와 묘사를 바꿉니다' },
    { max: 0.85, label: '많이 바꾸기',   desc: '원본은 참고만 — 상당히 다른 그림이 됩니다' },
    { max: 1.01, label: '완전히 새로',   desc: '원본을 거의 무시합니다(그럴 거면 원본 없이 만드세요)' },
];
const denoiseGuide = (v: number) => DENOISE_GUIDE.find((g) => v < g.max) ?? DENOISE_GUIDE[1];

/** 원본을 브라우저에서 미리 줄여 base64 로 만든다. → { data, w, h, mb }
 *
 * ★왜 줄여서 보내는가 — 화질을 버리는 게 아니다. **생성 결과가 원본 해상도를
 *   물려받지 않기 때문**이다. 워커가 원본을 화면에서 고른 크기(최대 1216)로
 *   리사이즈한 뒤 VAE 로 인코딩하므로, 4000px 를 올려도 1216 으로 줄여서 쓴다.
 *   즉 큰 원본을 보내면 **올리는 시간만 길어지고 결과는 같다.**
 *   (정교함이 필요한 건 출력 쪽이고, 그건 확대 후보정이 맡는다.)
 * ★긴 변 1536px 은 1024~1216 생성에 필요한 것보다 여유가 있는 값이다.
 *
 * ★PNG(무손실) 로 만들면 1536px 라도 4~6MB 가 나온다 — 본문 제한(10MB)에 아슬아슬하다.
 *   그래서 **JPEG 품질 0.92 로 먼저 만들고**, 그래도 크면 한 단계 더 줄인다.
 *   어차피 VAE 인코딩을 거치며 화소 단위 정보는 사라지므로 육안 차이가 없다.
 *   (서버는 확장자와 무관하게 디코드하고, 파일만 .png 이름으로 저장한다.)
 */
const toScaledBase64 = async (
    file: File, maxSide = 1536,
): Promise<{ data: string; w: number; h: number; mb: number }> => {
    const bitmapSrc: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('파일을 읽지 못했습니다'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onerror = () => reject(new Error('이미지 형식이 아닙니다'));
        el.onload = () => resolve(el);
        el.src = bitmapSrc;
    });

    const render = (side: number, quality: number) => {
        const scale = Math.min(1, side / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        if (!ctx) throw new Error('캔버스를 만들지 못했습니다');
        ctx.drawImage(img, 0, 0, w, h);
        const data = cv.toDataURL('image/jpeg', quality);
        // base64 는 원본의 약 4/3 — 실제 전송량을 재서 판단한다
        return { data, w, h, mb: (data.length * 3 / 4) / (1 << 20) };
    };

    let out = render(maxSide, 0.92);
    // ★그래도 크면(예: 아주 복잡한 사진) 한 단계 더 줄인다. 무한정 시도하지 않는다.
    if (out.mb > 7) out = render(1152, 0.88);
    return out;
};

/** 생성 결과 썸네일 — 인증 헤더가 필요해 fetch 로 받아 blob 으로 그린다.
 *
 * ★이미지는 **서버3에만** 있고, 서버3은 유휴 30분이면 꺼진다. 꺼진 뒤에는
 *   미리보기를 못 가져온다 — 그런데 브라우저 캐시(1시간)에 남은 것은 계속 보이므로
 *   **"어떤 건 보이고 어떤 건 안 보이는" 상태**가 된다. 버그처럼 보이지만 정상 동작이다.
 *   그래서 실패 사유를 **읽히는 색으로** 분명히 적는다(예전엔 gray-600 이라 안 보였다).
 */
const JobImage: React.FC<{ file: string; serverOff: boolean }> = ({ file, serverOff }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [err, setErr] = useState(false);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        // ★서버가 꺼진 걸 이미 아는데 요청하지 않는다 — 어차피 502 라
        //   목록에 있는 이미지 수만큼 헛된 요청이 나간다(SSH 시도라 느리기까지 하다).
        if (serverOff) { setErr(true); return; }
        let alive = true;
        aiStudioApi.fetchImage(file)
            .then((u) => {
                if (!alive) { URL.revokeObjectURL(u); return; }
                urlRef.current = u;
                setUrl(u);
            })
            .catch(() => alive && setErr(true));
        return () => {
            alive = false;
            // ★blob URL 은 명시적으로 해제하지 않으면 메모리에 남는다
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        };
    }, [file, serverOff]);

    if (err) {
        return (
            <div className="w-full aspect-[3/4] rounded-lg bg-gray-900/80 border border-gray-700
                            flex flex-col items-center justify-center gap-1 text-center px-2">
                <span className="text-lg">🌙</span>
                <span className="text-[13px] text-gray-300 font-medium">서버가 꺼져 있어<br />미리보기를 볼 수 없습니다</span>
                <span className="text-[12px] text-gray-400">켜면 다시 보입니다</span>
            </div>
        );
    }
    if (!url) {
        return <div className="w-full aspect-[3/4] rounded-lg bg-gray-800 animate-pulse" />;
    }
    return (
        <a href={url} download={file} title="클릭하면 다운로드">
            <img src={url} alt={file} className="w-full rounded-lg border border-gray-700 hover:opacity-90" />
        </a>
    );
};

export const AiStudioPanel: React.FC = () => {
    const [st, setSt] = useState<Awaited<ReturnType<typeof aiStudioApi.getStatus>> | null>(null);
    const [models, setModels] = useState<string[]>([]);
    const [jobs, setJobs] = useState<Awaited<ReturnType<typeof aiStudioApi.getJobs>>['jobs']>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState('');

    // 생성 폼
    const [prompt, setPrompt] = useState('');
    const [negative, setNegative] = useState('');
    const [model, setModel] = useState('');
    const [sizeIdx, setSizeIdx] = useState(1);
    const [steps, setSteps] = useState(30);
    const [count, setCount] = useState(1);
    // ★프리셋을 고르면 프롬프트를 '무엇을 찍을지'만 쓰면 된다(촬영 용어는 프리셋이 붙인다).
    //   null 이면 자유 입력 — 프롬프트 전체를 직접 쓰는 모드.
    const [preset, setPreset] = useState<StylePreset | null>(null);

    // 모델 관리(2차)
    const [catalog, setCatalog] = useState<{ key: string; file: string; kind?: string }[]>([]);
    const [dlMsg, setDlMsg] = useState('');
    // 업스케일(후보정) — 설치된 확대 모델과 사용 여부
    const [upscalers, setUpscalers] = useState<string[]>([]);
    const [useUpscale, setUseUpscale] = useState(false);

    // img2img(원본 사진 바꾸기) — 서버3에 올린 파일명 + 미리보기 + 디노이징 강도
    // ★file 이 있으면 img2img, 없으면 기존처럼 t2i 다. 같은 폼을 공유한다.
    const [initFile, setInitFile] = useState<string | null>(null);
    const [initPreview, setInitPreview] = useState<string | null>(null);
    const [initInfo, setInitInfo] = useState('');
    const [denoise, setDenoise] = useState(0.55);
    const fileRef = useRef<HTMLInputElement | null>(null);

    // ★진행 폴링은 ref 로 관리한다 — 여러 번 누르면 타이머가 겹쳐
    //   같은 요청이 중복으로 나간다(전자책 표지 중복생성 사고와 같은 유형).
    // ★load 보다 **먼저** 선언해야 한다 — load 가 이걸 부르는데 아래에 두면
    //   최초 렌더의 useEffect 에서 TDZ(초기화 전 접근)로 화면이 백지가 된다.
    //   tsc 는 이걸 못 잡는다(런타임 오류).
    const dlTimer = useRef<number | null>(null);
    const pollDownload = useCallback(() => {
        if (dlTimer.current !== null) return;
        dlTimer.current = window.setInterval(async () => {
            try {
                const p = await aiStudioApi.modelProgress();
                setDlMsg(p.detail);
                if (p.status !== 'DOWNLOADING') {
                    if (dlTimer.current !== null) { clearInterval(dlTimer.current); dlTimer.current = null; }
                    // 다 받았으면 모델 목록을 다시 읽는다
                    aiStudioApi.getModels().then((m) => {
                        setModels(m.models ?? []);
                        setUpscalers(m.upscalers ?? []);
                    }).catch(() => {});
                }
            } catch { /* 일시적 실패는 무시하고 다음 주기에 재시도 */ }
        }, 10_000);
    }, []);

    // ★언마운트 시 타이머 정리 — 안 하면 탭을 옮겨도 요청이 계속 나간다
    useEffect(() => () => {
        if (dlTimer.current !== null) clearInterval(dlTimer.current);
    }, []);

    const load = useCallback(async () => {
        try {
            const [s, j] = await Promise.all([
                aiStudioApi.getStatus(),
                aiStudioApi.getJobs(12).catch(() => ({ jobs: [] })),
            ]);
            setSt(s);
            setJobs(j.jobs ?? []);
            // 모델 목록은 서버가 켜져 있을 때만 읽을 수 있다
            if (s.server?.status === 'RUNNING') {
                aiStudioApi.getModels().then((m) => {
                    setModels(m.models ?? []);
                    setUpscalers(m.upscalers ?? []);
                    if (!model && m.models?.length) setModel(m.models[0]);
                }).catch(() => {});
                aiStudioApi.getCatalog().then((c) => setCatalog(c.catalog ?? [])).catch(() => {});
                // ★화면을 새로 열었을 때 이미 받는 중일 수 있다 — 그 경우도 진행 상황이 보여야 한다
                aiStudioApi.modelProgress().then((p) => {
                    if (p.status === 'DOWNLOADING') { setDlMsg(p.detail); pollDownload(); }
                }).catch(() => {});
            }
        } catch (e: any) {
            setMsg(e?.message ?? '상태를 불러오지 못했습니다.');
        }
    }, [model, pollDownload]);

    useEffect(() => {
        load();
        // 큐가 도는 동안 진행 상황이 보여야 하므로 주기 갱신
        const t = setInterval(load, 15_000);
        return () => clearInterval(t);
    }, [load]);

    // FLUX 계열은 샘플링 규칙이 달라 워커가 설정을 자동 조정한다(cfg 1.0 고정, 네거티브 미사용)
    const isFlux = model.toLowerCase().includes('flux');
    const running = st?.server?.status === 'RUNNING';
    const transitioning = ['STARTING', 'STOPPING', 'STAGING', 'PROVISIONING'].includes(st?.server?.status ?? '');

    const doPower = async (action: 'start' | 'stop') => {
        if (action === 'stop' && !window.confirm(
            '서버를 끕니다.\n처리 중인 작업이 있으면 다음 기동 때 다시 처리됩니다(유실 없음).\n계속할까요?')) return;
        setBusy(action); setMsg('');
        try {
            const r = await aiStudioApi.power(action);
            setMsg(r.detail || (action === 'start' ? '기동 요청 완료' : '종료 요청 완료'));
            await load();
        } catch (e: any) {
            setMsg(e?.message ?? '제어에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    /** 모델 내려받기 시작 — 완료까지 5~10분이라 진행 상황을 폴링한다. */
    const doAddModel = async (key: string) => {
        setBusy('model'); setDlMsg('');
        try {
            const r = await aiStudioApi.addModel(key);
            setDlMsg(r.detail);
            if (r.status === 'DOWNLOADING') pollDownload();
        } catch (e: any) {
            setDlMsg(e?.body?.detail || e?.message || '모델 추가에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const doDeleteModel = async (file: string) => {
        if (!window.confirm(`${file}\n\n이 모델을 삭제합니다. 다시 받으려면 5~10분 걸립니다.\n계속할까요?`)) return;
        setBusy('model'); setDlMsg('');
        try {
            const r = await aiStudioApi.deleteModel(file);
            setDlMsg(r.detail);
            const m = await aiStudioApi.getModels();
            setModels(m.models ?? []);
            setUpscalers(m.upscalers ?? []);
        } catch (e: any) {
            setDlMsg(e?.body?.detail || e?.message || '삭제에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    /** 원본 사진 올리기(img2img).
     *
     * ★t2i 와 달리 **서버가 켜져 있어야** 한다 — 원본을 둘 곳이 서버3 디스크라서다.
     *   꺼져 있으면 서버가 거절하는데, 그걸 그대로 두면 "왜 안 되지"가 되므로 먼저 막고 안내한다.
     */
    const doUpload = async (f: File | null | undefined) => {
        if (!f) return;
        if (!running) {
            setMsg('원본 사진을 올리려면 서버를 먼저 켜 주세요(만들기만 하는 건 꺼져 있어도 됩니다).');
            return;
        }
        setBusy('upload'); setMsg('');
        try {
            const { data, w, h, mb } = await toScaledBase64(f);
            const r = await aiStudioApi.uploadImage(data);
            setInitFile(r.file);
            setInitPreview(data);
            setInitInfo(`${w}×${h} · ${mb.toFixed(1)}MB 로 줄여서 올림`);
            setMsg('원본을 올렸습니다 — 아래에서 "얼마나 바꿀지"를 정하세요.');
        } catch (e: any) {
            setMsg(e?.body?.error || e?.message || '원본 업로드에 실패했습니다.');
        } finally {
            setBusy(null);
            // ★같은 파일을 다시 고를 수 있게 값을 비운다(안 비우면 onChange 가 안 뜬다)
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const clearInit = () => {
        setInitFile(null); setInitPreview(null); setInitInfo('');
        if (fileRef.current) fileRef.current.value = '';
    };

    /** 프리셋 선택 — 모델·크기·스텝·네거티브를 검증된 값으로 채운다. */
    const applyPreset = (p: StylePreset | null) => {
        setPreset(p);
        if (!p) return;
        setNegative(p.negative ?? '');
        setSteps(p.steps);
        // ★확대 후보정 기본값 — 인물·제품은 켜는 게 낫다는 게 2026-08-05 비교 실측 결론.
        //   설치된 확대 모델이 없으면 켜 봐야 소용없으므로 그때만 반영한다.
        setUseUpscale(!!p.upscale && upscalers.length > 0);
        const i = SIZES.findIndex((s) => s.w === p.width && s.h === p.height);
        if (i >= 0) setSizeIdx(i);
        // ★프리셋이 지정한 모델이 서버에 없으면 무시한다 — 없는 파일명을 보내면 생성이 실패한다.
        //   (모델 목록은 서버가 켜져 있을 때만 채워지므로, 비어 있으면 그대로 둔다.)
        if (models.length === 0 || models.includes(p.model)) setModel(p.model);
    };

    const doGenerate = async () => {
        if (!prompt.trim()) { setMsg('프롬프트를 입력하세요.'); return; }
        setBusy('generate'); setMsg('');
        try {
            const size = SIZES[sizeIdx];
            // 프리셋 모드면 사장이 쓴 내용을 뼈대에 끼워 넣는다
            const finalPrompt = preset ? buildPrompt(preset, prompt) : prompt;
            const r = await aiStudioApi.generate({
                prompt: finalPrompt, negative: negative || undefined, model: model || undefined,
                width: size.w, height: size.h, steps, count,
                // 업스케일은 켜져 있고 설치된 모델이 있을 때만 보낸다
                upscale: useUpscale && upscalers[0] ? upscalers[0] : undefined,
                upscaleScale: 2,
                // img2img — 원본이 있을 때만. 없으면 기존과 똑같이 동작한다.
                initImage: initFile ?? undefined,
                denoise: initFile ? denoise : undefined,
            });
            setMsg(running
                ? `${r.queued}건 접수 — 곧 처리됩니다.`
                : `${r.queued}건 접수 — 서버가 꺼져 있어 자동으로 켜집니다(약 1~2분).`);
            // ★원본은 일부러 지우지 않는다 — 강도만 바꿔 다시 돌려보는 게 img2img 의
            //   기본 사용법이다. 매번 다시 올리게 하면 번거롭다(치우려면 '원본 빼기').
            await load();
        } catch (e: any) {
            setMsg(e?.message ?? '생성 요청에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const busySec = st?.today?.busySec ?? 0;
    const estKrw = (busySec / 3600) * (st?.krwPerHour ?? 1260);

    return (
        /* ★flex-1 + overflow-y-auto 필수 — 부모(AdminPanel 본문)가 overflow-hidden 이라
           패널이 스스로 스크롤하지 않으면 아래 내용이 잘려서 아예 못 본다.
           다른 어드민 패널들도 전부 이 형태다. */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-gray-200">
            {/* 헤더 — 상태와 전원 */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Icon name="Zap" className="w-5 h-5 text-purple-400" />
                            AI 스튜디오
                            <span className={`px-2 py-0.5 text-[13px] font-bold rounded border ${
                                running ? 'bg-green-900/50 text-green-300 border-green-700'
                                        : 'bg-gray-900 text-gray-400 border-gray-700'}`}>
                                {running ? '🟢 가동 중' : transitioning ? '🟡 전환 중' : '⚫ 꺼짐'}
                            </span>
                        </h2>
                        <p className="text-[13px] text-gray-300 mt-1">
                            NVIDIA L4 24GB · 필요할 때만 켜는 서버 · 시간당 약 {won(st?.krwPerHour ?? 1260)}원
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {running ? (
                            <button onClick={() => doPower('stop')} disabled={busy !== null}
                                className="text-xs px-3 py-1.5 rounded bg-red-800 hover:bg-red-700 font-bold disabled:opacity-50">
                                {busy === 'stop' ? '끄는 중…' : '⏹ 끄기'}
                            </button>
                        ) : (
                            <button onClick={() => doPower('start')} disabled={busy !== null || transitioning}
                                className="text-xs px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 font-bold disabled:opacity-50">
                                {busy === 'start' ? '켜는 중…' : '▶ 켜기'}
                            </button>
                        )}
                        <button onClick={load} className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
                            새로고침
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <Stat label="대기" value={`${st?.queue.pending ?? 0}건`} />
                    <Stat label="처리 중" value={`${st?.queue.processing ?? 0}건`} />
                    <Stat label="오늘 생성" value={`${st?.today.jobs ?? 0}장`} />
                    {/* ★얼마 쓰고 있는지가 항상 보여야 끄는 걸 잊지 않는다 */}
                    <Stat label="오늘 GPU 사용" value={`${Math.round(busySec / 60)}분 · 약 ${won(estKrw)}원`} />
                </div>

                {/* 디스크 — ★모델 1개가 6.5GB라 몇 개만 더 받아도 금방 찬다.
                     게다가 디스크는 **서버를 꺼도** 요금이 나가는 고정비다.
                     꽉 차서 실패한 뒤에 아는 일이 없도록 항상 보이게 둔다. */}
                {st?.disk && (
                    <div className="mt-3">
                        <div className="flex items-baseline justify-between text-[12px] mb-1">
                            <span className="text-gray-400">디스크</span>
                            <span className={st.disk.usedPct >= 85 ? 'text-red-300 font-bold' : 'text-gray-400'}>
                                {gb(st.disk.usedMb)} / {gb(st.disk.totalMb)} 사용 ({st.disk.usedPct}%)
                                · 남음 {gb(st.disk.freeMb)}
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-900 rounded overflow-hidden">
                            <div className={`h-full ${
                                st.disk.usedPct >= 85 ? 'bg-red-500'
                                : st.disk.usedPct >= 70 ? 'bg-amber-500' : 'bg-green-600'}`}
                                style={{ width: `${Math.min(100, st.disk.usedPct)}%` }} />
                        </div>
                        <p className="text-[12px] text-gray-400 mt-1">
                            모델 {gb(st.disk.modelsMb)} · 생성결과 {gb(st.disk.outputsMb)}
                            {st.disk.usedPct >= 85 && (
                                <b className="text-red-300"> — 여유가 없습니다. 안 쓰는 모델을 지워 주세요</b>
                            )}
                        </p>
                    </div>
                )}

                {!running && (
                    <p className="text-[13px] text-gray-300 mt-2">
                        ★꺼져 있어도 <b className="text-gray-400">생성 요청은 가능</b>합니다 —
                        큐에 쌓이면 자동으로 켜집니다(약 1~2분).
                    </p>
                )}
                {msg && <p className="text-xs text-amber-300 mt-2">{msg}</p>}
            </div>

            {/* 생성 폼 */}
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-3">
                <p className="text-sm font-bold text-gray-200">이미지 만들기</p>

                {/* 스타일 프리셋 — 촬영 용어를 외우지 않아도 되게 검증된 조합을 굳혀 둔 것 */}
                <div>
                    <div className="text-[12px] text-gray-400 mb-1.5">스타일</div>
                    <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => applyPreset(null)}
                            className={`px-2.5 py-1.5 text-[13px] rounded-md border transition-colors ${
                                preset === null
                                    ? 'bg-purple-700 border-purple-500 text-white font-bold'
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'}`}>
                            ✏️ 직접 입력
                        </button>
                        {STYLE_PRESETS.map((p) => (
                            <button key={p.key} onClick={() => applyPreset(p)} title={p.hint}
                                className={`px-2.5 py-1.5 text-[13px] rounded-md border transition-colors ${
                                    preset?.key === p.key
                                        ? 'bg-purple-700 border-purple-500 text-white font-bold'
                                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'}`}>
                                {p.icon} {p.label}
                            </button>
                        ))}
                    </div>
                    {preset && (
                        <p className="text-[12px] text-gray-400 mt-1.5">
                            {preset.hint} · 모델·크기·네거티브가 자동으로 맞춰집니다.
                        </p>
                    )}
                </div>

                {/* 원본 사진(img2img) — 있으면 '새로 그리기'가 아니라 '이 사진을 바꾸기'가 된다.
                    ★서버가 켜져 있어야 올릴 수 있다(원본을 둘 곳이 서버3 디스크). */}
                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                            <span className="text-xs font-bold text-gray-200">🖼 원본 사진에서 바꾸기</span>
                            <span className="text-[12px] text-gray-400"> (선택 — 없으면 새로 그립니다)</span>
                        </div>
                        {initFile && (
                            <button onClick={clearInit} className="text-[12px] px-2 py-1 rounded
                                        bg-gray-700 hover:bg-gray-600 text-gray-300">원본 빼기</button>
                        )}
                    </div>

                    {!initFile ? (
                        <>
                            <input ref={fileRef} type="file" accept="image/*"
                                onChange={(e) => doUpload(e.target.files?.[0])}
                                disabled={busy !== null || !running}
                                className="block w-full text-[13px] text-gray-300
                                           file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0
                                           file:text-[13px] file:font-bold file:bg-gray-700 file:text-gray-200
                                           hover:file:bg-gray-600 disabled:opacity-50" />
                            {busy === 'upload' && <p className="text-[12px] text-amber-300">올리는 중…</p>}
                            {/* ★꺼져 있으면 왜 못 올리는지 먼저 알린다 — 만들기(t2i)는 꺼져 있어도 되는데
                                 이것만 안 되면 고장으로 보인다. */}
                            {!running && (
                                <p className="text-[12px] text-amber-300/90">
                                    원본을 올리려면 <b>서버를 먼저 켜야</b> 합니다
                                    (사진을 서버에 둬야 하기 때문입니다).
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="flex gap-3">
                            {initPreview && (
                                <img src={initPreview} alt="원본"
                                    className="w-20 h-20 object-cover rounded border border-gray-600 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-[13px] font-bold text-purple-300">
                                        {denoiseGuide(denoise).label}
                                    </span>
                                    <span className="text-[12px] text-gray-400">강도 {denoise.toFixed(2)}</span>
                                </div>
                                {/* ★슬라이더가 핵심이다 — img2img 결과를 좌우하는 값은 사실상 이것 하나다. */}
                                <input type="range" min={0.15} max={0.95} step={0.05} value={denoise}
                                    onChange={(e) => setDenoise(Number(e.target.value))}
                                    className="w-full accent-purple-600" />
                                <div className="flex justify-between text-[11px] text-gray-400">
                                    <span>원본 유지</span><span>많이 바꾸기</span>
                                </div>
                                <p className="text-[12px] text-gray-400 leading-snug">
                                    {denoiseGuide(denoise).desc}
                                </p>
                                {initInfo && <p className="text-[11px] text-gray-400">{initInfo}</p>}
                            </div>
                        </div>
                    )}

                    {initFile && (
                        <p className="text-[12px] text-gray-300 leading-relaxed">
                            ★프롬프트에는 <b className="text-gray-400">바뀐 뒤의 모습</b>을 적으세요 —
                            원본 설명을 그대로 쓰면 거의 같은 사진이 나옵니다.
                            마음에 안 들면 강도만 바꿔 다시 눌러 보세요(원본은 그대로 남습니다).
                        </p>
                    )}
                </div>

                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={preset ? 2 : 4}
                    placeholder={preset
                        ? `무엇을 찍을지만 쓰세요 — 예: ${preset.example}`
                        : '프롬프트 (영문 권장) — 예: a professional Korean woman in a modern office, photorealistic…'}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm
                               placeholder-gray-600 focus:border-purple-500 focus:outline-none" />

                {/* ★프리셋이 실제로 어떤 문장을 붙이는지 보여준다 — 안 보이면
                     결과가 마음에 안 들 때 무엇을 고쳐야 할지 알 수 없다. */}
                {preset && (
                    <details className="text-[12px] text-gray-400">
                        <summary className="cursor-pointer hover:text-gray-300">최종 프롬프트 확인</summary>
                        <p className="mt-1 p-2 bg-gray-900 rounded border border-gray-700 leading-relaxed break-words">
                            {buildPrompt(preset, prompt)}
                        </p>
                    </details>
                )}

                <textarea value={negative} onChange={(e) => setNegative(e.target.value)} rows={2}
                    placeholder="네거티브(선택) — 비워두면 손·얼굴 왜곡 방지 기본값이 적용됩니다"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs
                               placeholder-gray-600 focus:border-purple-500 focus:outline-none" />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Field label="모델">
                        <select value={model} onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                            {models.length === 0 && <option value="">서버 켜면 목록 표시</option>}
                            {/* ★고르는 자리에서 성격이 보여야 한다 — 이름만으론 인물용인지 사물용인지 모른다 */}
                            {models.map((m) => (
                                <option key={m} value={m}>
                                    {m.replace('.safetensors', '')}
                                    {modelNote(m) && ` (${modelNote(m)})`}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="크기">
                        <select value={sizeIdx} onChange={(e) => setSizeIdx(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                            {SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
                        </select>
                    </Field>
                    <Field label="스텝">
                        <input type="number" min={10} max={60} value={steps}
                            onChange={(e) => setSteps(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs" />
                    </Field>
                    <Field label="장수">
                        <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}장</option>)}
                        </select>
                    </Field>
                </div>

                {/* 업스케일(후보정) — 미드저니와의 격차에서 모델만큼 큰 부분이 이것이다.
                    1024 원본은 피부·머리카락 디테일이 뭉개져 보인다. */}
                {upscalers.length > 0 && (
                    <label className="flex items-start gap-2 bg-gray-900/60 rounded-lg px-3 py-2 cursor-pointer">
                        <input type="checkbox" checked={useUpscale}
                            onChange={(e) => setUseUpscale(e.target.checked)}
                            className="mt-0.5 accent-purple-600" />
                        <span className="text-[13px] leading-relaxed">
                            <b className="text-gray-200">✨ 선명하게 (2배 확대 후보정)</b>
                            <span className="text-gray-400">
                                {' '}— 디테일이 살아납니다. 시간은 5~10초 더 걸리고 파일이 커집니다.
                            </span>
                        </span>
                    </label>
                )}

                {/* ★FLUX 는 규칙이 달라 위 스텝·네거티브가 그대로 적용되지 않는다 —
                     화면에 안 적으면 "왜 설정이 무시되지?"로 보인다. */}
                {isFlux && (
                    <p className="text-[12px] text-blue-300/80 bg-blue-900/20 border border-blue-800/40 rounded px-2.5 py-2">
                        ⚡ FLUX 모델은 설정이 자동 조정됩니다 — 네거티브·CFG는 쓰지 않고,
                        스텝은 {model.includes('schnell') ? '4~8' : '20'} 안팎으로 맞춰집니다.
                        {model.includes('dev') && <b className="text-blue-200"> (dev는 비상업 라이선스 — 내부 검토용)</b>}
                    </p>
                )}

                <button onClick={doGenerate} disabled={busy !== null}
                    className="w-full text-sm px-4 py-2.5 rounded-lg bg-purple-700 hover:bg-purple-600
                               font-bold disabled:opacity-50">
                    {busy === 'generate' ? '접수 중…' : '🎨 생성 요청'}
                </button>
                <p className="text-[12px] text-gray-400">
                    장당 약 14~16초, 원가 약 5원. 같은 프롬프트라도 매번 다른 그림이 나옵니다.
                </p>
            </div>

            {/* 모델 관리(2차) — 접어 둔다. 자주 쓰는 기능이 아니라 생성 폼을 가리면 안 된다. */}
            <details className="bg-gray-800/40 border border-gray-700 rounded-lg">
                <summary className="px-4 py-3 text-sm font-bold text-gray-200 cursor-pointer hover:text-white">
                    모델 관리 {models.length + upscalers.length > 0 && (
                        <span className="text-[13px] font-normal text-gray-400">
                            — 그림 {models.length}개{upscalers.length > 0 && ` · 후보정 ${upscalers.length}개`}
                        </span>)}
                </summary>
                <div className="px-4 pb-4 space-y-3">
                    {!running ? (
                        <p className="text-xs text-gray-400">서버를 켜야 모델을 관리할 수 있습니다.</p>
                    ) : (
                        <>
                            {dlMsg && <p className="text-xs text-amber-300">{dlMsg}</p>}

                            <div>
                                <div className="text-[12px] text-gray-400 mb-1.5">설치된 모델</div>
                                {models.length + upscalers.length === 0 ? (
                                    <p className="text-xs text-gray-400">없음</p>
                                ) : (
                                    <div className="space-y-1">
                                        {[...models, ...upscalers].map((m) => (
                                            <div key={m} className="flex items-center justify-between gap-2
                                                            bg-gray-900/60 rounded px-2.5 py-1.5">
                                                {/* ★파일명만으론 무엇에 쓰는지 알 수 없다 — 성격을 같이 적는다 */}
                                                <span className="min-w-0">
                                                    <span className="text-xs text-gray-300 block truncate">
                                                        {m.replace('.safetensors', '')}
                                                    </span>
                                                    {modelNote(m) && (
                                                        <span className="text-[12px] text-gray-400 block truncate">
                                                            {modelNote(m)}
                                                        </span>
                                                    )}
                                                </span>
                                                <button onClick={() => doDeleteModel(m)} disabled={busy !== null}
                                                    className="text-[12px] px-2 py-1 rounded bg-red-900/70 hover:bg-red-800
                                                               text-red-200 shrink-0 disabled:opacity-50">
                                                    삭제
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                {/* ★"추가할 수 있는 모델"이 무슨 뜻인지 안 적으면 지금 뭔가
                                     잘못된 것처럼 보인다 — 아직 안 깔린 것을 여기서 받는다는 뜻이다. */}
                                <div className="text-[12px] text-gray-400 mb-1.5">
                                    아직 설치되지 않은 모델 — <b className="text-gray-400">누르면 지금 내려받아 설치</b>합니다
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {catalog.filter((c) => !models.includes(c.file) && !upscalers.includes(c.file)).map((c) => (
                                        <button key={c.key} onClick={() => doAddModel(c.key)} disabled={busy !== null}
                                            title={modelNote(c.file) || undefined}
                                            className="px-2.5 py-1.5 text-left rounded-md border border-gray-700
                                                       bg-gray-900 text-gray-300 hover:text-white hover:border-purple-600
                                                       disabled:opacity-50">
                                            <span className="text-[13px] block">
                                                + {c.file.replace('.safetensors', '')}
                                            </span>
                                            {modelNote(c.file) && (
                                                <span className="text-[11px] text-gray-400 block">{modelNote(c.file)}</span>
                                            )}
                                        </button>
                                    ))}
                                    {catalog.length > 0 && catalog.every((c) => models.includes(c.file) || upscalers.includes(c.file)) && (
                                        <p className="text-xs text-gray-400">등록된 모델이 모두 설치돼 있습니다.</p>
                                    )}
                                </div>
                                <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
                                    안 받아도 됩니다 — 위 목록만으로 충분합니다. 받으면 1개당 약 6.5GB,
                                    5~10분 걸립니다(받는 동안 서버는 꺼지지 않습니다).
                                    <br />
                                    보안상 <b className="text-gray-400">미리 검증한 목록에서만</b> 받을 수 있습니다
                                    (인터넷 주소를 직접 넣을 수 없습니다).
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </details>

            {/* 결과 */}
            <div>
                <p className="text-sm font-bold text-gray-200 mb-2">최근 작업</p>
                {/* ★서버가 꺼지면 미리보기가 안 뜨는데, 캐시에 남은 것만 보여서
                     "어떤 건 보이고 어떤 건 안 보이는" 상태가 된다 — 이유를 미리 알린다. */}
                {!running && jobs.some((j) => j.status === 'completed' && j.files[0]) && (
                    <p className="text-[13px] text-amber-300/90 bg-amber-900/20 border border-amber-800/40
                                  rounded px-3 py-2 mb-2">
                        🌙 서버가 꺼져 있어 미리보기를 불러올 수 없습니다.
                        <span className="text-amber-200/70"> 일부가 보이는 건 브라우저에 남은 캐시입니다.</span>
                        {' '}이미지는 서버3에 그대로 있으니 <b>켜기</b>를 누르면 다시 보입니다.
                    </p>
                )}
                {jobs.length === 0 ? (
                    <p className="text-xs text-gray-400 py-6 text-center">아직 생성한 이미지가 없습니다.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {jobs.map((j) => (
                            <div key={j.id} className="bg-gray-900/60 border border-gray-700 rounded-lg p-2 space-y-1.5">
                                {j.status === 'completed' && j.files[0] ? (
                                    <JobImage file={j.files[0]} serverOff={!running} />
                                ) : (
                                    <div className="w-full aspect-[3/4] rounded-lg bg-gray-800 flex items-center
                                                    justify-center text-[13px] text-gray-300">
                                        {j.status === 'pending' ? '대기 중…'
                                            : j.status === 'processing' ? '생성 중…'
                                            : <span className="text-red-400 px-2 text-center">실패<br />{(j.error || '').slice(0, 40)}</span>}
                                    </div>
                                )}
                                <p className="text-[12px] text-gray-400 line-clamp-2 leading-snug">{j.prompt}</p>
                                <p className="text-[11px] text-gray-400">
                                    #{j.id} · {j.model.replace('.safetensors', '')} · {j.size}
                                    {j.elapsedSec != null && ` · ${j.elapsedSec}초`}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-[12px] text-gray-300 leading-relaxed border-t border-gray-800 pt-3">
                서버3(ai-studio-gpu)은 마지막 작업 후 <b className="text-gray-400">30분이 지나면 자동으로 꺼집니다</b>
                (그와 별개로 최대 가동시간 상한이 있습니다 — 기본 4시간).
                일이 들어오면 유휴 시간이 다시 0으로 초기화되고, 모델을 내려받는 중에도 꺼지지 않습니다.
                이미지는 서버3에 저장되며, 서버가 꺼지면 목록은 남지만 미리보기는 표시되지 않습니다 —
                필요한 이미지는 <b className="text-gray-400">클릭해서 내려받아 두세요</b>.
            </p>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-gray-900/60 rounded px-3 py-2">
        <div className="text-[12px] text-gray-400">{label}</div>
        <div className="text-sm font-bold text-gray-100">{value}</div>
    </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <div className="text-[12px] text-gray-400 mb-1">{label}</div>
        {children}
    </div>
);
