import React, { useCallback, useEffect, useRef, useState } from 'react';
import { aiStudioApi, type AiPromptTemplate } from '../../services/apiService';
import { Icon } from '../Icons';
import { STYLE_PRESETS, buildPrompt, modelNote, type StylePreset } from './aiStudioPresets';
import { engineConfig, workflowForModel, Z_IMAGE_MODEL, type AiStudioWorkflow } from './aiStudioEngine';

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
type StudioMode = 'simple' | 'edit' | 'advanced' | 'dictionary';
/** MB → 읽기 쉬운 단위. 1GB 미만은 MB 로 둔다(0.0GB 로 보이면 오히려 헷갈린다). */
const gb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.round(mb)}MB`);

/** 디노이징 강도 눈금 — 숫자만 보여주면 무슨 뜻인지 알 수 없다.
 *  ★값의 의미를 말로 붙여야 "0.55가 뭔데?"가 안 생긴다. */
/** 설치된 확대 모델 중 **소재에 맞는 것**을 고른다(2026-08-06 A/B 실측 2회 기준).
 *  ★사진(인물·제품) → UltraSharp : 머리카락·광택이 또렷해진다.
 *  ★플랫 일러스트   → RealESRGAN : 색 면이 깨끗하다. UltraSharp 는 평면에 노이즈를 만든다.
 *  같은 "선명하게 하는 힘"이 사진엔 디테일로, 평면 그림엔 자글거림으로 나타나기 때문이다.
 *  ★목록 첫 번째(`upscalers[0]`)를 쓰면 **설치 순서에 결과가 좌우**되므로 이름으로 고른다.
 *  ★없으면 조용히 차선으로 떨어진다(설치 안 된 모델명을 보내면 생성이 실패한다). */
const pickUpscaler = (list: string[], flat = false): string | undefined => {
    const find = (kw: string) => list.find((u) => u.toLowerCase().includes(kw));
    return flat
        ? (find('esrgan') ?? find('ultrasharp') ?? list[0])
        : (find('ultrasharp') ?? find('esrgan') ?? list[0]);
};

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
// ★onZoom 이 있으면 클릭 시 **확대**(2026-08-08 사장 요청) — 예전엔 클릭이 곧 다운로드였다.
//   썸네일을 작게 줄인 대신 눌러서 크게 볼 수 있어야 한다. 다운로드는 확대 화면에서 한다.
const JobImage: React.FC<{ file: string; serverOff: boolean; onZoom?: (url: string) => void }> = ({ file, serverOff, onZoom }) => {
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
    if (onZoom) {
        return (
            <button type="button" onClick={() => onZoom(url)} title="클릭하면 크게 보기"
                    className="block w-full rounded-lg overflow-hidden border border-gray-700
                               hover:border-purple-500/60 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <img src={url} alt={file} className="w-full block hover:opacity-90 transition-opacity" />
            </button>
        );
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
    // 일자별 사용량(2026-08-08) — "오늘"만 보면 추세를 알 수 없어 며칠치를 함께 본다.
    const [usage, setUsage] = useState<{ day: string; jobs: number; sec: number; krw: number }[]>([]);
    // 최근 작업 이미지를 크게 볼 때 쓰는 확대 오버레이. null 이면 닫힘.
    const [zoom, setZoom] = useState<string | null>(null);
    const [studioMode, setStudioMode] = useState<StudioMode>('simple');
    const [promptTemplates, setPromptTemplates] = useState<AiPromptTemplate[]>([]);
    const [templateError, setTemplateError] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

    // 생성 폼
    const [prompt, setPrompt] = useState('');
    const [negative, setNegative] = useState('');
    const [workflow, setWorkflow] = useState<AiStudioWorkflow>('sdxl_t2i');
    const [model, setModel] = useState('');
    const [sizeIdx, setSizeIdx] = useState(1);
    const [steps, setSteps] = useState(30);
    const [count, setCount] = useState(1);
    // ★프리셋을 고르면 프롬프트를 '무엇을 찍을지'만 쓰면 된다(촬영 용어는 프리셋이 붙인다).
    //   null 이면 자유 입력 — 프롬프트 전체를 직접 쓰는 모드.
    const [preset, setPreset] = useState<StylePreset | null>(null);
    // ★AI 다듬기 전 원문 — LLM 이 엉뚱하게 바꿀 수 있으므로 되돌릴 수 있어야 한다.
    //   null 이면 '되돌릴 것 없음'(버튼도 안 보인다).
    const [prevPrompt, setPrevPrompt] = useState<string | null>(null);
    // 네거티브도 한글로 쓰는 사람이 있다(2026-08-08 사장 지적) — 되돌리기도 따로 둔다.
    const [prevNegative, setPrevNegative] = useState<string | null>(null);

    // 모델 관리(2차)
    const [catalog, setCatalog] = useState<{ key: string; file: string; kind?: string }[]>([]);
    const [dlMsg, setDlMsg] = useState('');
    // 업스케일(후보정) — 설치된 확대 모델과 사용 여부
    const [upscalers, setUpscalers] = useState<string[]>([]);
    const [useUpscale, setUseUpscale] = useState(false);
    // ★"고른 프리셋이 확대를 원했는가" — 체크박스의 현재 상태(useUpscale)와 **별개**다.
    //   확대 모델 목록은 서버가 켜져야 오는데, 그 전에 프리셋을 고르면 켤 수가 없다.
    //   그 의도를 여기 적어 두었다가 목록이 도착하면 그때 반영한다(아래 useEffect).
    //   ★사장이 직접 체크를 끈 경우와 구분하려고 별도 상태로 둔다.
    const [wantUpscale, setWantUpscale] = useState(false);

    // img2img(원본 사진 바꾸기) — 서버3에 올린 파일명 + 미리보기 + 디노이징 강도
    // ★file 이 있으면 img2img, 없으면 기존처럼 t2i 다. 같은 폼을 공유한다.
    const [initFile, setInitFile] = useState<string | null>(null);
    const [initPreview, setInitPreview] = useState<string | null>(null);
    const [initInfo, setInitInfo] = useState('');
    const [denoise, setDenoise] = useState(0.55);
    const fileRef = useRef<HTMLInputElement | null>(null);

    // 스타일 참조(IP-Adapter, 2026-08-05) — ★img2img 와 **다른 기능**이다.
    //   img2img = 올린 사진을 고친다 / 스타일참조 = 견본의 화풍만 빌려 새로 그린다.
    //   사장이 이 둘을 혼동했던 지점이라 화면에서도 분명히 나눠 적는다.
    const [styleFile, setStyleFile] = useState<string | null>(null);
    const [stylePreview, setStylePreview] = useState<string | null>(null);
    const [styleWeight, setStyleWeight] = useState(0.8);
    const [styleMode, setStyleMode] = useState('style transfer');
    const styleRef = useRef<HTMLInputElement | null>(null);

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

    // ★확대 모델 목록이 **늦게 도착했을 때** 프리셋의 확대 의도를 뒤늦게 반영한다.
    //   서버가 꺼진 채 프리셋을 고르면 그 시점엔 켤 수 없었기 때문이다.
    //   ★`없음 → 있음` 으로 바뀌는 **그 순간에만** 켠다. 매번 켜면 사장이 직접 끈
    //     체크를 15초 주기 갱신이 도로 켜버린다(끌 수 없는 체크박스가 된다).
    const hadUpscalers = useRef(false);
    useEffect(() => {
        const has = upscalers.length > 0;
        if (has && !hadUpscalers.current && wantUpscale) setUseUpscale(true);
        hadUpscalers.current = has;
    }, [upscalers, wantUpscale]);

    const load = useCallback(async () => {
        try {
            const [s, j, u] = await Promise.all([
                aiStudioApi.getStatus(),
                aiStudioApi.getJobs(12).catch(() => ({ jobs: [] })),
                // ★사용량은 실패해도 화면 전체가 죽으면 안 된다 — 빈 배열로 폴백.
                aiStudioApi.getUsage(14).catch(() => ({ days: [] as any[] })),
            ]);
            setSt(s);
            setJobs(j.jobs ?? []);
            setUsage((u as any).days ?? []);
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

    useEffect(() => {
        let alive = true;
        aiStudioApi.getPromptTemplates().then((result) => {
            if (!alive) return;
            const templates = result.templates ?? [];
            setPromptTemplates(templates);
            setTemplateError('');
            if (!templateId && templates.length) {
                const first = templates.find((item) => item.enabled) ?? templates[0];
                setTemplateId(first.id);
                setTemplateValues(Object.fromEntries(first.variables.map((v) => [v.key, v.default ?? ''])));
            }
        }).catch((e: any) => {
            if (alive) setTemplateError(e?.message ?? '프롬프트 사전을 불러오지 못했습니다.');
        });
        return () => { alive = false; };
    }, []);

    // FLUX 계열은 샘플링 규칙이 달라 워커가 설정을 자동 조정한다(cfg 1.0 고정, 네거티브 미사용)
    const isFlux = model.toLowerCase().includes('flux');
    const isZImage = workflow === 'zimage_t2i';
    // ★평면 그림(일러스트·썸네일) 여부 — 확대 모델을 여기에 맞춰 고른다.
    //   실측(2026-08-06): 같은 확대라도 사진엔 디테일로, 평면 그림엔 **자글거리는 노이즈**로
    //   나타난다. 그래서 평면이면 RealESRGAN 이 낫다. 프리셋을 안 골랐으면 사진으로 본다
    //   (기본이 인물·제품이고, 잘못 골랐을 때 손해가 더 작은 쪽이다).
    const isFlatArt = preset?.key === 'illust' || preset?.key === 'thumbnail';
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

    /** 최근 작업 1건 지우기(2026-08-08) — ★목록에서만 치운다. 서버3의 이미지 파일은
     *  그대로 남아 [AI 보관함] 탭에서 볼 수 있다(여기서 원본까지 지우면 사고가 난다). */
    const doDeleteJob = async (id: number) => {
        if (!window.confirm(`#${id} 작업을 목록에서 지웁니다.\n\n이미지 파일은 서버에 그대로 남습니다([AI 보관함] 탭에서 관리).\n계속할까요?`)) return;
        // ★낙관적 갱신 — 지운 뒤 목록을 다시 부르면 15초 폴링과 겹쳐 깜빡인다.
        const before = jobs;
        setJobs((prev) => prev.filter((j) => j.id !== id));
        try {
            await aiStudioApi.deleteJob(id);
        } catch (e: any) {
            setJobs(before);   // 실패하면 되돌린다 — 지워진 것처럼 보이면 안 된다
            setMsg(e?.body?.error || e?.message || '삭제에 실패했습니다.');
        }
    };

    /** 스타일 견본 올리기 — 업로드 경로는 img2img 와 같다(둘 다 서버3 input 폴더). */
    const doUploadStyle = async (f: File | null | undefined) => {
        if (!f) return;
        if (!running) { setMsg('견본을 올리려면 서버를 먼저 켜 주세요.'); return; }
        setBusy('uploadStyle'); setMsg('');
        try {
            const { data } = await toScaledBase64(f, 1024);   // 견본은 화풍만 보므로 더 작아도 된다
            const r = await aiStudioApi.uploadImage(data);
            setStyleFile(r.file);
            setStylePreview(data);
            setMsg('견본을 올렸습니다 — 이 그림의 화풍을 따라 그립니다.');
        } catch (e: any) {
            setMsg(e?.body?.error || e?.message || '견본 업로드에 실패했습니다.');
        } finally {
            setBusy(null);
            if (styleRef.current) styleRef.current.value = '';
        }
    };

    const clearStyle = () => {
        setStyleFile(null); setStylePreview(null);
        if (styleRef.current) styleRef.current.value = '';
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

    /** 프롬프트를 이미지 생성용 영어 문장으로 다듬는다(LLM).
     *
     * ★한글로 써도 되게 하는 게 목적이다 — 촬영 용어를 영어로 외우게 하면
     *   결과가 사람 컨디션을 탄다(프리셋을 만든 이유와 같다).
     * ★원문을 남겨 되돌릴 수 있게 한다 — 손으로 쓴 게 날아가면 안 된다.
     */
    /** 프롬프트/네거티브 다듬기.
     *  ★한 함수로 둘 다 처리한다 — 복사해서 두 개로 만들면 나중에 한쪽만 고치는 실수가 난다.
     *  ★mode 에 따라 **서버 지시문이 달라진다**: 네거티브는 의미가 정반대라
     *    "손가락 이상하지 않게" → "deformed hands, extra fingers" 로 바꿔야 한다. */
    const doRefine = async (mode: 'positive' | 'negative' = 'positive') => {
        const isNeg = mode === 'negative';
        const text = (isNeg ? negative : prompt).trim();
        if (!text) return;
        setBusy(isNeg ? 'refine-neg' : 'refine'); setMsg('');
        try {
            const r = await aiStudioApi.refinePrompt(text, preset?.label, mode);
            if (isNeg) { setPrevNegative(text); setNegative(r.refined); }
            else { setPrevPrompt(text); setPrompt(r.refined); }
            setMsg(`${isNeg ? '빼고 싶은 것을' : '프롬프트를'} 다듬었습니다 — 마음에 안 들면 ↩ 되돌리기를 누르세요.`);
        } catch (e: any) {
            setMsg(e?.body?.error || e?.message || '다듬기에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    /** 프리셋 선택 — 모델·크기·스텝·네거티브를 검증된 값으로 채운다. */
    const applyPreset = (p: StylePreset | null) => {
        setPreset(p);
        setPrevPrompt(null);          // 프리셋이 바뀌면 이전 되돌리기 대상은 의미가 없다
        // ★'직접 입력'으로 되돌리면 확대 의도도 함께 지운다 — 안 지우면 옛 프리셋의
        //   의도가 남아 있다가 목록이 도착할 때 체크가 되살아난다.
        if (!p) { setWantUpscale(false); return; }
        // ★프롬프트가 비어 있으면 예시를 넣어 준다 — 빈 칸만 보면 뭘 써야 할지 막막하다.
        //   ★이미 쓴 내용은 절대 덮지 않는다(쓰던 걸 날리면 프리셋을 못 바꾼다).
        setPrompt((cur) => (cur.trim() ? cur : p.example));
        setNegative(p.negative ?? '');
        setSteps(p.steps);
        // ★확대 후보정 기본값 — 인물·제품은 켜는 게 낫다는 게 2026-08-05 비교 실측 결론.
        //   설치된 확대 모델이 없으면 켜 봐야 소용없으므로 그때만 반영한다.
        // ★단 '지금 확대 모델이 없다'와 '이 프리셋은 확대를 원한다'는 **다른 사실**이다.
        //   서버가 꺼진 채 프리셋을 고르면 upscalers 가 비어 있어 여기서 OFF 가 되는데,
        //   나중에 서버가 켜져 목록이 도착해도 **다시 켜주지 않아** 조용히 품질이 떨어졌다
        //   (2026-08-06 시나리오 재현으로 확인). 그래서 의도를 따로 기억해 두고,
        //   목록이 도착하는 시점에 아래 useEffect 가 반영한다.
        setWantUpscale(!!p.upscale);
        setUseUpscale(!!p.upscale && upscalers.length > 0);
        const i = SIZES.findIndex((s) => s.w === p.width && s.h === p.height);
        if (i >= 0) setSizeIdx(i);
        // ★프리셋이 지정한 모델이 서버에 없으면 무시한다 — 없는 파일명을 보내면 생성이 실패한다.
        //   (모델 목록은 서버가 켜져 있을 때만 채워지므로, 비어 있으면 그대로 둔다.)
        if (models.length === 0 || models.includes(p.model)) setModel(p.model);
    };

    const doGenerate = async (promptMode: 'composed' | 'raw' = 'composed') => {
        if (!prompt.trim()) { setMsg('프롬프트를 입력하세요.'); return; }
        const isRaw = promptMode === 'raw';
        setBusy(isRaw ? 'generate-raw' : 'generate'); setMsg('');
        try {
            const size = SIZES[sizeIdx];
            const engine = engineConfig(workflow);
            // 원문 모드는 프리셋 뼈대도 붙이지 않는다. 공백·줄바꿈까지 입력 그대로 보낸다.
            const finalPrompt = isRaw ? prompt : (preset ? buildPrompt(preset, prompt) : prompt);
            const r = await aiStudioApi.generate({
                prompt: finalPrompt, negative: negative || undefined, promptMode,
                workflow: engine.workflow,
                model: engine.model ?? (model || undefined),
                width: isZImage ? engine.width : size.w,
                height: isZImage ? engine.height : size.h,
                steps: isZImage ? engine.steps : steps,
                cfg: engine.cfg, count,
                // 업스케일은 켜져 있고 설치된 모델이 있을 때만 보낸다.
                // ★어느 걸 쓸지는 고르게 하지 않고 **가장 좋은 것으로 고정**한다 —
                //   2026-08-06 같은 시드 A/B 실측에서 UltraSharp 가 인물 디테일(속눈썹·잔머리·
                //   모공)에서 확실히 나았고, RealESRGAN 은 피부결을 뭉갰다. 우열이 분명한
                //   선택지를 화면에 늘리면 잘못 고를 여지만 생긴다.
                //   ★예전엔 `upscalers[0]`(목록 첫 번째)라 **설치 순서에 결과가 좌우**됐다.
                upscale: engine.supportsUpscale && useUpscale ? pickUpscaler(upscalers, isFlatArt) : undefined,
                upscaleScale: 2,
                // img2img — 원본이 있을 때만. 없으면 기존과 똑같이 동작한다.
                initImage: engine.supportsImageInputs ? (initFile ?? undefined) : undefined,
                denoise: engine.supportsImageInputs && initFile ? denoise : undefined,
                // 스타일 참조 — 견본이 있을 때만
                styleImage: engine.supportsImageInputs ? (styleFile ?? undefined) : undefined,
                styleWeight: engine.supportsImageInputs && styleFile ? styleWeight : undefined,
                styleMode: engine.supportsImageInputs && styleFile ? styleMode : undefined,
            });
            const modeLabel = isRaw ? '원문 그대로 ' : '';
            setMsg(running
                ? `${modeLabel}${r.queued}건 접수 — 곧 처리됩니다.`
                : `${modeLabel}${r.queued}건 접수 — 서버가 꺼져 있어 자동으로 켜집니다(약 1~2분).`);
            // ★원본은 일부러 지우지 않는다 — 강도만 바꿔 다시 돌려보는 게 img2img 의
            //   기본 사용법이다. 매번 다시 올리게 하면 번거롭다(치우려면 '원본 빼기').
            await load();
        } catch (e: any) {
            setMsg(e?.message ?? '생성 요청에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const selectTemplate = (template: AiPromptTemplate) => {
        setTemplateId(template.id);
        setTemplateValues(Object.fromEntries(template.variables.map((v) => [v.key, v.default ?? ''])));
        setMsg('');
    };

    const doTemplateGenerate = async () => {
        const selected = promptTemplates.find((item) => item.id === templateId);
        if (!selected?.enabled) { setMsg('이 템플릿은 GPU 워커 연결 후 사용할 수 있습니다.'); return; }
        setBusy('template-generate'); setMsg('');
        try {
            const compiled = await aiStudioApi.compilePromptTemplate(selected.id, templateValues);
            if (!compiled.enabled) throw new Error('아직 생성 경로가 연결되지 않은 템플릿입니다.');
            const upscale = compiled.render.upscale ? pickUpscaler(upscalers, selected.category === 'illustration') : undefined;
            const result = await aiStudioApi.generate({
                workflow: compiled.workflow,
                prompt: compiled.positive,
                negative: compiled.negative,
                model: compiled.model,
                width: compiled.render.width,
                height: compiled.render.height,
                steps: compiled.render.steps,
                cfg: compiled.render.cfg,
                count,
                upscale,
                upscaleScale: upscale ? 2 : undefined,
            });
            setMsg(running
                ? `${selected.name} ${result.queued}건 접수 — 곧 처리됩니다.`
                : `${selected.name} ${result.queued}건 접수 — 서버가 자동으로 켜집니다.`);
            await load();
        } catch (e: any) {
            setMsg(e?.body?.error || e?.message || '템플릿 생성 요청에 실패했습니다.');
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
                            gcp3-new · NVIDIA L4 24GB · 시간당 약 {won(st?.krwPerHour ?? 1260)}원
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

            {/* 일자별 사용량(2026-08-08 사장 요청) — ★"오늘"만 보면 추세를 알 수 없다.
                어느 날 몰아 썼는지, 끄는 걸 잊은 날이 있는지가 여기서 보인다.
                ★금액은 **작업 처리시간** 기준이라 실제 청구액보다 작다(노는 시간은 안 잡힘). */}
            {usage.length > 0 && (
                <details className="bg-gray-800/40 border border-gray-700 rounded-lg" open>
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-gray-200">
                        일자별 사용량
                        <span className="ml-2 text-[12px] font-normal text-gray-400">
                            최근 {usage.length}일 · 합계 약 {usage.reduce((a, d) => a + d.krw, 0).toLocaleString()}원
                        </span>
                    </summary>
                    <div className="px-4 pb-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="text-gray-400 border-b border-gray-700">
                                        <th className="text-left font-medium py-1.5">날짜</th>
                                        <th className="text-right font-medium py-1.5">건수</th>
                                        <th className="text-right font-medium py-1.5">사용시간</th>
                                        <th className="text-right font-medium py-1.5">금액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usage.map((d) => (
                                        <tr key={d.day} className="border-b border-gray-800/70">
                                            <td className="py-1.5 text-gray-300">{d.day.slice(5).replace('-', '/')}</td>
                                            {/* ★숫자는 tabular-nums 로 자릿수를 맞춘다 — 세로로 비교해야 하는 값이다 */}
                                            <td className="py-1.5 text-right text-gray-300 tabular-nums">{d.jobs}건</td>
                                            <td className="py-1.5 text-right text-gray-400 tabular-nums">
                                                {d.sec >= 60 ? `${Math.round(d.sec / 60)}분` : `${d.sec}초`}
                                            </td>
                                            <td className="py-1.5 text-right text-gray-200 tabular-nums font-medium">
                                                {d.krw.toLocaleString()}원
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
                            ★<b className="text-gray-400">그림을 그린 시간</b>만 계산한 값입니다 —
                            서버가 켜져 있어도 노는 시간은 빠져 있어 <b className="text-gray-400">실제 청구액보다 작습니다</b>.
                            정확한 금액은 GCP 결제 화면에서 확인하세요.
                        </p>
                    </div>
                </details>
            )}

            <nav aria-label="AI 스튜디오 작업 방식" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                    ['simple', '✨ 간단 생성'], ['edit', '🖼 이미지 수정'],
                    ['advanced', '🛠 고급 생성'], ['dictionary', '📚 프롬프트 사전'],
                ] as [StudioMode, string][]).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setStudioMode(key)}
                        aria-current={studioMode === key ? 'page' : undefined}
                        className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                            studioMode === key
                                ? 'bg-purple-700 border-purple-500 text-white'
                                : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                        {label}
                    </button>
                ))}
            </nav>

            {studioMode === 'simple' && (
                <section className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-4" aria-labelledby="simple-title">
                    <div>
                        <h3 id="simple-title" className="text-sm font-bold text-gray-100">검증된 설정으로 빠르게 만들기</h3>
                        <p className="text-[13px] text-gray-400 mt-1">종류를 고르고 내용만 입력하면 조명·화각·품질·네거티브가 자동 적용됩니다.</p>
                    </div>
                    {templateError ? <p role="alert" className="text-sm text-red-300">{templateError}</p> : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                                {promptTemplates.filter((item) => item.enabled).map((item) => (
                                    <button key={item.id} type="button" onClick={() => selectTemplate(item)}
                                        className={`text-left rounded-lg border p-3 transition-colors ${templateId === item.id
                                            ? 'bg-purple-900/40 border-purple-500' : 'bg-gray-900/60 border-gray-700 hover:border-gray-500'}`}>
                                        <span className="block text-sm font-bold text-gray-100">{item.name}</span>
                                        <span className="block text-[12px] text-gray-400 mt-1 leading-relaxed">{item.description}</span>
                                    </button>
                                ))}
                            </div>
                            {(() => {
                                const selected = promptTemplates.find((item) => item.id === templateId);
                                if (!selected) return <p className="text-sm text-gray-400">사용 가능한 템플릿이 없습니다.</p>;
                                return (
                                    <div className="space-y-3">
                                        {selected.variables.map((variable) => (
                                            <Field key={variable.key} label={`${variable.label}${variable.required ? ' *' : ''}`}>
                                                {variable.type === 'select' ? (
                                                    <select value={templateValues[variable.key] ?? ''}
                                                        onChange={(e) => setTemplateValues((cur) => ({ ...cur, [variable.key]: e.target.value }))}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
                                                        {!variable.required && <option value="">선택 안 함</option>}
                                                        {variable.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                    </select>
                                                ) : (
                                                    <textarea value={templateValues[variable.key] ?? ''} maxLength={variable.maxLength}
                                                        required={variable.required}
                                                        onChange={(e) => setTemplateValues((cur) => ({ ...cur, [variable.key]: e.target.value }))}
                                                        placeholder="예: 30대 한국 여성, 네이비 정장, 자연스러운 미소"
                                                        className="w-full min-h-24 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm resize-y" />
                                                )}
                                            </Field>
                                        ))}
                                        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                            <Field label="장수">
                                                <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                                                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
                                                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}장</option>)}
                                                </select>
                                            </Field>
                                            <button type="button" onClick={doTemplateGenerate}
                                                disabled={busy !== null || selected.variables.some((v) => v.required && !(templateValues[v.key] ?? '').trim())}
                                                className="sm:flex-1 rounded-lg bg-purple-700 hover:bg-purple-600 px-4 py-2.5 text-sm font-bold disabled:opacity-50">
                                                {busy === 'template-generate' ? '접수 중…' : `🎨 ${selected.name} 생성 요청`}
                                            </button>
                                        </div>
                                        <p className="text-[12px] text-gray-400">{selected.render.width}×{selected.render.height} · {selected.render.steps}스텝 · {selected.model.replace('.safetensors', '')}</p>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </section>
            )}

            {studioMode === 'dictionary' && (
                <section className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-3" aria-labelledby="dictionary-title">
                    <div>
                        <h3 id="dictionary-title" className="text-sm font-bold text-gray-100">중앙 프롬프트 사전</h3>
                        <p className="text-[13px] text-gray-400 mt-1">서버에서 관리하는 공통 템플릿입니다. 관리자 화면과 향후 n8n/API가 같은 정본을 사용합니다.</p>
                    </div>
                    {templateError && <p role="alert" className="text-sm text-red-300">{templateError}</p>}
                    <div className="space-y-2">
                        {promptTemplates.map((item) => (
                            <details key={item.id} className="rounded-lg border border-gray-700 bg-gray-900/50">
                                <summary className="cursor-pointer px-3 py-2.5 text-sm text-gray-200">
                                    <b>{item.name}</b>
                                    <span className={`ml-2 text-[12px] ${item.enabled ? 'text-green-300' : 'text-amber-300'}`}>
                                        {item.enabled ? '사용 가능' : '워커 연결 대기'}
                                    </span>
                                    <span className="ml-2 text-[12px] text-gray-500">{item.id} · {item.workflow}</span>
                                </summary>
                                <div className="px-3 pb-3 space-y-2 text-[12px]">
                                    <p className="text-gray-400">{item.description}</p>
                                    <p className="text-gray-400">{item.render.width}×{item.render.height} · {item.render.steps}스텝 · CFG {item.render.cfg} · {item.model}</p>
                                    <div><b className="text-green-300">Positive</b><p className="mt-1 whitespace-pre-wrap break-words text-gray-300">{item.positiveTemplate}</p></div>
                                    <div><b className="text-red-300">Negative</b><p className="mt-1 whitespace-pre-wrap break-words text-gray-400">{item.negativeTemplate}</p></div>
                                </div>
                            </details>
                        ))}
                    </div>
                </section>
            )}

            {/* 생성 폼 */}
            {(studioMode === 'advanced' || studioMode === 'edit') && <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-3">
                <p className="text-sm font-bold text-gray-200">{studioMode === 'edit' ? '원본 이미지 수정' : '고급 이미지 생성'}</p>
                {studioMode === 'edit' && <p className="text-[13px] text-blue-300 bg-blue-900/20 border border-blue-800/50 rounded px-3 py-2">먼저 아래의 <b>원본 사진</b>을 올린 뒤, 바꾸고 싶은 내용을 프롬프트에 적으세요. 얼굴·목·자세를 보존하려면 강도 0.35~0.55부터 시험하는 것이 안전합니다.</p>}

                {/* ★2단 배치(2026-08-08 사장 지시) — 예전엔 한 줄로 길게 늘어서
                    프롬프트를 쓰려면 프리셋·업로드를 한참 지나쳐야 했다.
                    왼쪽=재료(프리셋·사진), 오른쪽=지시와 결과. 좁은 화면에선 자동으로 한 줄이 된다. */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4 items-start">

                    {/* ── 왼쪽: 무엇으로 만들까 (재료) ── */}
                    <div className="space-y-3 min-w-0">
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
                                <span className="text-xs font-bold text-gray-200">🖼 내 사진 고치기</span>
                                <span className="text-[12px] text-gray-400"> (선택 — 없으면 글로만 새로 그립니다)</span>
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
                                    {/* ★상반신 사진으로 전신을 만들려면 강도를 올려야 한다 —
                                         실측(2026-08-06): 같은 프롬프트·시드로 0.55 는 상반신 그대로,
                                         0.85 에서 비로소 전신이 나왔다. 대신 얼굴은 원본과 달라진다.
                                         (여백 패딩도 시도했으나 모델이 여백을 배경 물체로 읽어 더 나빴다) */}
                                    {denoise < 0.8 && (
                                        <p className="text-[12px] text-amber-200/90 bg-amber-900/20 border border-amber-800/40 rounded px-2 py-1.5 leading-snug">
                                            💡 <b>전신</b>을 만들려는데 상반신 사진을 올리셨다면 강도를 <b>0.85 이상</b>으로
                                            올리세요 — 이보다 낮으면 원본 구도(상반신)를 벗어나지 못합니다.
                                            <span className="text-amber-200/70"> 단 그만큼 얼굴도 원본과 달라집니다.</span>
                                        </p>
                                    )}
                                    {initInfo && <p className="text-[11px] text-gray-400">{initInfo}</p>}
                                </div>
                            </div>
                        )}

                        {initFile && (
                            <p className="text-[12px] text-gray-300 leading-relaxed">
                                ★<b className="text-gray-300">여기 올린 사진이 '바뀔 대상'</b>입니다
                                (참고용 견본이 아닙니다 — 견본처럼 만들려면 아래 '스타일 따라하기'를 쓰세요).
                                프롬프트에는 <b className="text-gray-300">바뀐 뒤의 모습</b>을 적으세요 —
                                지금 사진 설명을 그대로 쓰면 거의 같은 사진이 나옵니다.
                                마음에 안 들면 강도만 바꿔 다시 눌러 보세요(원본은 그대로 남습니다).
                            </p>
                        )}
                    </div>

                    {/* 스타일 따라하기(IP-Adapter) — ★위 '내 사진 고치기'와 **다른 기능**이다.
                         · 내 사진 고치기 = 올린 사진 **그 자체를** 바꾼다
                         · 스타일 따라하기 = 견본의 **화풍만 빌려** 새로 그린다(피사체는 프롬프트대로)
                         사장이 이 둘을 혼동했던 지점이라 화면에 차이를 분명히 적는다. */}
                    <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                                <span className="text-xs font-bold text-gray-200">🎭 스타일 따라하기</span>
                                <span className="text-[12px] text-gray-400"> (선택 — 견본 그림의 화풍을 따라 그립니다)</span>
                            </div>
                            {styleFile && (
                                <button onClick={clearStyle} className="text-[12px] px-2 py-1 rounded
                                            bg-gray-700 hover:bg-gray-600 text-gray-200">견본 빼기</button>
                            )}
                        </div>

                        {!styleFile ? (
                            <>
                                <input ref={styleRef} type="file" accept="image/*"
                                    onChange={(e) => doUploadStyle(e.target.files?.[0])}
                                    disabled={busy !== null || !running}
                                    className="block w-full text-[12px] text-gray-300
                                               file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0
                                               file:text-[12px] file:font-bold file:bg-gray-700 file:text-gray-200
                                               hover:file:bg-gray-600 disabled:opacity-50" />
                                {busy === 'uploadStyle' && <p className="text-[12px] text-amber-300">올리는 중…</p>}
                                <p className="text-[12px] text-gray-400 leading-relaxed">
                                    ★<b className="text-gray-300">여기 올린 건 '견본'</b>입니다 —
                                    이 그림처럼 그려 달라는 뜻이고, <b className="text-gray-300">이 그림이 바뀌는 게 아닙니다.</b>
                                    {!running && <span className="text-amber-300"> 서버를 먼저 켜 주세요.</span>}
                                </p>
                            </>
                        ) : (
                            <div className="flex gap-3">
                                {stylePreview && (
                                    <img src={stylePreview} alt="견본"
                                        className="w-20 h-20 object-cover rounded border border-gray-600 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div>
                                        <div className="text-[12px] text-gray-400 mb-1">무엇을 따라할지</div>
                                        <select value={styleMode} onChange={(e) => setStyleMode(e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                                            <option value="style transfer">화풍·색감만 (피사체는 프롬프트대로)</option>
                                            <option value="standard">인물·구성까지 폭넓게 (얼굴 비슷하게)</option>
                                            <option value="prompt is more important">약하게만 (프롬프트 우선)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-[12px] text-gray-400">따라하는 정도</span>
                                            <span className="text-[12px] text-gray-400">{styleWeight.toFixed(1)}</span>
                                        </div>
                                        <input type="range" min={0.3} max={1.2} step={0.1} value={styleWeight}
                                            onChange={(e) => setStyleWeight(Number(e.target.value))}
                                            className="w-full accent-purple-600" />
                                        <p className="text-[12px] text-gray-400">
                                            {styleWeight >= 1.0 ? '아주 강하게 — 프롬프트가 묻힐 수 있습니다'
                                                : styleWeight >= 0.7 ? '견본 느낌이 뚜렷합니다(권장)'
                                                : '살짝만 참고합니다'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    </div>

                    {/* ── 오른쪽: 무엇을 만들까 (지시 → 설정 → 생성) ── */}
                    <div className="space-y-3 min-w-0">
                    {/* ★소제목 — 텍스트창 2개가 나란히 있는데 라벨이 없어 **아래 칸이 뭔지
                         placeholder 를 읽어야만** 알 수 있었다("헷갈린다", 2026-08-06 사장 지적).
                         placeholder 는 글자를 넣는 순간 사라지므로 라벨 역할을 못 한다. */}
                    {/* ★제목·입력칸·보조버튼을 **한 덩어리로 묶는다**(2026-08-08 사장 지시).
                         예전엔 셋이 space-y-3 로 똑같이 벌어져 있어, 다듬기 버튼이
                         아래 '빼고 싶은 것'과도 거리가 비슷해 보였다 →
                         "다듬기를 누르면 네거티브도 영어로 바뀌나?"라는 오해가 생겼다.
                         ★실제로는 **위 칸만** 바꾼다(doRefine 이 prompt 만 읽고 쓴다). */}
                    <div className="space-y-1.5">
                    <div className="text-xs font-bold text-gray-200 flex items-baseline gap-1.5 flex-wrap">
                        ✏️ 그리고 싶은 것
                        <span className="text-[12px] font-normal text-green-300/90">(필수 — 원하는 그림을 적습니다)</span>
                    </div>
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={preset ? 2 : 4}
                        placeholder={preset
                            ? `무엇을 찍을지만 쓰세요 — 예: ${preset.example}`
                            : '프롬프트 (영문 권장) — 예: a professional Korean woman in a modern office, photorealistic…'}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm
                                   placeholder-gray-400 focus:border-purple-500 focus:outline-none" />

                    {/* 프롬프트 보조 — ①예시 넣기 ②AI로 다듬기
                        ★예시가 placeholder 로만 있으면 **보고 따라 타이핑**해야 한다. 눌러서 넣게 한다.
                        ★번역 버튼을 따로 두지 않았다 — 직역은 프롬프트로 잘 안 먹고,
                          버튼이 둘이면 어느 걸 눌러야 하는지 헷갈린다. 하나로 합쳤다. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {preset && (
                            <button onClick={() => setPrompt(preset.example)}
                                className="text-[12px] px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
                                📋 예시 넣기
                            </button>
                        )}
                        {/* ★onClick={doRefine} 로 두면 클릭 이벤트가 첫 인자(mode)로 들어간다 —
                             반드시 화살표로 감싼다. */}
                        <button onClick={() => doRefine('positive')} disabled={busy !== null || !prompt.trim()}
                            title="바로 위 칸만 다듬습니다 — 한글로 써도 영어 프롬프트로 바꿔 줍니다"
                            className="text-[12px] px-2.5 py-1 rounded bg-purple-800 hover:bg-purple-700
                                       text-purple-100 font-bold disabled:opacity-40">
                            {busy === 'refine' ? '다듬는 중…' : '✨ 위 칸을 AI로 다듬기'}
                        </button>
                        <button onClick={() => doGenerate('raw')} disabled={busy !== null || !prompt.trim()}
                            title="프리셋 문구나 AI 보강 없이 위 칸을 입력한 그대로 생성합니다"
                            className="text-[12px] px-2.5 py-1 rounded bg-emerald-800 hover:bg-emerald-700
                                       text-emerald-100 font-bold disabled:opacity-40">
                            {busy === 'generate-raw' ? '접수 중…' : '🚀 원문 그대로 생성'}
                        </button>
                        {/* ★되돌리기 — LLM 이 엉뚱하게 바꿀 수 있는데 손으로 쓴 게 날아가면 안 된다 */}
                        {prevPrompt !== null && (
                            <button onClick={() => { setPrompt(prevPrompt); setPrevPrompt(null); }}
                                className="text-[12px] px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
                                ↩ 되돌리기
                            </button>
                        )}
                        <span className="text-[12px] text-gray-400">
                            한글로 써도 됩니다 — 다듬기를 누르면 영어로 바꿔 줍니다
                        </span>
                    </div>
                    </div>

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

                    {/* ★위 칸과 **반대 의미**라는 걸 제목에서 바로 알게 한다 —
                         '네거티브'라는 낱말만으론 무슨 뜻인지 알 수 없다.
                         ★여기도 제목·입력·버튼을 한 덩어리로 묶는다(위 칸과 같은 규칙). */}
                    <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-bold text-gray-200 flex items-baseline gap-1.5 flex-wrap">
                        🚫 빼고 싶은 것 <span className="text-gray-400 font-normal">(네거티브)</span>
                        <span className="text-[12px] font-normal text-gray-400">
                            (선택 — 비워두면 손·얼굴 왜곡 방지 기본값이 들어갑니다)
                        </span>
                    </div>
                    <textarea value={negative} onChange={(e) => setNegative(e.target.value)} rows={2}
                        placeholder="그림에 나오면 안 되는 것을 적습니다 — 예: blurry, extra fingers, watermark"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs
                                   placeholder-gray-600 focus:border-purple-500 focus:outline-none" />

                    {/* ★네거티브도 한글로 쓰는 사람이 있다(2026-08-08 사장 지적).
                         단 **의미가 정반대**라 서버가 다른 지시문을 쓴다 —
                         "손가락 이상하지 않게" → "deformed hands, extra fingers". */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button onClick={() => doRefine('negative')}
                            disabled={busy !== null || !negative.trim()}
                            title="바로 위 칸만 다듬습니다 — 한글로 써도 영어 네거티브로 바꿔 줍니다"
                            className="text-[12px] px-2.5 py-1 rounded bg-purple-800 hover:bg-purple-700
                                       text-purple-100 font-bold disabled:opacity-40">
                            {busy === 'refine-neg' ? '다듬는 중…' : '✨ 위 칸을 AI로 다듬기'}
                        </button>
                        {prevNegative !== null && (
                            <button onClick={() => { setNegative(prevNegative); setPrevNegative(null); }}
                                className="text-[12px] px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
                                ↩ 되돌리기
                            </button>
                        )}
                        <span className="text-[12px] text-gray-400">
                            한글로 써도 됩니다 — 예: "손가락 이상하지 않게"
                        </span>
                    </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Field label="모델">
                            <select value={isZImage ? Z_IMAGE_MODEL : model}
                                onChange={(e) => {
                                    const nextModel = e.target.value;
                                    const nextWorkflow = workflowForModel(nextModel);
                                    const engine = engineConfig(nextWorkflow);
                                    setWorkflow(nextWorkflow);
                                    setModel(nextModel);
                                    if (nextWorkflow === 'zimage_t2i') {
                                        setSizeIdx(SIZES.findIndex((s) => s.w === engine.width && s.h === engine.height));
                                        setSteps(engine.steps);
                                        setPreset(null); // 기존 프리셋은 SDXL 전용 뼈대다
                                        setUseUpscale(false);
                                    } else if (isZImage) {
                                        setSteps(30);
                                    }
                                }}
                                aria-label="모델"
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                                <option value={Z_IMAGE_MODEL}>Z-Image Turbo (원문 프롬프트용)</option>
                                {models.length === 0 && <option value="">SDXL은 서버 켜면 목록 표시</option>}
                                {/* ★고르는 자리에서 성격이 보여야 한다 — 이름만으론 인물용인지 사물용인지 모른다.
                                    ★단 `<option>` 안에서는 줄바꿈·색상이 **브라우저에서 무시된다.**
                                      그래서 여기는 한 줄로 두고, 고른 뒤의 설명은 아래에 크게 따로 띄운다. */}
                                {models.map((m) => (
                                    <option key={m} value={m}>
                                        {m.replace('.safetensors', '')}
                                        {modelNote(m) && ` (${modelNote(m)})`}
                                    </option>
                                ))}
                            </select>
                            {/* ★고른 모델의 설명을 드롭다운 **바깥**에 다시 보여준다(2026-08-05).
                                닫힌 select 는 폭이 좁아 괄호 설명이 잘려 보이고, 그래서
                                "설명이 헷갈린다"는 지적이 나왔다. 여기선 잘리지 않는다. */}
                            {!isZImage && modelNote(model) && (
                                <p className={`mt-1 text-[12px] leading-snug ${
                                    modelNote(model).startsWith('⛔') ? 'text-red-300'
                                        : modelNote(model).startsWith('★') ? 'text-green-300'
                                            : 'text-gray-400'}`}>
                                    {modelNote(model)}
                                </p>
                            )}
                        </Field>
                        <Field label="크기">
                            <select value={sizeIdx} onChange={(e) => setSizeIdx(Number(e.target.value))}
                                disabled={isZImage}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                                {SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
                            </select>
                        </Field>
                        <Field label="스텝">
                            <input type="number" min={isZImage ? 1 : 10} max={60} value={steps}
                                disabled={isZImage}
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

                    {isZImage && (
                        <p className="text-[12px] text-emerald-200 bg-emerald-900/25 border border-emerald-700/50 rounded px-2.5 py-2">
                            Z-Image Turbo · 832×1216 · 9 steps · CFG 1로 설정했습니다.
                            텍스트 생성 전용이라 원본 이미지·스타일 참조·확대 후보정은 이 요청에서 제외됩니다.
                        </p>
                    )}

                    {/* 업스케일(후보정) — 미드저니와의 격차에서 모델만큼 큰 부분이 이것이다.
                        1024 원본은 피부·머리카락 디테일이 뭉개져 보인다. */}
                    {!isZImage && upscalers.length > 0 && (
                        <label className="flex items-start gap-2 bg-gray-900/60 rounded-lg px-3 py-2 cursor-pointer">
                            <input type="checkbox" checked={useUpscale}
                                onChange={(e) => setUseUpscale(e.target.checked)}
                                className="mt-0.5 accent-purple-600" />
                            <span className="text-[13px] leading-relaxed">
                                <b className="text-gray-200">✨ 선명하게 (2배 확대 후보정)</b>
                                <span className="text-gray-400">
                                    {' '}— 머리카락·피부결이 살아납니다. 시간은 5~10초 더 걸리고 파일이 커집니다.
                                    {/* ★어느 모델을 쓰는지 밝힌다 — 모델 관리에 2종이 보이는데
                                         화면에 표시가 없으면 "어느 게 쓰이지?"가 생긴다(고르는 칸은 일부러 안 만든다). */}
                                    {(() => {
                                        const u = pickUpscaler(upscalers, isFlatArt);
                                        return u ? ` 좋은 쪽(${u.replace(/\.(pth|safetensors)$/i, '')})으로 자동 적용됩니다.` : '';
                                    })()}
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

                    {/* ★FLUX + 견본 = 견본이 **조용히 무시된다**(워커 `if style_image and not flux`).
                         IP-Adapter 노드가 SDXL 전용이라 그렇다. 경고가 없으면 견본을 올려 놓고
                         "왜 화풍이 안 따라오지?"만 반복하게 된다(2026-08-06). */}
                    {isFlux && styleFile && (
                        <p className="text-[12px] text-amber-200 bg-amber-900/25 border border-amber-700/50 rounded px-2.5 py-2">
                            ⚠️ 지금 고른 <b>FLUX 모델은 '스타일 따라하기'를 쓰지 못합니다</b> — 견본은 무시되고
                            프롬프트로만 그려집니다. 견본을 쓰시려면 <b>RealVisXL·JuggernautXL</b> 같은 SDXL 모델을 고르세요.
                        </p>
                    )}

                    {/* ★프롬프트가 비면 버튼을 잠근다 — 예전엔 눌려도 첫 줄에서 조용히 반환돼
                         "생성하기가 안 눌린다"는 오해가 생겼다(2026-08-06 사장 지적). */}
                    <button onClick={() => doGenerate('composed')} disabled={busy !== null || !prompt.trim()}
                        className="w-full text-sm px-4 py-2.5 rounded-lg bg-purple-700 hover:bg-purple-600
                                   font-bold disabled:opacity-50">
                        {busy === 'generate' ? '접수 중…'
                            : !prompt.trim() ? '⌨ 먼저 프롬프트를 입력하세요'
                                : '🎨 생성 요청'}
                    </button>
                    <p className="text-[12px] text-gray-400">
                        장당 약 14~16초, 원가 약 5원. 같은 프롬프트라도 매번 다른 그림이 나옵니다.
                    </p>
                    </div>

                </div>
            </div>}

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
                                                    {/* ★★=권장 / ⛔=고르지 말 것. 위 모델 드롭다운과 같은 규칙으로 칠한다 */}
                                                    {modelNote(m) && (
                                                        <span className={`text-[12px] block truncate ${
                                                            modelNote(m).startsWith('⛔') ? 'text-red-300'
                                                                : modelNote(m).startsWith('★') ? 'text-green-300'
                                                                    : 'text-gray-400'}`}>
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
                {/* ★썸네일을 반의반으로 줄였다(2026-08-08 사장 지시) — 예전엔 4열이라
                     한 장이 너무 커서 최근 작업을 훑기 어려웠다. 8열로 늘려 크기를 1/4로.
                     대신 **클릭하면 확대**되고, 각 칸에서 **바로 지울 수** 있다.
                   ★주석은 삼항 밖에 둔다 — `: (` 바로 뒤엔 표현식만 올 수 있어
                     JSX 주석을 넣으면 빌드가 깨진다(2026-08-08 실제로 겪음). */}
                {jobs.length === 0 ? (
                    <p className="text-xs text-gray-400 py-6 text-center">아직 생성한 이미지가 없습니다.</p>
                ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                        {jobs.map((j) => (
                            <div key={j.id} className="group relative bg-gray-900/60 border border-gray-700
                                                       rounded-lg p-1.5 space-y-1">
                                {/* ★삭제 — 평소엔 흐리게 두고 마우스를 올리면 또렷해진다.
                                     칸이 작아 항상 진하게 두면 그림을 가린다. */}
                                <button onClick={() => doDeleteJob(j.id)} title="목록에서 지우기"
                                    className="absolute top-1 right-1 z-10 w-5 h-5 rounded
                                               bg-gray-900/80 hover:bg-red-700 text-gray-300 hover:text-white
                                               text-[11px] leading-none opacity-40 group-hover:opacity-100
                                               transition-opacity border border-gray-600">
                                    ✕
                                </button>
                                {j.status === 'completed' && j.files[0] ? (
                                    <JobImage file={j.files[0]} serverOff={!running} onZoom={setZoom} />
                                ) : (
                                    <div className="w-full aspect-[3/4] rounded bg-gray-800 flex items-center
                                                    justify-center text-[11px] text-gray-300 text-center px-1">
                                        {j.status === 'pending' ? '대기 중…'
                                            : j.status === 'processing' ? '생성 중…'
                                            : <span className="text-red-400">실패</span>}
                                    </div>
                                )}
                                {/* ★칸이 작아진 만큼 글자도 줄인다 — 프롬프트는 한 줄만,
                                     자세한 건 확대해서 보거나 [AI 보관함]에서 본다. */}
                                <p className="text-[11px] text-gray-400 truncate leading-snug" title={j.prompt}>
                                    {j.prompt}
                                </p>
                                <p className="text-[10px] text-gray-500 truncate">
                                    #{j.id}{j.elapsedSec != null && ` · ${j.elapsedSec}초`}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 확대 보기(2026-08-08) — 썸네일을 작게 줄인 대신 눌러서 크게 본다.
                 ★배경 아무 곳이나 눌러도 닫힌다(닫는 법을 못 찾으면 갇힌 느낌이 든다). */}
            {zoom && (
                <div onClick={() => setZoom(null)}
                     className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4
                                cursor-zoom-out">
                    <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
                        <img src={zoom} alt="확대"
                             className="max-w-full max-h-[88vh] rounded-lg border border-gray-600" />
                        <div className="mt-2 flex items-center justify-center gap-2">
                            <a href={zoom} download
                               className="text-[13px] px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-100">
                                ⬇ 내려받기
                            </a>
                            <button onClick={() => setZoom(null)}
                               className="text-[13px] px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-100">
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ★보관함은 별도 탭으로 분리했다(2026-08-05) — 여기서 만들고,
                 만든 것은 [AI 보관함] 탭에서 보고 지운다. 한 화면에 섞여 있으니
                 "만드는 곳"과 "보는 곳"이 헷갈린다는 지적을 반영. */}

            <p className="text-[12px] text-gray-300 leading-relaxed border-t border-gray-800 pt-3">
                서버3(gcp3-new)은 작업이 없으면 <b className="text-green-300">유휴 30분 또는 최대 4시간에 자동 종료</b>됩니다.
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
