import React, { useEffect, useRef, useState } from 'react';
import { shortsMakerApi, UserShortsRow, sampleVaultApi, SampleVaultRow, outfitApi, OutfitStyle } from '../services/apiService';

// 이아린 — 쇼츠 만들기 보드. 이미지(최대 3장) + 신청서 → 서로 다른 후킹 앵글의 시나리오
// 5개를 만들어 보여주고, 회원이 고른 1개만 실제 TTS+영상으로 제작한다(homepage 만들기와
// 동일한 비동기 큐+포인트 선차감 패턴). 2단계 과금: ①리서치+시나리오5개 ②선택 후 영상 제작.
// 사장 확정(2026-07-22): 참고 쇼츠는 URL 직접 입력(자동 검색 X — 저작권/신뢰성 리스크 회피),
// TTS/자막은 마지막 단계에서 선택 언어(한/중/일/영/베)로.
// 사장 확정(2026-07-23): 이미지 1장→최대 3장. 실제 업로드 사진을 "참고자료"로 대본 생성에
// 함께 첨부(Vision) — AI가 어느 세그먼트에 어느 실사진이 맞는지 판단하고, 맞는 게 없는
// 세그먼트만 나노바나나로 재생성(shorts_maker_worker.build_final_script 참고).

interface Props {
    onClose: () => void;
}

const PINK = '#D85C95';   // 아린 팔레트
const MAX_IMAGES = 3;     // shared-api MAX_IMAGES와 동일(사장 확정 2026-07-23)
// 상품/제품 모드(2026-07-23): 실물 사진은 재해석(재생성) 금지 원칙이라 다양성을 사진
// 장수로 확보한다 — 앞면·옆면·위(또는 아래) 3장을 무조건 필수로 받고, 추가로 최대 5장까지
// 더 받아(총 8장) 재료를 늘린다. shared-api MAX_IMAGES_PRODUCT와 동일하게 유지.
const PRODUCT_SLOTS = ['앞면', '옆면', '위 또는 아래'] as const;
const MAX_IMAGES_PRODUCT = 8;

// 카테고리 5종(2026-07-25 사장 지시) — 커뮤니티·제품은 기존처럼 사진 기반, 나머지 3개는
// 사진 업로드 없이 주제만 입력하면 AI가 이미지까지 전부 완전 생성한다(shorts_maker_worker.py의
// "사진 없음" 분기 재사용 — 이미 어드민 수동생성 17개 소재로 검증된 경로).
type Category = 'community' | 'product' | 'insight' | 'wellness' | 'meme' | 'birthday';
const CATEGORIES: {
    code: Category; emoji: string; label: string;
    desc: string;       // 한 줄 설명 — 무엇을 만드는지
    inputHint: string;  // 사진 필요/불필요 + 무엇을 입력하는지
    example: string;    // 실제 소재 예시 — 감을 못 잡는 회원을 위한 안전망
    scriptSample?: string;  // 사진 없는 카테고리 전용(2026-07-25) — 실제 완성본에서 발췌한
                            // 대본(내레이션) 샘플. "글로 만드는" 카테고리는 결과물이 눈에
                            // 안 보여 감이 안 온다는 사장 지적으로 추가.
}[] = [
    // 생일축하(2026-08-02 3차, 사장 지시로 맨 위 배치) — 개인용 축하 콘텐츠가 마케팅용
    // 5종보다 먼저 눈에 띄어야 진입장벽이 낮다는 판단. 가족사진·케이크사진은 선택 첨부 —
    // 있으면 실제 사진 그대로(재해석은 별도 옵션) 쓰고, 없어도 AI가 대신 채워 완성된다.
    { code: 'birthday', emoji: '🎂', label: '생일축하',
      desc: '소중한 사람에게 보내는 축하 영상이에요. 이름과 하고 싶은 말만 적어주세요.',
      inputHint: '✍️📷 사진 선택 (가족사진·케이크사진은 있으면 넣고, 없어도 AI가 채워요)',
      example: '예: 엄마 생신 축하, 친구 지훈이 서른 번째 생일',
      scriptSample: '"오늘은 아주 특별한 날이에요. 늘 곁에서 힘이 되어준 당신에게, 진심을 담아 축하를 전합니다. 앞으로의 하루하루가 오늘처럼 빛나기를..."' },
    { code: 'community', emoji: '📸', label: '커뮤니티·동호회',
      desc: '모임·동호회 활동을 자랑하는 홍보 쇼츠예요.',
      inputHint: '📷 사진 필요 (활동 사진 1~3장)',
      example: '예: 주말 등산 모임, 볼링 동호회 신입 모집' },
    { code: 'product', emoji: '📦', label: '제품·상품',
      desc: '실물 그대로, 왜곡 없이 보여주는 판매·홍보 쇼츠예요.',
      inputHint: '📷 사진 필요 (제품 사진 3~8장, 앞·옆·위 필수)',
      example: '예: 수제 핸드크림, 동네 베이커리 신메뉴' },
    { code: 'insight', emoji: '🧠', label: '지식·인사이트 큐레이션',
      desc: '"1분 만에 똑똑해지는" 경제·시사·역사·과학·트렌드 요약 쇼츠예요.',
      inputHint: '✍️ 사진 불필요 (다루고 싶은 주제만 입력하면 AI가 전부 완성)',
      example: '예: 이번 주 꼭 알아야 할 경제 뉴스, 몰랐던 일상 속 진실 TOP3',
      scriptSample: '"이번 주 기준금리 인하 소식, 내 월급과 대출 이자에 어떤 영향을 줄까요? 기준금리가 인하되면 변동금리 대출을 가진 가계의 이자 부담이 직접..."' },
    { code: 'wellness', emoji: '🌿', label: '저속노화&웰니스',
      desc: '식습관·운동·수면 등 오늘부터 바로 따라 할 수 있는 건강 팁 쇼츠예요.',
      inputHint: '✍️ 사진 불필요 (다루고 싶은 건강 팁 주제만 입력)',
      example: '예: 혈당 안 튀는 먹방 순서, 3분 거북목 스트레칭',
      scriptSample: '"식사 후 늘 졸음이 쏟아지고 몸이 무거우신가요? 원인은 식사 후 급격히 오르내리는 혈당 스파이크 때문! 간단한 식사 순서만 바꿔도 혈당을 안정시키고..."' },
    { code: 'meme', emoji: '🎭', label: '공감형 밈&POV',
      desc: '직장인·일상 공감 에피소드를 재밌게 풀어내는 상황극 쇼츠예요.',
      inputHint: '✍️ 사진 불필요 (다루고 싶은 공감 상황만 입력)',
      example: '예: 재택근무할 때 흔한 착각, 퇴근 5분 전 상사의 급한 부탁',
      scriptSample: '"다들 재택근무하면 여유로울 줄 알았지? 하지만 현실은 우리가 생각한 것과 완전 다르다는거... 출퇴근 시간 아껴서 자기계발은 무슨! 그냥 일하는 시간이 두 배로..."' },
];
const NO_IMAGE_CATEGORIES: Category[] = ['insight', 'wellness', 'meme'];
// 생일축하(2026-08-02 2차, 사장 요청) — 가족사진·케이크사진 모두 "선택"이라 NO_IMAGE와
// 구분한다. NO_IMAGE는 사진 업로드 UI 자체가 없지만, 이 카테고리는 업로드는 가능하되
// 필수는 아니다.
const OPTIONAL_IMAGE_CATEGORIES: Category[] = ['birthday'];
const MAX_FAMILY_PHOTOS = 3;

// 업로드 이미지를 원본 그대로 base64 인코딩하면 폰 카메라 사진(장당 6MB 허용) 여러 장이
// 겹쳐 shared-api의 요청 본문 제한(10MB)을 쉽게 넘는다(2026-08-03 생일축하 413 에러 실측 —
// 가족사진 최대 3장+케이크 1장까지 받다 보니 유일하게 4장이 겹치는 카테고리에서 터졌다).
// Vision 분석 재료로는 원본 화질이 필요 없으므로 긴 변 1600px로 축소해 크기를 줄인다.
function resizeToDataUrl(file: File, maxSide: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('canvas context 없음')); return; }
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
        img.src = url;
    });
}

// 사진 없는 카테고리의 주제 입력 [라벨, placeholder].
// ★맵으로 뺀 이유(2026-08-02): 원래 삼항 3겹이었는데 생일축하가 늘면서 4겹이 됐다.
//   카테고리가 더 늘 예정이라 여기 한 줄 추가로 끝나게 한다.
const TOPIC_LABEL: Partial<Record<Category, [string, string]>> = {
    insight:  ['다루고 싶은 주제/키워드', '예: 요즘 금리 인하가 내 월급에 미치는 영향'],
    wellness: ['다루고 싶은 건강·생활 팁 주제', '예: 저속노화 식단, 아침 루틴'],
    meme:     ['다루고 싶은 공감 상황', '예: 퇴근 5분 전 상사가 급한 일을 시킬 때'],
    birthday: ['누구의 생일인가요? 전하고 싶은 말도 함께 적어주세요', '예: 엄마 생신이에요. 늘 고맙고 건강하셨으면 좋겠어요'],
};

// 실제 매일 자동 생성되는 쇼츠 완성본 2편 — 신뢰 형성용 샘플(HomepageBoard 패턴과 동일 취지).
const SAMPLES = [
    { label: '헤어스타일 체험', emoji: '💇', url: 'https://youtube.com/shorts/znnbawP26zo' },
    { label: 'AI 프로필사진', emoji: '🖼️', url: 'https://youtube.com/shorts/UFdVxKrmF8E' },
];

const MOOD_CHIPS = ['재밌는', '감성적인', '신뢰감 있는', '트렌디한', '따뜻한', '임팩트있는'];
const LANGUAGES: { code: string; label: string }[] = [
    { code: 'ko', label: '한국어' }, { code: 'zh', label: '중국어' }, { code: 'ja', label: '일본어' },
    { code: 'en', label: '영어' }, { code: 'vi', label: '베트남어' },
];

const STATUS_LABEL: Record<string, string> = {
    pending: '시나리오 준비 중', processing_research: '시나리오 준비 중',
    scenarios_ready: '선택 대기',
    previewing: '미리보기 준비 중', processing_preview: '미리보기 준비 중', preview_ready: '미리보기 완성',
    producing: '영상 제작 중', processing_produce: '영상 제작 중',
    done: '완성', failed: '실패',
};

// 영상 제작(producing) 단계 세부 진행상황 — shorts_maker_worker.py의 _set_progress가 기록하는
// 순서와 1:1 대응(script→images→tts→verify). 사장 피드백(2026-07-23): 스피너만 돌아서 답답함.
const PROGRESS_STEPS: { key: 'script' | 'images' | 'tts' | 'verify'; label: string }[] = [
    { key: 'script', label: '대본을 다듬고 있어요' },
    { key: 'images', label: '사진을 장면마다 새로 그리고 있어요' },
    { key: 'tts', label: '목소리를 입히고 영상을 합치고 있어요' },
    { key: 'verify', label: '완성본을 마지막으로 점검하고 있어요' },
];

// 시나리오 준비(waiting) 단계 세부 진행상황 — process_research가 기록하는 순서와 1:1 대응
// (research→scenarios). 사장 피드백(2026-07-23): 이 단계도 스피너만 돌아서 답답함.
// ★"업종·트렌드 조사"는 광고성 카테고리(community/product) 전용 문구다 — 생일축하는
//   특정 개인 축하 메시지라 업종이 없는데 이 문구가 그대로 뜨는 게 어색했다(2026-08-03
//   사장 지적). 카테고리별로 다른 문구를 쓰도록 함수화.
function waitingSteps(category: Category): { key: 'research' | 'scenarios'; label: string }[] {
    const researchLabel = category === 'birthday'
        ? '따뜻한 축하 문구를 구상하고 있어요'
        : category === 'insight' || category === 'wellness' || category === 'meme'
        ? '주제를 조사하고 있어요'
        : '업종·트렌드를 조사하고 있어요';
    return [
        { key: 'research', label: researchLabel },
        { key: 'scenarios', label: '서로 다른 시나리오 5개를 쓰고 있어요' },
    ];
}

interface FormState {
    biz: string; strengths: string; target: string; mood: string;
    referenceUrl1: string; referenceUrl2: string; language: string; qrUrl: string;
    topic: string;   // 사진 없는 카테고리(insight/wellness/meme) 전용 — 다루고 싶은 주제/키워드
}
const EMPTY_FORM: FormState = { biz: '', strengths: '', target: '', mood: '', referenceUrl1: '', referenceUrl2: '', language: 'ko', qrUrl: '', topic: '' };

// ★스타일 목록 지연 로더(2026-08-02 3차) — plan 단계 진입 시 1회만 outfitApi.styles()를
// 호출한다. 별도 컴포넌트로 뽑은 이유: [plan] 블록은 조건부 렌더라 부모의 useEffect에
// 두면 "카테고리를 오갈 때마다 다시 부르는지" 의존성 배열 관리가 번거로워진다 — 이
// 컴포넌트가 마운트되는 순간(=step==='plan'이고 사진 카테고리일 때)에만 자연히 1회 호출.
const StyleLoader: React.FC<{ onLoaded: (styles: OutfitStyle[]) => void }> = ({ onLoaded }) => {
    useEffect(() => {
        outfitApi.styles().then(onLoaded).catch(() => onLoaded([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <p className="text-[11px] text-gray-400">스타일 목록을 불러오는 중…</p>;
};

export const ShortsMakerBoard: React.FC<Props> = ({ onClose }) => {
    // ★2026-08-02 3차 개편 — 'scenarios'(시나리오 선택) 다음에 'plan'(요금제+스타일 확정)
    // → 'previewing'/'preview'(5초 미리보기) → 'producing'(결제 후 실제 제작) 순서로 확장.
    const [step, setStep] = useState<'intro' | 'form' | 'waiting' | 'scenarios' | 'plan' | 'previewing' | 'preview' | 'producing' | 'result' | 'list'>('intro');
    // 요금제+스타일 선택 상태(2026-08-02 3차) — plan 단계에서 채워 preview API로 넘긴다.
    const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number | null>(null);
    const [plan, setPlan] = useState<'standard' | 'premium'>('standard');
    const [planRestyleKeys, setPlanRestyleKeys] = useState<string[]>([]);
    const [planOutfitStyles, setPlanOutfitStyles] = useState<OutfitStyle[] | null>(null);
    const [selectedFinalSlot, setSelectedFinalSlot] = useState<0 | 1>(0);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [category, setCategory] = useState<Category>('community');
    // 카테고리 카드 상세 펼침(2026-08-02) — 카드가 늘수록 목록이 복잡해 보인다는 사장 지적.
    // 접힌 카드는 아이콘·이름·한 줄 요약·사진 배지만, 상세는 호버(데스크톱)로 미리보고
    // 탭(모바일)으로도 열 수 있게 한다. 호버 전용으로 만들면 폰에서 정보가 막힌다.
    const [hoverCat, setHoverCat] = useState<Category | null>(null);
    // isProduct/noImage는 category의 파생값 — 기존 isProduct 참조 코드(검증·업로드 로직)를
    // 그대로 두고 값만 category에서 계산해 변경 범위를 최소화한다.
    const isProduct = category === 'product';
    const noImage = NO_IMAGE_CATEGORIES.includes(category);
    const optionalImage = OPTIONAL_IMAGE_CATEGORIES.includes(category);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    // 생일축하 전용(2026-08-02 2차) — 케이크 사진(선택, 1장)+위치.
    // ★가족사진 AI 재해석(restyle/restyleKey)은 2026-08-02 3차에서 신청서 단계에서
    // 빼고 [plan] 단계(시나리오 선택 후 요금제+스타일 확정)로 옮겼다 — 전 카테고리
    // 공통 스타일 선택 UI로 통합(planRestyleKeys 참고).
    const [cakeFile, setCakeFile] = useState<File | null>(null);
    const [cakePreview, setCakePreview] = useState<string | null>(null);
    const [cakePosition, setCakePosition] = useState<'start' | 'end'>('end');
    const cakeFileRef = useRef<HTMLInputElement>(null);
    const [reqId, setReqId] = useState<number | null>(null);
    const [row, setRow] = useState<UserShortsRow | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    // ★페이징(2026-08-02 3차) — 완성본은 영구 보관이라 "더 보기"로 전체를 볼 수 있어야 한다.
    const [mineList, setMineList] = useState<UserShortsRow[]>([]);
    const [mineTotal, setMineTotal] = useState(0);
    const MINE_PAGE_SIZE = 30;
    const [previewSample, setPreviewSample] = useState<{ label: string; url: string } | null>(null);
    // 인트로 샘플(2026-07-25) — 샘플 영상 보관함(SampleVault)의 실제 완성본을 보여준다.
    // 아직 로딩 전/실패 시엔 아래 SAMPLES(고정 2개)로 폴백해 화면이 비지 않게 한다.
    const [vaultSamples, setVaultSamples] = useState<SampleVaultRow[]>([]);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadMine = (offset = 0, append = false) => {
        shortsMakerApi.mine(offset, MINE_PAGE_SIZE).then(res => {
            setMineList(prev => append ? [...prev, ...res.rows] : res.rows);
            setMineTotal(res.total);
        }).catch(() => {});
    };

    useEffect(() => {
        loadMine();
        sampleVaultApi.list().then(setVaultSamples).catch(() => {});
    }, []);

    // ★단계가 바뀌면 항상 맨 위부터 보여준다(2026-08-02 사장 지적 "포커스가 중간 이하").
    //   원인: intro의 "내 쇼츠 만들기 시작"과 form의 "100P — 시나리오 5개 받기"가
    //   className·부모 내 위치까지 같아 React가 **같은 DOM 노드로 재사용**한다. 그래서
    //   intro에서 클릭해 포커스를 얻은 그 노드가 form에서도 포커스를 유지한 채 폼 맨
    //   아래로 이동하고, 브라우저가 포커스된 요소를 보이게 하려 1128px까지 스크롤해버렸다
    //   (실측: scrollTop 0 → 1128, 전체 1749). 그래서 폼 상단 입력칸이 아니라 "참고 자료"
    //   근처가 첫 화면으로 보였다.
    //   blur()로 포커스를 놓아 브라우저의 자동 스크롤 근거를 없애고, 스크롤도 0으로 되돌린다.
    //   ('smooth'를 쓰면 되돌리는 과정이 눈에 보여 오히려 산만하다 — 즉시 이동.)
    useEffect(() => {
        (document.activeElement as HTMLElement | null)?.blur?.();
        scrollRef.current?.scrollTo({ top: 0 });
    }, [step]);

    // 폴링(2026-08-02 3차 확장): pending→scenarios_ready, previewing→preview_ready,
    // producing→done/failed. 3단계 모두 폴링 대상에 추가.
    useEffect(() => {
        if ((step !== 'waiting' && step !== 'previewing' && step !== 'producing') || !reqId) return;
        const tick = async () => {
            try {
                const r = await shortsMakerApi.get(reqId);
                setRow(r);
                if (r.status === 'scenarios_ready') { if (pollRef.current) clearInterval(pollRef.current); setStep('scenarios'); }
                else if (r.status === 'preview_ready') { if (pollRef.current) clearInterval(pollRef.current); setStep('preview'); }
                else if (r.status === 'done' || r.status === 'failed') { if (pollRef.current) clearInterval(pollRef.current); setStep('result'); }
            } catch { /* 일시 오류는 다음 폴링에서 재시도 */ }
        };
        tick();
        pollRef.current = setInterval(tick, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [step, reqId]);

    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files || []);
        if (picked.length === 0) return;
        const max = isProduct ? MAX_IMAGES_PRODUCT : (optionalImage ? MAX_FAMILY_PHOTOS : MAX_IMAGES);
        const room = max - imageFiles.length;
        if (room <= 0) { setError(`이미지는 최대 ${max}장까지 올릴 수 있어요.`); return; }
        const toAdd = picked.slice(0, room);
        if (toAdd.some(f => f.size > 6 * 1024 * 1024)) { setError('이미지는 장당 6MB 이내로 올려주세요.'); return; }
        setImageFiles(prev => [...prev, ...toAdd]);
        setImagePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
        setError(null);
        e.target.value = '';   // 같은 파일 재선택 가능하게
    };

    // 상품 모드 3필수 슬롯(앞/옆/위아래) 전용 — 특정 인덱스에 사진을 끼워 넣거나 교체한다.
    const onPickProductSlot = (slotIdx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 6 * 1024 * 1024) { setError('이미지는 장당 6MB 이내로 올려주세요.'); return; }
        setImageFiles(prev => {
            const next = [...prev];
            next[slotIdx] = file;
            return next;
        });
        setImagePreviews(prev => {
            const next = [...prev];
            next[slotIdx] = URL.createObjectURL(file);
            return next;
        });
        setError(null);
    };

    const removeImage = (idx: number) => {
        if (isProduct && idx < PRODUCT_SLOTS.length) {
            // 필수 슬롯은 비워두면 다시 채워야 하므로 자리만 비운다(배열 shift 금지 —
            // 슬롯 라벨과 실제 사진 순서가 어긋나지 않도록).
            setImageFiles(prev => { const next = [...prev]; next[idx] = undefined as unknown as File; return next; });
            setImagePreviews(prev => { const next = [...prev]; next[idx] = undefined as unknown as string; return next; });
            return;
        }
        setImageFiles(prev => prev.filter((_, i) => i !== idx));
        setImagePreviews(prev => prev.filter((_, i) => i !== idx));
    };

    const productSlotsFilled = () => isProduct && PRODUCT_SLOTS.every((_, i) => !!imageFiles[i]);

    const onPickCake = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 6 * 1024 * 1024) { setError('이미지는 장당 6MB 이내로 올려주세요.'); return; }
        setCakeFile(file);
        setCakePreview(URL.createObjectURL(file));
        setError(null);
    };
    const removeCake = () => { setCakeFile(null); setCakePreview(null); };

    const submit = async () => {
        if (optionalImage) {
            // 생일축하 — 가족사진·케이크사진 모두 선택이라 이미지 검증 자체가 없다(topic만 필수).
            if (form.topic.trim().length < 2) { setError('누구의 생일인지 적어주세요.'); return; }
        } else if (noImage) {
            if (form.topic.trim().length < 2) { setError('다루고 싶은 주제를 입력해 주세요.'); return; }
        } else if (isProduct) {
            if (!productSlotsFilled()) { setError('제품 사진은 앞면·옆면·위(또는 아래) 3장이 모두 필요해요.'); return; }
        } else if (imageFiles.length === 0) {
            setError('이미지를 1장 이상 올려 주세요.'); return;
        }
        if (!noImage && !optionalImage) {
            if (form.biz.trim().length < 2) { setError('업종/상품명을 입력해 주세요.'); return; }
            if (form.strengths.trim().length < 2) { setError('핵심 장점을 입력해 주세요.'); return; }
            if (form.target.trim().length < 2) { setError('타겟 고객을 입력해 주세요.'); return; }
        }
        setError(null); setSubmitting(true);
        try {
            // ★product는 최대 8장이라 같은 강도로는 총합이 커진다(Vercel 프록시 상한
            //   ~10MB 실측, shared-api MAX_IMAGE_B64_LEN_PRODUCT=8MB) — 장수가 많을수록
            //   장당 더 강하게 압축한다(2026-08-03).
            const toB64 = (f: File) => resizeToDataUrl(f, isProduct ? 1280 : 1600, isProduct ? 0.75 : 0.85);
            const validFiles = (noImage || (optionalImage && imageFiles.length === 0)) ? [] : imageFiles.filter((f): f is File => !!f);
            const images = await Promise.all(validFiles.map(toB64));
            const cakeB64 = cakeFile ? await toB64(cakeFile) : undefined;
            const body: Record<string, string> = { category };
            (Object.keys(form) as (keyof FormState)[]).forEach(k => { const v = form[k].trim(); if (v) body[k] = v; });
            if (isProduct) body.isProduct = 'true';
            if (optionalImage) {
                body.cakePosition = cakePosition;
            }
            const res = await shortsMakerApi.create(body, images, cakeB64);
            setReqId(res.id); setRow(null); setStep('waiting');
        } catch (e: any) {
            if (e.code !== 'INSUFFICIENT_POINTS') setError(e.message || '신청에 실패했어요.');
        } finally {
            setSubmitting(false);
        }
    };

    // ★2026-08-02 3차 — 시나리오를 고르면 바로 제작하지 않고 요금제+스타일 선택 화면으로.
    const selectScenario = (idx: number) => {
        setSelectedScenarioIdx(idx);
        setPlan('standard');
        setPlanRestyleKeys([]);
        setPlanOutfitStyles(null); // StyleLoader가 다시 조회하도록 초기화
        setStep('plan');
    };

    // 요금제·스타일 확정 → 5초 미리보기 생성 요청(무료). 프리미엄은 스타일 정확히 2개 필수.
    const confirmPlanAndPreview = async () => {
        if (!reqId || selectedScenarioIdx === null) return;
        if (plan === 'premium' && planRestyleKeys.length !== 2) {
            setError('프리미엄은 스타일을 2개 선택해 주세요.'); return;
        }
        if (plan === 'standard' && planRestyleKeys.length > 1) {
            setError('스탠다드는 스타일을 1개까지만 선택할 수 있어요.'); return;
        }
        setError(null); setSubmitting(true);
        try {
            await shortsMakerApi.preview(reqId, selectedScenarioIdx, plan, planRestyleKeys);
            setRow(null); setStep('previewing');
        } catch (e: any) {
            setError(e.message || '미리보기 요청에 실패했어요.');
        } finally {
            setSubmitting(false);
        }
    };

    // 미리보기 확인 후 결제 확정 → 실제 제작 시작.
    const confirmProduce = async () => {
        if (!reqId) return;
        setSubmitting(true); setError(null);
        try {
            await shortsMakerApi.confirm(reqId);
            setStep('producing');
        } catch (e: any) {
            if (e.code !== 'INSUFFICIENT_POINTS') setError(e.message || '제작 확정에 실패했어요.');
        } finally {
            setSubmitting(false);
        }
    };

    const remove = async (id: number) => {
        if (!confirm('이 쇼츠를 삭제할까요?')) return;
        try {
            await shortsMakerApi.delete(id);
            setMineList(prev => prev.filter(r => r.id !== id));
            setMineTotal(prev => Math.max(0, prev - 1));
        } catch (e: any) {
            alert('삭제 실패: ' + e.message);
        }
    };

    const reset = () => {
        setForm(EMPTY_FORM); setCategory('community'); setImageFiles([]); setImagePreviews([]);
        setReqId(null); setRow(null); setError(null); setStep('intro');
        loadMine();
    };

    const done = row?.status === 'done';

    return (
        <>
        {/* 샘플/완성 쇼츠 미리보기 — 유튜브 임베드(아직 완성 전 자기 영상은 자체 스트리밍). */}
        {previewSample && (
            <div className="fixed inset-0 z-[60] bg-black/70 flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 bg-white shrink-0">
                    <span className="text-sm font-bold text-gray-800">{previewSample.label}</span>
                    <button onClick={() => setPreviewSample(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1">×</button>
                </div>
                <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
                    {/* 9:16 종횡비 고정 wrapper — 유튜브 iframe이 부모(flex-1, PC에서 뷰포트
                        전체 높이)를 100% 채우면 16:9 기준 임베드가 세로형 영상을 레터박스/
                        크롭해 보여주는 문제가 있었음(사장 실사용 피드백: "100%라서 잘림").
                        h-full 기준으로 9:16 비율을 유지하며 폭이 넘치면 max-w-full로 축소. */}
                    <div className="h-full max-h-full aspect-[9/16] max-w-full">
                        {previewSample.url.startsWith('http') && previewSample.url.includes('youtube.com') ? (
                            <iframe
                                src={previewSample.url.replace('youtube.com/shorts/', 'youtube.com/embed/')}
                                title={previewSample.label} className="w-full h-full border-0"
                                allow="autoplay; encrypted-media" allowFullScreen
                            />
                        ) : (
                            <video src={previewSample.url} controls autoPlay className="w-full h-full" />
                        )}
                    </div>
                </div>
            </div>
        )}
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4
                         pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-4">
            <div ref={scrollRef}
                 className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        {(step === 'list' || step === 'form') && (
                            <button onClick={() => setStep('intro')} aria-label="뒤로"
                                    style={{ backgroundColor: '#FCE7F0', color: PINK }}
                                    className="shrink-0 -ml-1 w-7 h-7 rounded-full hover:brightness-95 flex items-center justify-center text-sm">←</button>
                        )}
                        <span className="text-lg">🎬</span>
                        <h2 className="text-base font-bold" style={{ color: PINK }}>쇼츠 만들기</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
                </div>

                <div className="p-4 space-y-4">
                    {/* [intro] */}
                    {step === 'intro' && (
                        <>
                            <div className="text-sm text-gray-600 leading-relaxed space-y-1">
                                <p>마케팅 담당 <b>아린</b>이 <b>쇼츠 시나리오 5개</b>를 만들어 드려요.</p>
                                <ul className="list-disc list-inside text-[13px] text-gray-500 space-y-0.5">
                                    <li><b>커뮤니티·제품</b> — 사진을 올려주세요</li>
                                    <li><b>지식·웰니스·밈</b> — 사진 없이 주제만 입력해도 돼요</li>
                                </ul>
                                <p className="text-[13px]">마음에 드는 시나리오를 고르면 실제 영상으로 완성해 드려요.</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-gray-700">👀 이런 쇼츠가 나와요 — 눌러서 구경해 보세요</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {(vaultSamples.length > 0
                                        ? vaultSamples.slice(0, 6).map(row => ({
                                            key: `vault-${row.id}`,
                                            label: row.title,
                                            emoji: CATEGORIES.find(c => c.code === row.category)?.emoji || '🎬',
                                            thumbnailUrl: row.hasThumbnail ? sampleVaultApi.thumbnailUrl(row.id) : null,
                                            onClick: () => setPreviewSample({ label: row.title, url: sampleVaultApi.videoUrl(row.id) }),
                                          }))
                                        : SAMPLES.map(s => ({
                                            key: s.label, label: s.label, emoji: s.emoji, thumbnailUrl: null,
                                            onClick: () => setPreviewSample(s),
                                          }))
                                    ).map(card => (
                                        <button key={card.key} type="button" onClick={card.onClick}
                                           className="rounded-xl border border-pink-100 bg-pink-50/50 p-2 text-center hover:bg-pink-50 transition-colors overflow-hidden">
                                            {card.thumbnailUrl ? (
                                                // 쇼츠 원본이 세로(9:16)라 썸네일도 그 비율 그대로 — object-cover를
                                                // 고정 높이(h-16)에 억지로 채우면 인물이 위아래로 잘려 보이던 문제 수정.
                                                <img src={card.thumbnailUrl} alt={card.label}
                                                     className="w-full aspect-[9/16] object-cover rounded-lg mb-1" />
                                            ) : (
                                                <div className="text-2xl py-4">{card.emoji}</div>
                                            )}
                                            <div className="text-[11px] font-semibold text-gray-700 mt-1 truncate">{card.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {mineList.length > 0 && (
                                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600 flex items-center justify-between gap-2">
                                    <span>🎞️ 내가 만든 쇼츠가 있어요</span>
                                    <button onClick={() => setStep('list')}
                                            className="shrink-0 font-semibold underline" style={{ color: PINK }}>보러 가기</button>
                                </div>
                            )}
                            <div className="rounded-xl bg-pink-50 border border-pink-100 px-3 py-2 text-xs" style={{ color: PINK }}>
                                💎 시나리오 5개 100P → 마음에 드는 것 선택 시 영상 제작 2,000P. 실패하면 자동 환불돼요.
                            </div>
                            <button onClick={() => setStep('form')}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                                    style={{ backgroundColor: PINK }}>
                                ✨ 내 쇼츠 만들기 시작
                            </button>
                        </>
                    )}

                    {/* [list] 내가 만든 쇼츠 목록 */}
                    {step === 'list' && (
                        <>
                            <p className="text-sm font-semibold text-gray-800">내가 만든 쇼츠</p>
                            {mineList.length === 0 && (
                                <p className="text-xs text-gray-400 py-6 text-center">아직 만든 쇼츠가 없어요.</p>
                            )}
                            <button onClick={() => setStep('form')}
                                    className="w-full py-2.5 rounded-xl border text-sm font-semibold"
                                    style={{ borderColor: PINK, color: PINK }}>
                                ✨ 새 쇼츠 만들기
                            </button>
                            <div className="space-y-2">
                                {mineList.map(r => {
                                    let bizName = '';
                                    try { bizName = r.formJson ? (JSON.parse(r.formJson).biz || '') : ''; } catch { /* 무시 */ }
                                    return (
                                        <div key={r.id} className="rounded-xl border border-gray-100 px-3 py-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-gray-800 truncate">{bizName || `쇼츠 #${r.id}`}</span>
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${r.status === 'done' ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                                                      style={r.status === 'done' ? { backgroundColor: PINK } : undefined}>
                                                    {STATUS_LABEL[r.status] || r.status}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
                                            {r.status === 'done' && r.hasVideo && (
                                                <div className="flex items-center gap-3 pt-0.5">
                                                    <button onClick={() => setPreviewSample({ label: bizName || `쇼츠 #${r.id}`, url: shortsMakerApi.videoUrl(r.id) })}
                                                            className="text-xs font-semibold underline" style={{ color: PINK }}>▶️ 보기</button>
                                                    <a href={shortsMakerApi.videoUrl(r.id, { download: true })} download className="text-xs underline text-gray-400 hover:text-gray-600">📦 다운로드</a>
                                                    <button onClick={() => remove(r.id)}
                                                            className="text-xs underline text-gray-400 hover:text-red-500 ml-auto">🗑️ 삭제</button>
                                                </div>
                                            )}
                                            {r.status !== 'done' && (
                                                <button onClick={() => remove(r.id)}
                                                        className="text-xs underline text-gray-400 hover:text-red-500">🗑️ 삭제</button>
                                            )}
                                            {r.status === 'failed' && (
                                                <div className="text-[11px] text-gray-400">{r.errorMessage || '생성에 실패했어요.'}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* ★완성본 영구 보관(2026-08-02 3차) — 목록이 30개를 넘으면 "더 보기"로
                                끝까지 볼 수 있게 한다(예전엔 최신 30건 고정이라 그 이전 건은 UI에서
                                안 보였음, DB엔 그대로 남아있었지만 진입 경로가 없었다). */}
                            {mineList.length < mineTotal && (
                                <button onClick={() => loadMine(mineList.length, true)}
                                        className="w-full py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">
                                    더 보기 ({mineList.length}/{mineTotal})
                                </button>
                            )}
                        </>
                    )}

                    {/* [form] 신청서 */}
                    {step === 'form' && (
                        <>
                            <div className="space-y-1.5">
                                {/* ★타이틀 스타일(2026-08-02 3차, 사장 지적 "타이틀 느낌이 안 남") —
                                    랜딩페이지 브랜드 폰트(Cormorant Garamond)로 통일 + 크기 확대.
                                    문구는 유지하고 폰트만 제목답게 바꾼다. */}
                                <p className="text-lg font-semibold text-gray-800"
                                   style={{ fontFamily: "'Cormorant Garamond', serif" }}>어떤 쇼츠를 만들까요? *</p>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {CATEGORIES.map(c => {
                                        const open = category === c.code || hoverCat === c.code;
                                        return (
                                        <button key={c.code} type="button"
                                                onClick={() => {
                                                    setCategory(c.code);
                                                    setImageFiles([]); setImagePreviews([]); setError(null);
                                                }}
                                                onMouseEnter={() => setHoverCat(c.code)}
                                                onMouseLeave={() => setHoverCat(null)}
                                                className="flex items-start gap-2.5 text-left rounded-xl px-3 py-2.5 border transition-colors"
                                                style={category === c.code
                                                    ? { backgroundColor: '#FDE6F0', borderColor: PINK }
                                                    : { borderColor: '#e5e7eb' }}>
                                            <span className="text-xl shrink-0 mt-0.5">{c.emoji}</span>
                                            <span className="flex-1 min-w-0">
                                                {/* 접힌 상태에도 남기는 것: 이름 + 한 줄 요약 + 사진 배지.
                                                    ★사진 필요/불필요는 설명이 아니라 **선택 조건**이다 — 사진이 없는
                                                    회원은 이걸 보고 카테고리를 거르므로 접어두면 안 된다. */}
                                                <span className="flex items-center gap-1.5">
                                                    <span className="text-sm font-semibold text-gray-800">{c.label}</span>
                                                    <span className="shrink-0 text-[9.5px] font-medium rounded-full px-1.5 py-0.5"
                                                          style={NO_IMAGE_CATEGORIES.includes(c.code)
                                                              ? { backgroundColor: '#EFF6FF', color: '#3B7DD8' }
                                                              : OPTIONAL_IMAGE_CATEGORIES.includes(c.code)
                                                              ? { backgroundColor: '#F5F0FF', color: '#8B5FBF' }
                                                              : { backgroundColor: '#FDE6F0', color: PINK }}>
                                                        {NO_IMAGE_CATEGORIES.includes(c.code) ? '✍️ 사진 불필요'
                                                            : OPTIONAL_IMAGE_CATEGORIES.includes(c.code) ? '✍️📷 사진 선택'
                                                            : '📷 사진 필요'}
                                                    </span>
                                                </span>
                                                <span className="block text-[11px] text-gray-500 mt-0.5">{c.desc}</span>

                                                {/* 상세는 접어둔다 — 카테고리가 늘어도 목록이 한 화면에 들어오게.
                                                    여는 방법을 **호버와 탭 둘 다** 둔 건 의도적이다: 폰에는 호버가
                                                    없어서, 호버에만 걸면 모바일에서 이 정보에 영영 닿을 수 없다.
                                                    (선택된 카드는 계속 펼쳐둔다 — 지금 고른 게 뭔지 확인해야 하므로.) */}
                                                {open && (
                                                    <>
                                                        <span className="block text-[11px] text-pink-600 font-medium mt-1">{c.inputHint}</span>
                                                        <span className="block text-[10px] text-gray-400 mt-0.5">{c.example}</span>
                                                        {c.scriptSample && (
                                                            <span className="block text-[10px] text-gray-500 italic mt-1 bg-gray-50 rounded-lg px-2 py-1">
                                                                📝 완성 대본 예시: {c.scriptSample}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                                {!open && (
                                                    <span className="block text-[10px] text-gray-300 mt-0.5">눌러서 자세히 보기</span>
                                                )}
                                            </span>
                                        </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 섹션: 사진 + 핵심 정보(카테고리에 따라 이미지 업로드 또는 주제 입력) */}
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-3">
                                <p className="text-xs font-bold text-gray-800">📋 핵심 정보</p>
                                <p className="text-xs text-gray-500 -mt-2">
                                    {category === 'birthday' ? (
                                        <><b>받는 분과 전하고 싶은 말</b>은 꼭 적어주세요. 가족사진·케이크사진은 있으면 실제 사진 그대로 넣어드리고, 없어도 AI가 대신 채워드려요. 적지 않은 내용(나이·직업 등)은 지어내지 않아요.</>
                                    ) : noImage ? (
                                        <><b>다루고 싶은 주제</b>만 적어주시면 AI가 사진부터 대본까지 전부 새로 만들어요. 사실과 다른 정보는 신중하게 확인 후 전달해요.</>
                                    ) : (
                                        <><b>업종/상품명·핵심 장점·타겟 고객</b>은 필수예요. 여기 적지 않은 효과·수치는 AI가 지어내지 않아요.</>
                                    )}
                                </p>
                                {/* ★콘텐츠 책임 고지(2026-07-25 사장 지시) — 특정 개인/기업 비방(밈)·오정보(지식
                                    큐레이션) 리스크가 있는 카테고리는 신청 시점에 책임 소재를 명확히 안내한다.
                                    법적 효력은 TermsModal.tsx 제7조가 담당, 이 문구는 사용자 인지 목적. */}
                                {/* ★생일축하는 이 경고를 다르게 준다(2026-08-02) — 축하 영상 화면에
                                    "타인의 권리 침해" 경고가 붙으면 분위기가 어긋난다. 대신 실제로
                                    필요한 안내(받는 분 동의)만 부드럽게 남긴다. */}
                                <p className="text-[11px] text-gray-400 leading-relaxed -mt-1.5">
                                    {category === 'birthday'
                                        ? '💝 받는 분이 기뻐할 내용으로 적어주세요. 공개된 곳에 올릴 때는 본인 동의를 받는 게 좋아요.'
                                        : <>⚠️ {category === 'meme'
                                            ? '특정 인물·회사·단체가 특정되지 않게, 보편적인 상황으로 입력해 주세요.'
                                            : category === 'insight'
                                            ? '입력하신 주제와 내용에 대한 사실관계 확인 책임은 신청자에게 있어요.'
                                            : '입력하신 내용에 대한 책임은 신청자 본인에게 있어요.'} 타인의 권리를 침해하는 내용은 삼가주세요.</>}
                                </p>

                                {optionalImage ? (
                                    <div className="space-y-3">
                                        {/* 가족사진(선택, 최대 3장) — 재해석 옵션이 꺼져 있으면 원본 그대로 사용 */}
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                                                가족/인물 사진 <span className="font-normal text-gray-400">(선택, 최대 {MAX_FAMILY_PHOTOS}장 — 없어도 AI가 대신 채워요)</span>
                                            </label>
                                            {imagePreviews.length > 0 && (
                                                <div className="flex gap-2 mb-2 flex-wrap">
                                                    {imagePreviews.map((src, i) => (
                                                        <div key={i} className="relative">
                                                            <img src={src} alt={`업로드 ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-100" />
                                                            <button onClick={() => removeImage(i)} type="button"
                                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs leading-none flex items-center justify-center">×</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {imageFiles.length < MAX_FAMILY_PHOTOS && (
                                                <div onClick={() => fileRef.current?.click()}
                                                     className="border-2 border-dashed border-pink-200 rounded-xl p-3 text-center cursor-pointer hover:bg-pink-50/50 transition-colors bg-white">
                                                    <div className="text-gray-400 text-xs py-3">📷 눌러서 가족사진을 올려주세요 ({imageFiles.length}/{MAX_FAMILY_PHOTOS})</div>
                                                </div>
                                            )}
                                            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
                                            {/* ★AI 스타일 재해석 선택은 2026-08-02 3차부터 여기(신청서 단계)가 아니라
                                                시나리오를 고른 뒤 [plan] 단계(요금제+스타일 확정)에서 전 카테고리
                                                공통으로 처리한다 — 신청서 단계엔 사진 업로드까지만 남긴다. */}
                                        </div>
                                        {/* 케이크 사진(선택, 1장) — 항상 원본 그대로, 위치만 선택 */}
                                        <div className="pt-2 border-t border-gray-100">
                                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                                                🎂 케이크 사진 <span className="font-normal text-gray-400">(선택, 1장 — 재해석 없이 실제 사진 그대로 넣어요)</span>
                                            </label>
                                            {cakePreview ? (
                                                <div className="relative w-20">
                                                    <img src={cakePreview} alt="케이크" className="w-20 h-20 object-cover rounded-lg border border-gray-100" />
                                                    <button onClick={removeCake} type="button"
                                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs leading-none flex items-center justify-center">×</button>
                                                </div>
                                            ) : (
                                                <div onClick={() => cakeFileRef.current?.click()}
                                                     className="border-2 border-dashed border-pink-200 rounded-xl p-3 text-center cursor-pointer hover:bg-pink-50/50 transition-colors bg-white">
                                                    <div className="text-gray-400 text-xs py-3">🎂 눌러서 케이크 사진을 올려주세요</div>
                                                </div>
                                            )}
                                            <input ref={cakeFileRef} type="file" accept="image/*" className="hidden" onChange={onPickCake} />
                                            {cakePreview && (
                                                <div className="flex gap-2 mt-2">
                                                    {(['start', 'end'] as const).map(pos => (
                                                        <button key={pos} type="button" onClick={() => setCakePosition(pos)}
                                                                className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${cakePosition === pos ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                                                            {pos === 'start' ? '영상 맨 처음에' : '영상 맨 마지막에'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : noImage ? (
                                    <div className="rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-2.5 text-xs text-gray-600">
                                        📷 이 카테고리는 사진이 필요 없어요 — 아래 주제만 입력하면 AI가 이미지까지 전부 새로 만들어요.
                                    </div>
                                ) : isProduct ? (
                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                                            제품 사진 * <span className="font-normal text-gray-400">(앞면·옆면·위/아래 3장 필수, 추가로 최대 {MAX_IMAGES_PRODUCT - PRODUCT_SLOTS.length}장 더)</span>
                                        </label>
                                        <p className="text-[11px] text-gray-500 mb-2">실물과 다르면 안 되니 정확히 이 각도로 찍어주세요.</p>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            {PRODUCT_SLOTS.map((label, i) => {
                                                const inputId = `product-slot-${i}`;
                                                return (
                                                    <div key={i} className="relative">
                                                        {imagePreviews[i] ? (
                                                            <div className="relative">
                                                                <img src={imagePreviews[i]} alt={label} className="w-full aspect-square object-cover rounded-lg border border-gray-100" />
                                                                <button onClick={() => removeImage(i)} type="button"
                                                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs leading-none flex items-center justify-center">×</button>
                                                            </div>
                                                        ) : (
                                                            <label htmlFor={inputId}
                                                                   className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-pink-200 rounded-lg cursor-pointer hover:bg-pink-50/50 transition-colors text-center px-1">
                                                                <span className="text-gray-400 text-[11px]">📷 {label} *</span>
                                                            </label>
                                                        )}
                                                        <input id={inputId} type="file" accept="image/*" className="hidden" onChange={onPickProductSlot(i)} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {imagePreviews.length > PRODUCT_SLOTS.length && (
                                            <div className="flex gap-2 mb-2 flex-wrap">
                                                {imagePreviews.slice(PRODUCT_SLOTS.length).map((src, j) => {
                                                    const i = j + PRODUCT_SLOTS.length;
                                                    return (
                                                        <div key={i} className="relative">
                                                            <img src={src} alt={`추가 ${j + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-100" />
                                                            <button onClick={() => removeImage(i)} type="button"
                                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs leading-none flex items-center justify-center">×</button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {imageFiles.length < MAX_IMAGES_PRODUCT && (
                                            <div onClick={() => fileRef.current?.click()}
                                                 className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors bg-white">
                                                <div className="text-gray-400 text-xs py-2">➕ 다른 각도 사진 추가(선택, {imageFiles.length}/{MAX_IMAGES_PRODUCT})</div>
                                            </div>
                                        )}
                                        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                                            얼굴/제품 이미지 * <span className="font-normal text-gray-400">(최대 {MAX_IMAGES}장 — 실제 사진을 참고해 대본에 맞게 활용해요)</span>
                                        </label>
                                        {imagePreviews.length > 0 && (
                                            <div className="flex gap-2 mb-2 flex-wrap">
                                                {imagePreviews.map((src, i) => (
                                                    <div key={i} className="relative">
                                                        <img src={src} alt={`업로드 ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-100" />
                                                        <button onClick={() => removeImage(i)} type="button"
                                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs leading-none flex items-center justify-center">×</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {imageFiles.length < MAX_IMAGES && (
                                            <div onClick={() => fileRef.current?.click()}
                                                 className="border-2 border-dashed border-pink-200 rounded-xl p-4 text-center cursor-pointer hover:bg-pink-50/50 transition-colors bg-white">
                                                <div className="text-gray-400 text-xs py-4">📷 눌러서 이미지를 올려주세요 ({imageFiles.length}/{MAX_IMAGES})</div>
                                            </div>
                                        )}
                                        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
                                    </div>
                                )}
                                {(noImage || optionalImage) ? (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-semibold text-gray-700">
                                            {TOPIC_LABEL[category]?.[0] || '다루고 싶은 주제'} *
                                        </p>
                                        <textarea value={form.topic} onChange={set('topic')} rows={2}
                                                  placeholder={TOPIC_LABEL[category]?.[1] || ''}
                                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y bg-white" />
                                        {category === 'birthday' && (
                                            // 이 카테고리만 받는 사람이 실재하는 개인이라, 무엇을 적어야
                                            // 좋은 결과가 나오는지 한 줄 안내한다(빈 입력으로 어색한
                                            // 축하문이 나오는 걸 줄인다).
                                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                                💡 받는 분과의 관계(엄마·친구 등)와 전하고 싶은 한마디를 함께 적으면 더 따뜻하게 나와요.
                                                나이·외모 이야기는 넣지 않습니다.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-semibold text-gray-700">업종/상품명 *</p>
                                            <input value={form.biz} onChange={set('biz')} placeholder="예: 동네 베이커리, 수제 핸드크림"
                                                   className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-semibold text-gray-700">핵심 장점 *</p>
                                            <textarea value={form.strengths} onChange={set('strengths')} rows={2}
                                                      placeholder="예: 매일 새벽 직접 굽는 빵, 무방부제, 당일배송"
                                                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y bg-white" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-semibold text-gray-700">타겟 고객 *</p>
                                            <input value={form.target} onChange={set('target')} placeholder="예: 30대 자취 직장인"
                                                   className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* 섹션: 분위기·언어 */}
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-3">
                                <p className="text-xs font-bold text-gray-800">🎨 분위기·언어</p>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-gray-700">원하는 톤/무드</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {MOOD_CHIPS.map(m => (
                                            <button key={m} type="button"
                                                    onClick={() => setForm(f => ({ ...f, mood: f.mood === m ? '' : m }))}
                                                    className="text-xs px-2.5 py-1 rounded-full border transition-colors bg-white"
                                                    style={form.mood === m ? { backgroundColor: PINK, color: '#fff', borderColor: PINK } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-gray-700">내레이션·자막 언어</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {LANGUAGES.map(l => (
                                            <button key={l.code} type="button"
                                                    onClick={() => setForm(f => ({ ...f, language: l.code }))}
                                                    className="text-xs px-2.5 py-1 rounded-full border transition-colors bg-white"
                                                    style={form.language === l.code ? { backgroundColor: PINK, color: '#fff', borderColor: PINK } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                                                {l.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 섹션: 참고 자료(선택) — ★생일축하는 제외(2026-08-02 3차, 사장 지적).
                                "참고하고 싶은 쇼츠"·QR은 홍보·정보 목적 카테고리에만 맞는 개념이라,
                                특정 개인에게 보내는 축하 영상에 그대로 두면 성격이 안 맞았다
                                (마케팅 QR을 강제하지 않는다는 기존 설계와도 어긋남). */}
                            {category !== 'birthday' && (
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-3">
                                <p className="text-xs font-bold text-gray-800">🔗 참고 자료(선택)</p>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-gray-700">참고하고 싶은 쇼츠</p>
                                    <input value={form.referenceUrl1} onChange={set('referenceUrl1')} placeholder="참고 쇼츠 URL 1"
                                           className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
                                    <input value={form.referenceUrl2} onChange={set('referenceUrl2')} placeholder="참고 쇼츠 URL 2"
                                           className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-gray-700">QR로 연결할 주소</p>
                                    <input value={form.qrUrl} onChange={set('qrUrl')} placeholder="예: smartstore.naver.com/내상점"
                                           className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
                                    <p className="text-[11px] text-gray-400">
                                        <b>https:// 는 안 넣어도 돼요</b> — 영상 마지막 2~3초에 QR코드로
                                        보여드려요. 비워두면 QR 없이 완성돼요.
                                    </p>
                                </div>
                            </div>
                            )}

                            {error && <p className="text-xs text-red-500">{error}</p>}
                            <button onClick={submit} disabled={submitting}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
                                    style={{ backgroundColor: PINK }}>
                                {submitting ? '신청 중...' : '💎 100P — 시나리오 5개 받기'}
                            </button>
                        </>
                    )}

                    {/* [waiting] 시나리오 생성 대기 */}
                    {step === 'waiting' && (() => {
                        const steps = waitingSteps(category);
                        const curIdx = steps.findIndex(s => s.key === row?.progressStep);
                        const headline = category === 'birthday'
                            ? '아린이 축하 메시지를 담아 시나리오 5개를 준비하고 있어요'
                            : '아린이 업종을 분석하고 시나리오 5개를 준비하고 있어요';
                        return (
                            <div className="py-6 space-y-4">
                                <p className="text-sm text-gray-700 text-center font-semibold">{headline}</p>
                                <div className="space-y-2.5 max-w-xs mx-auto">
                                    {steps.map((s, i) => {
                                        const isDone = curIdx >= 0 && i < curIdx;
                                        const isCurrent = i === curIdx;
                                        return (
                                            <div key={s.key} className="flex items-center gap-2">
                                                {isDone ? (
                                                    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-white text-[10px] rounded-full" style={{ backgroundColor: PINK }}>✓</span>
                                                ) : isCurrent ? (
                                                    <span className="w-4 h-4 shrink-0 animate-spin border-2 border-t-transparent rounded-full" style={{ borderColor: PINK, borderTopColor: 'transparent' }} />
                                                ) : (
                                                    <span className="w-4 h-4 shrink-0" />
                                                )}
                                                <span className={`text-xs ${isCurrent ? 'text-gray-800 font-semibold' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>
                                                    {s.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-400 text-center">보통 30초~1분 정도 걸려요.</p>
                                <p className="text-xs text-gray-400 text-center">창을 닫아도 계속 만들어지고 있어요. 나중에 "내가 만든 쇼츠"에서 확인하세요.</p>
                            </div>
                        );
                    })()}

                    {/* [scenarios] 시나리오 5개 중 선택 */}
                    {step === 'scenarios' && row && (
                        <>
                            <p className="text-sm font-semibold text-gray-800">마음에 드는 시나리오를 골라주세요</p>
                            <div className="space-y-2">
                                {row.scenarios.map((s, i) => (
                                    <button key={i} onClick={() => selectScenario(i)} disabled={submitting}
                                            className="w-full text-left rounded-xl border border-gray-200 hover:border-pink-300 p-3 space-y-1 transition-colors disabled:opacity-60">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#FDE6F0', color: PINK }}>{s.angle}</span>
                                            <span className="text-sm font-semibold text-gray-800">{s.title}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 italic">"{s.hook}"</p>
                                        <p className="text-xs text-gray-400">{s.summary}</p>
                                    </button>
                                ))}
                            </div>
                            {error && <p className="text-xs text-red-500">{error}</p>}
                            <p className="text-[11px] text-gray-400 text-center">선택 후 요금제·스타일을 고르면 5초 미리보기를 먼저 보여드려요(무료).</p>
                        </>
                    )}

                    {/* [plan] 요금제(스탠다드/프리미엄)+스타일 확정 → 미리보기 요청(2026-08-02 3차 신설).
                        ★사진 없는 카테고리(insight/wellness/meme)는 재해석할 실사진이 없으므로
                        스타일 선택 UI 자체를 생략한다. */}
                    {step === 'plan' && (
                        <>
                            <p className="text-lg font-semibold text-gray-800" style={{ fontFamily: "'Cormorant Garamond', serif" }}>어떤 등급으로 만들까요?</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => { setPlan('standard'); if (planRestyleKeys.length > 1) setPlanRestyleKeys(planRestyleKeys.slice(0, 1)); }}
                                        className="text-left rounded-xl border p-3 transition-colors"
                                        style={plan === 'standard' ? { backgroundColor: '#FDE6F0', borderColor: PINK } : { borderColor: '#e5e7eb' }}>
                                    <p className="text-sm font-bold text-gray-800">스탠다드</p>
                                    <p className="text-xs text-gray-500 mt-0.5">3,000P</p>
                                    <p className="text-[11px] text-gray-400 mt-1">완성본 1개 · 나레이션+배경음악</p>
                                </button>
                                <button type="button" onClick={() => setPlan('premium')}
                                        className="text-left rounded-xl border p-3 transition-colors"
                                        style={plan === 'premium' ? { backgroundColor: '#FDE6F0', borderColor: PINK } : { borderColor: '#e5e7eb' }}>
                                    <p className="text-sm font-bold text-gray-800">🌟 프리미엄</p>
                                    <p className="text-xs text-gray-500 mt-0.5">5,000P</p>
                                    <p className="text-[11px] text-gray-400 mt-1">화풍 다른 완성본 2개 중 선택 · 검증 강화</p>
                                </button>
                            </div>

                            {!NO_IMAGE_CATEGORIES.includes(category) && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-gray-700">
                                        스타일 선택 {plan === 'premium' ? '(정확히 2개 선택)' : '(선택, 최대 1개 — 안 고르면 AI가 알아서 구성해요)'}
                                    </p>
                                    {planOutfitStyles === null ? (
                                        <StyleLoader onLoaded={setPlanOutfitStyles} />
                                    ) : planOutfitStyles.length === 0 ? (
                                        <p className="text-[11px] text-gray-400">스타일 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
                                    ) : (
                                        <div className="flex gap-1.5 flex-wrap">
                                            {planOutfitStyles.map(s => {
                                                const picked = planRestyleKeys.includes(s.styleKey);
                                                return (
                                                    <button key={s.id} type="button" onClick={() => {
                                                        setPlanRestyleKeys(prev => {
                                                            if (prev.includes(s.styleKey)) return prev.filter(k => k !== s.styleKey);
                                                            const max = plan === 'premium' ? 2 : 1;
                                                            const next = [...prev, s.styleKey];
                                                            return next.length > max ? next.slice(next.length - max) : next;
                                                        });
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${picked ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-pink-50/50'}`}>
                                                        {s.emoji ? `${s.emoji} ` : ''}{s.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            {error && <p className="text-xs text-red-500">{error}</p>}
                            <button onClick={confirmPlanAndPreview} disabled={submitting}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
                                    style={{ background: `linear-gradient(135deg, ${PINK}, #F4A4C6)` }}>
                                {submitting ? '처리 중...' : '✨ 5초 미리보기 보기'}
                            </button>
                        </>
                    )}

                    {/* [previewing] 5초 미리보기 생성 대기(무료) */}
                    {step === 'previewing' && (
                        <div className="py-8 space-y-3 text-center">
                            <span className="inline-block w-6 h-6 animate-spin border-2 border-t-transparent rounded-full" style={{ borderColor: PINK, borderTopColor: 'transparent' }} />
                            <p className="text-sm text-gray-700 font-semibold">5초 미리보기를 만들고 있어요</p>
                            <p className="text-xs text-gray-400">보통 10~20초 정도 걸려요.</p>
                        </div>
                    )}

                    {/* [preview] 미리보기 확인 → 결제 확정 */}
                    {step === 'preview' && row && (
                        <>
                            <p className="text-sm font-semibold text-gray-800 text-center">미리보기예요. 마음에 드시나요?</p>
                            {row.hasPreviewVideo ? (
                                <video src={shortsMakerApi.previewVideoUrl(row.id)} controls autoPlay muted loop
                                       className="w-full rounded-xl bg-black mx-auto" style={{ aspectRatio: '9/16', maxHeight: 360 }} />
                            ) : (
                                <p className="text-xs text-gray-400 text-center py-6">미리보기 생성에 실패했어요 — 결제 후 실제 완성본으로 바로 확인하실 수 있어요.</p>
                            )}
                            {error && <p className="text-xs text-red-500">{error}</p>}
                            <button onClick={confirmProduce} disabled={submitting}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
                                    style={{ background: `linear-gradient(135deg, ${PINK}, #F4A4C6)` }}>
                                {submitting ? '처리 중...' : `💎 ${plan === 'premium' ? '5,000P' : '3,000P'} — 전체 영상 만들기`}
                            </button>
                            <button onClick={() => setStep('scenarios')} className="w-full text-center text-xs text-gray-400 underline">
                                다른 시나리오 다시 고르기
                            </button>
                        </>
                    )}

                    {/* [producing] 영상 제작 대기 — 실제 서버 진행 단계(row.progressStep)를
                        체크리스트로 표시(사장 피드백 2026-07-23: 스피너만 돌아 답답함). */}
                    {step === 'producing' && (() => {
                        const curIdx = PROGRESS_STEPS.findIndex(s => s.key === row?.progressStep);
                        return (
                            <div className="py-6 space-y-4">
                                <p className="text-sm text-gray-700 text-center font-semibold">선택하신 시나리오로 영상을 만들고 있어요</p>
                                <div className="space-y-2.5 max-w-xs mx-auto">
                                    {PROGRESS_STEPS.map((s, i) => {
                                        const isDone = curIdx >= 0 && i < curIdx;
                                        const isCurrent = i === curIdx;
                                        const showCount = isCurrent && s.key === 'images' && row?.progressTotal;
                                        return (
                                            <div key={s.key} className="flex items-center gap-2">
                                                {isDone ? (
                                                    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-white text-[10px] rounded-full" style={{ backgroundColor: PINK }}>✓</span>
                                                ) : isCurrent ? (
                                                    <span className="w-4 h-4 shrink-0 animate-spin border-2 border-t-transparent rounded-full" style={{ borderColor: PINK, borderTopColor: 'transparent' }} />
                                                ) : (
                                                    <span className="w-4 h-4 shrink-0" />
                                                )}
                                                <span className={`text-xs ${isCurrent ? 'text-gray-800 font-semibold' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>
                                                    {s.label}{showCount ? ` (${row!.progressDone}/${row!.progressTotal})` : ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-400 text-center">사진을 장면마다 새로 그려서 보통 3~5분 정도 걸려요.</p>
                                <p className="text-xs text-gray-400 text-center">창을 닫아도 계속 만들어지고 있어요. 나중에 "내가 만든 쇼츠"에서 확인하세요.</p>
                            </div>
                        );
                    })()}

                    {/* [result-완성] ★프리미엄은 hasVideo2가 true면 2버전 비교 UI(2026-08-02 3차) */}
                    {step === 'result' && done && row && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-800 text-center">🎉 쇼츠가 완성됐어요!</p>
                            {row.plan === 'premium' && row.hasVideo2 ? (
                                <>
                                    <p className="text-xs text-gray-500 text-center">화풍이 다른 2개 중 마음에 드는 걸 골라주세요</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([0, 1] as const).map(slot => (
                                            <button key={slot} type="button" onClick={() => setSelectedFinalSlot(slot)}
                                                    className="rounded-xl border-2 p-1.5 transition-colors"
                                                    style={selectedFinalSlot === slot ? { borderColor: PINK } : { borderColor: '#e5e7eb' }}>
                                                <video src={shortsMakerApi.videoUrl(row.id, { slot })} controls
                                                       className="w-full rounded-lg bg-black" style={{ aspectRatio: '9/16', maxHeight: 320 }} />
                                                <p className="text-xs font-semibold mt-1 text-center" style={selectedFinalSlot === slot ? { color: PINK } : { color: '#9ca3af' }}>
                                                    {slot === 0 ? '버전 A' : '버전 B'}{row.selectedVideoSlot === slot ? ' ✓ 선택됨' : ''}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={async () => {
                                                try { await shortsMakerApi.selectFinal(row.id, selectedFinalSlot); setRow({ ...row, selectedVideoSlot: selectedFinalSlot }); }
                                                catch (e: any) { setError(e.message || '선택에 실패했어요.'); }
                                            }}
                                            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm"
                                            style={{ background: `linear-gradient(135deg, ${PINK}, #F4A4C6)` }}>
                                        이 버전으로 최종 선택
                                    </button>
                                    {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                                </>
                            ) : (
                                <video src={shortsMakerApi.videoUrl(row.id)} controls className="w-full rounded-xl bg-black" style={{ aspectRatio: '9/16', maxHeight: 480 }} />
                            )}
                            <div className="flex items-center justify-center gap-4 text-xs">
                                <a href={shortsMakerApi.videoUrl(row.id, { slot: row.plan === 'premium' ? selectedFinalSlot : undefined, download: true })} download className="underline font-semibold" style={{ color: PINK }}>📦 다운로드</a>
                                <button onClick={reset} className="underline text-gray-500">다른 쇼츠 만들기</button>
                            </div>
                        </div>
                    )}

                    {/* [result-실패] */}
                    {step === 'result' && !done && (
                        <div className="py-6 text-center space-y-3">
                            <p className="text-sm text-gray-700">{row?.errorMessage || '생성에 실패했어요.'}</p>
                            <p className="text-xs text-gray-400">차감된 포인트는 자동 환불됐어요.</p>
                            <button onClick={reset} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600">다시 시도</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
    );
};
