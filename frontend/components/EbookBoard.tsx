import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, BookOpen, Loader, Trash2, Plus, ChevronLeft, ChevronUp, ChevronDown, Save, Pencil, Search, Check, ExternalLink, AlertCircle, FileText, ImagePlus, Download, RefreshCw } from 'lucide-react';
import { ebookApi, EbookProject, EbookTocChapter, EbookImageSlot } from '../services/apiService';
import { HelpButton } from './HelpButton';

// 퍼플/크림 톤 (앱 통일 — project_premium_ui_theme)
const T = {
    bg: '#FBF8F3', card: '#FFFFFF', border: '#E8DDD0', surface: '#F5F0E8',
    ink: '#2D2438', inkSoft: '#6B5F56', inkMute: '#9089A1',
    accent: '#8E6FB7', accentSoft: 'rgba(142,111,183,0.10)', accentBorder: 'rgba(142,111,183,0.4)',
};

// 자료수집 단계 칩 (접수→수집→완료)
// 단계 칩 (접수 → 수집 → 완료). state: 'done'(지난단계) | 'current'(진행중) | 'todo'(예정)
const Stage: React.FC<{ label: string; state: 'done' | 'current' | 'todo' }> = ({ label, state }) => {
    const isDone = state === 'done';
    const isCur = state === 'current';
    return (
        <span className="inline-flex items-center gap-1 rounded-full" style={{
            fontSize: 12, fontWeight: isCur ? 800 : isDone ? 700 : 500,
            padding: '4px 10px',
            color: isCur ? '#fff' : isDone ? '#fff' : T.inkMute,
            background: isCur ? T.accent : isDone ? '#7BAE7F' : '#EFE9F2',
            border: `1px solid ${isCur ? T.accent : isDone ? '#7BAE7F' : T.border}`,
            boxShadow: isCur ? '0 2px 8px -2px rgba(142,111,183,0.6)' : 'none',
        }}>
            {isCur ? <Loader size={12} className="animate-spin" /> : isDone ? <Check size={12} /> : null}
            {label}
        </span>
    );
};

// 진행 탭 정의 (1~6 순서대로 진행)
// 탭 콘텐츠 ID는 기존(1책정보 / 4자료 / 5초안) 유지. 2·3은 1로 통합, 6완성본은 제거.
type EbookTab = 1 | 2 | 3 | 4 | 5 | 6;
const TABS: { id: EbookTab; label: string }[] = [
    { id: 1, label: '제목·목차' },
    { id: 4, label: '자료 수집' },
    { id: 5, label: '초안 만들기' },
];

interface Props { onClose: () => void; }

export const EbookBoard: React.FC<Props> = ({ onClose }) => {
    const [list, setList] = useState<EbookProject[]>([]);
    const [selected, setSelected] = useState<EbookProject | null>(null);
    const [topic, setTopic] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false); // 초기엔 목록 화면(주식분석 패턴). 새 전자책 클릭 시 폼
    // 포인트 차감 확인 모달(docx 만들기/그림 이미지 일괄생성 공용) — brower confirm() 대신 디자인 모달로.
    // 브라우저 기본 confirm() 대신 쓰는 공용 확인 모달. icon 생략 시 기존처럼 ImagePlus(포인트 차감용 기본값).
    const [pointConfirm, setPointConfirm] = useState<{ title: string; lines: string[]; onConfirm: () => void; icon?: React.ReactNode } | null>(null);
    // 진행 탭: 1제목 2목차 3수정 4자료(배치) 5초안PDF 6완성본 (1~6 순서 진행)
    const [activeTab, setActiveTab] = useState<EbookTab>(1);
    // 목차 편집 모드 (탭3)
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editChapters, setEditChapters] = useState<EbookTocChapter[]>([]);
    const [savingToc, setSavingToc] = useState(false);
    const [regenToc, setRegenToc] = useState(false);
    // 탭1: 책 주제(topic, 사용자가 직접 고치는 입력칸) + 저자 편집.
    // ★2026-07-26 사장 지시로 역할 재편: 예전엔 이 입력칸이 title을 담았으나, 지금은
    // "책 주제"로 이름을 바꾸고 topic을 담는다 — 목차·표지는 title을 참고하고, title은
    // AI가 만들거나(최초 생성 시) 표지 선택 시 사용자가 확인 후 확정한다(titleEditDraft).
    const [titleDraft, setTitleDraft] = useState(''); // topic 편집용(이름은 유지, 담는 값만 변경)
    const [authorDraft, setAuthorDraft] = useState('');
    const [savingTitle, setSavingTitle] = useState(false);
    // "책 제목"(title) 표시·수정 영역 — 평소엔 읽기전용 표시, 표지를 고르면 추출된 카피로
    // draft가 채워지고 사용자가 확인·수정한 뒤 저장해야 확정된다("틀릴 염려가 없게").
    const [titleEditDraft, setTitleEditDraft] = useState('');
    const [editingBookTitle, setEditingBookTitle] = useState(false);
    const [savingBookTitle, setSavingBookTitle] = useState(false);
    // 탭5 초안: 표지·문서(본문은 야간 배치에서 생성 — 즉시생성 제거). PDF 제거됨(docx만).
    const [coverMaking, setCoverMaking] = useState(false);
    // AI 표지 후보 2안(제미나이·GPT). 고르면 비우고 selected.coverUrl로 확정.
    const [coverCandidates, setCoverCandidates] = useState<{ engine: 'gemini' | 'gpt'; url: string }[]>([]);
    const [coverSaving, setCoverSaving] = useState(false);
    const [zoomImage, setZoomImage] = useState<string | null>(null); // 표지 이미지 확대보기(라이트박스)
    const [coverSaveToast, setCoverSaveToast] = useState('');
    const [docxMaking, setDocxMaking] = useState(false);
    const [docxUrl, setDocxUrl] = useState<string | null>(null); // 생성된 docx URL. selected.docxUrl로 초기화돼 재방문 시 다운로드 버튼 유지.
    // 이미지 프롬프트 뽑기
    const [imgPromptLoading, setImgPromptLoading] = useState(false);
    const [imgPrompts, setImgPrompts] = useState<{ no: number; chapterTitle: string; caption: string; prompt: string }[] | null>(null);
    const [copiedNo, setCopiedNo] = useState<number | null>(null);
    // 그림 이미지 일괄 생성: 큐 등록 후 서버 백그라운드 타이머가 처리, 프론트는 폴링으로 진행률만 표시.
    const [imgGenBusy, setImgGenBusy] = useState(false); // 큐 처리 중(폴링 진행 중)
    const [imgGenProgress, setImgGenProgress] = useState({ done: 0, total: 0 });
    const [imgGenResults, setImgGenResults] = useState<Record<string, string>>({}); // caption → imageUrl(완료분)
    const [imgGenFailed, setImgGenFailed] = useState<Set<string>>(new Set()); // caption(실패·환불됨, 재시도 가능)
    const [imgGenError, setImgGenError] = useState<string | null>(null);
    const imgGenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const coverPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // 탭4 예약 슬롯 현황
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [slots, setSlots] = useState<import('../services/apiService').EbookSlot[]>([]);
    // 자료수집: 현재 수집 중인 챕터 번호, 펼쳐진 챕터 번호
    const [collectingNo, setCollectingNo] = useState<number | null>(null);
    const [expandedNo, setExpandedNo] = useState<number | null>(null);
    // 본문 펼침(야간 생성 결과 보기 전용)
    const [contentOpenNo, setContentOpenNo] = useState<number | null>(null);

    // 챕터별 자료수집: 호출 → 접수→수집→완료. selected.chapters를 즉시 갱신해 단계 표시.
    const collectSources = async (no: number) => {
        if (!selected || collectingNo !== null) return;
        setCollectingNo(no);
        setError(null);
        // 낙관적 상태: 해당 챕터를 collecting으로
        const patch = (status: EbookTocChapter['sourceStatus'], sources?: EbookTocChapter['sources']) =>
            setSelected(prev => prev ? {
                ...prev,
                chapters: (prev.chapters ?? []).map(c =>
                    c.no === no ? { ...c, sourceStatus: status, ...(sources ? { sources } : {}) } : c),
            } : prev);
        patch('collecting');
        try {
            const res = await ebookApi.collectSources(selected.id, no);
            patch('done', res.sources);
            setExpandedNo(no); // 완료되면 자동으로 펼쳐 보여줌
        } catch (e: any) {
            patch('failed');
            setError(e?.message || '자료 수집에 실패했어요. 잠시 후 다시 시도해주세요.');
        } finally {
            setCollectingNo(null);
        }
    };

    // ※ 즉시 본문생성/다시쓰기 제거됨 — 본문은 새벽 예약 배치(야간 cron)에서만 생성한다.
    //   사용자는 자료수집 + 시간대 예약까지만 하고, 다음날 결과(.docx)를 받는다(재방문 유도).

    const patchChapter = (no: number, patch: Partial<EbookTocChapter>) =>
        setSelected(prev => prev ? { ...prev, chapters: (prev.chapters ?? []).map(c => c.no === no ? { ...c, ...patch } : c) } : prev);

    const startEdit = () => {
        if (!selected) return;
        setEditTitle(selected.title || '');
        setEditChapters((selected.chapters ?? []).map(c => ({ ...c })));
        setEditing(true);
    };
    const cancelEdit = () => setEditing(false);
    const setCh = (i: number, key: 'title' | 'summary', v: string) =>
        setEditChapters(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: v } : c));
    const addCh = () => setEditChapters(prev => [...prev, { no: prev.length + 1, title: '', summary: '' }]);
    const delCh = (i: number) => setEditChapters(prev => prev.filter((_, idx) => idx !== i));
    const moveCh = (i: number, dir: -1 | 1) => setEditChapters(prev => {
        const j = i + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
    const saveToc = async () => {
        if (!selected || savingToc) return;
        const clean = editChapters.filter(c => c.title.trim());
        if (!clean.length) { setError('챕터가 최소 1개는 있어야 해요.'); return; }
        setSavingToc(true); setError(null);
        try {
            // 목차(챕터) 편집은 책 제목을 건드리지 않는다 — title은 현재 값 그대로 넘긴다.
            const updated = await ebookApi.updateToc(selected.id, selected.title || selected.topic, clean, authorDraft.trim() || null);
            setSelected(updated);
            setEditing(false);
            loadList();
        } catch (e: any) { setError(e.message || '목차 저장 실패'); }
        finally { setSavingToc(false); }
    };

    // 현재(수정된) 제목을 보고 목차를 새로 생성 — 제목을 먼저 고친 뒤 그 제목에 맞는
    // 목차를 다시 뽑고 싶을 때 사용. 제목은 그대로 두고 chapters만 교체된다.
    const runRegenerateToc = async () => {
        if (!selected || regenToc) return;
        setRegenToc(true); setError(null);
        try {
            const updated = await ebookApi.regenerateToc(selected.id);
            setSelected(updated);
            setDocxUrl(null); // 목차가 바뀌었으니 기존 문서 무효
            loadList();
        } catch (e: any) { setError(e.message || '목차 재생성 실패'); }
        finally { setRegenToc(false); }
    };
    // 브라우저 기본 confirm() 대신 디자인 모달(pointConfirm 재사용 — 포인트 차감 없어도 확인용으로 씀)로.
    const regenerateToc = () => {
        if (!selected || regenToc) return;
        setPointConfirm({
            title: '목차 다시 만들기',
            lines: ['현재 제목을 보고 목차를 새로 만들까요?', '지금 목차는 사라져요.'],
            onConfirm: runRegenerateToc,
            icon: <RefreshCw size={16} style={{ color: T.accent }} />,
        });
    };

    // 탭1: 책 판형 저장(신국판/A5/국배판)
    const savePageSize = async (pageSize: string) => {
        if (!selected) return;
        setSelected(prev => prev ? { ...prev, pageSize } : prev); // 낙관적
        try { await ebookApi.setPageSize(selected.id, pageSize); setDocxUrl(null); }
        catch (e: any) { setError(e?.message || '판형 저장 실패'); }
    };

    // 탭1: 주제·저자 저장 (chapters·title은 그대로 보내 보존 — 이 칸은 이제 topic 전용)
    const saveTitle = async () => {
        if (!selected || savingTitle) return;
        const t = titleDraft.trim();
        if (!t) { setError('주제를 입력해 주세요.'); return; }
        setSavingTitle(true); setError(null);
        try {
            const updated = await ebookApi.updateToc(selected.id, selected.title || t, selected.chapters ?? [], authorDraft.trim() || null, t);
            setSelected(updated);
            loadList();
        } catch (e: any) { setError(e?.message || '저장 실패'); }
        finally { setSavingTitle(false); }
    };

    // "책 제목" 확인·수정 저장 — 표지 선택으로 채워진 draft, 또는 사용자가 직접 고친 값을 확정.
    const saveBookTitle = async () => {
        if (!selected || savingBookTitle) return;
        const t = titleEditDraft.trim();
        if (!t) { setError('책 제목을 입력해 주세요.'); return; }
        setSavingBookTitle(true); setError(null);
        try {
            const updated = await ebookApi.updateToc(selected.id, t, selected.chapters ?? [], authorDraft.trim() || null);
            setSelected(updated);
            setEditingBookTitle(false);
            loadList();
        } catch (e: any) { setError(e?.message || '제목 저장 실패'); }
        finally { setSavingBookTitle(false); }
    };

    // ※ 즉시 본문 일괄생성/다시쓰기 제거 — 본문은 야간 예약 배치에서만 생성한다.

    // 탭3: 표지 이미지 직접 업로드 (AI 생성 폐기 — 사용자가 만든 표지를 올림)
    const uploadCover = async (file: File) => {
        if (!selected || coverMaking) return;
        if (!file.type.startsWith('image/')) { setError('이미지 파일만 올릴 수 있어요.'); return; }
        if (file.size > 15 * 1024 * 1024) { setError('이미지가 너무 커요(최대 15MB).'); return; }
        setCoverMaking(true); setError(null);
        try {
            const url = await ebookApi.uploadCover(selected.id, file);
            setSelected(prev => prev ? { ...prev, coverUrl: url } : prev);
            setDocxUrl(null); // 표지 바뀌면 이전 문서 무효
        } catch (e: any) { setError(e?.message || '표지 업로드 실패'); }
        finally { setCoverMaking(false); }
    };
    // 표지 큐 폴링 — GPT high가 ~95초 걸려 동기 응답은 Vercel 타임아웃(502)에 걸리므로
    // 그림 자리와 같은 방식으로 등록만 하고 여기서 진행 상황을 5초마다 확인한다.
    const pollCoverQueue = useCallback((projectId: number) => {
        if (coverPollRef.current) clearInterval(coverPollRef.current);
        coverPollRef.current = setInterval(async () => {
            try {
                const st = await ebookApi.coverQueueStatus(projectId);
                setCoverCandidates(st.candidates);
                if (st.counts.queued === 0) {
                    if (coverPollRef.current) clearInterval(coverPollRef.current);
                    coverPollRef.current = null;
                    setCoverMaking(false);
                    if (st.candidates.length === 0) setError('표지 생성에 실패했어요. 포인트는 환불됐어요.');
                }
            } catch { /* 일시적 네트워크 오류 — 다음 폴링에서 재시도 */ }
        }, 5000);
    }, []);
    useEffect(() => () => { if (coverPollRef.current) clearInterval(coverPollRef.current); }, []);

    // AI로 표지 생성(제목+목차 참고) — 견적 확인 모달 거친 뒤 실행. 등록만 즉시 응답받고
    // 실제 생성은 서버 백그라운드 큐가 처리 — 창을 닫아도 서버는 계속 진행한다.
    const runGenerateAICover = async () => {
        if (!selected) return;
        setCoverMaking(true); setError(null); setCoverCandidates([]);
        try {
            await ebookApi.generateCover(selected.id);
            pollCoverQueue(selected.id);
        } catch (e: any) { setError(e?.message || 'AI 표지 생성 실패'); setCoverMaking(false); }
    };
    const generateAICover = async () => {
        if (!selected || coverMaking) return;
        setError(null);
        try {
            const est = await ebookApi.coverCost(selected.id);
            setPointConfirm({
                title: 'AI 표지 생성 포인트 차감',
                lines: [`제목·목차를 참고해 서로 다른 화풍의 표지 2장을 만들어요.`, `마음에 드는 쪽을 고르시면 됩니다.`, `${est.cost.toLocaleString()}P가 차감됩니다.`],
                onConfirm: runGenerateAICover,
            });
        } catch (e: any) { setError(e?.message || '견적 계산 실패'); }
    };
    // 후보 중 하나를 표지로 확정
    // AI 표지 후보를 고르면 이미지 속 카피를 비전으로 읽어와 "책 제목" draft를 채운다.
    // ★자동 확정하지 않는다(사장 지시: "추출하고 제목 수정모드를 두면... 사용자가 확인후
    // 수정할수 있게, 그럼 틀릴 염려가 없자나") — 편집 모드를 열어 사용자가 직접 저장해야 확정.
    const pickCoverCandidate = async (url: string) => {
        if (!selected || coverMaking) return;
        setCoverMaking(true); setError(null);
        try {
            const res = await ebookApi.saveCoverUrl(selected.id, url, true);
            setSelected(prev => prev ? { ...prev, coverUrl: url } : prev);
            setCoverCandidates([]);
            setDocxUrl(null); // 표지 바뀌면 이전 문서 무효
            if (res.extractedTitle) {
                setTitleEditDraft(res.extractedTitle);
                setEditingBookTitle(true);
            }
        } catch (e: any) { setError(e?.message || '표지 저장 실패'); }
        finally { setCoverMaking(false); }
    };
    const removeCover = async () => {
        if (!selected || coverMaking) return;
        setCoverMaking(true); setError(null);
        try {
            await ebookApi.saveCoverUrl(selected.id, null);
            setSelected(prev => prev ? { ...prev, coverUrl: null } : prev);
            setDocxUrl(null);
        } catch (e: any) { setError(e?.message || '표지 제거 실패'); }
        finally { setCoverMaking(false); }
    };

    // GCS 직접 fetch는 CORS로 막혀서(버킷 설정 권한 없음) 같은 출처 중계 라우트로 변환(hair.ts와 동일 패턴)
    const proxyCoverUrl = (url: string) => {
        const m = url.match(/\/ai-mp-media\/(ebook\/[^?#]+)/);
        return m ? `/api/ebook/cover-image?path=${encodeURIComponent(m[1])}` : url;
    };

    // 저장: 표지 이미지를 내 기기(갤러리)로. iOS=공유시트('이미지 저장'→사진앱), 그 외=다운로드(HairStyleBoard와 동일 패턴).
    // ★확정 표지뿐 아니라 후보 이미지(선택 전)도 저장할 수 있게 URL을 인자로 받는 범용 형태로 일반화.
    const saveCoverImage = async (url: string) => {
        if (coverSaving) return;
        setCoverSaving(true);
        try {
            const res = await fetch(proxyCoverUrl(url));
            if (!res.ok) throw new Error('fetch fail');
            const blob = await res.blob();
            const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            const file = new File([blob], `ebook-cover-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
            const ua = navigator.userAgent;
            const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
            if (isIOS && navigator.canShare?.({ files: [file] }) && navigator.share) {
                try { await navigator.share({ files: [file] }); } catch { /* 사용자가 시트 닫음 — 폴백 불필요 */ }
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 4000);
                setCoverSaveToast('표지를 저장했어요 — 갤러리(다운로드)에서 확인하세요 📥');
                setTimeout(() => setCoverSaveToast(''), 3000);
            }
        } catch {
            window.open(url, '_blank', 'noopener');
        } finally {
            setCoverSaving(false);
        }
    };
    const handleSaveCover = () => { if (selected?.coverUrl) saveCoverImage(selected.coverUrl); };

    // 탭3: 구글 독스용 .docx 생성(북크크 양식). 서버가 docxUrl도 저장 → 재방문 시 다운로드 버튼 유지.
    // 문서 생성 실행(확인 모달에서 '확인' 누른 뒤 호출)
    const runMakeDocx = async () => {
        if (!selected) return;
        setDocxMaking(true);
        try {
            const res = await ebookApi.generateDocx(selected.id);
            setDocxUrl(res.url);
            setSelected(prev => prev ? { ...prev, docxUrl: res.url, charged: true } : prev);
        } catch (e: any) { setError(e?.message || '문서 생성 실패'); }
        finally { setDocxMaking(false); }
    };

    // 최초 1회만 글자수 비례 차감(1,000자당 단가) — 클릭 전 견적을 확인 모달로 보여준 뒤 진행.
    const makeDocx = async () => {
        if (!selected || docxMaking) return;
        setError(null);
        try {
            const est = await ebookApi.docxEstimate(selected.id);
            if (est.alreadyCharged) { runMakeDocx(); return; }
            setPointConfirm({
                title: '문서 만들기 포인트 차감',
                lines: [`본문 총 ${est.totalChars.toLocaleString()}자`, `→ ${est.cost.toLocaleString()}P가 차감됩니다.`],
                onConfirm: runMakeDocx,
            });
        } catch (e: any) { setError(e?.message || '견적 계산 실패'); }
    };

    // 이미지 프롬프트 뽑기: 본문 [그림:설명] 자리별 ChatGPT용 프롬프트 생성
    const makeImagePrompts = async () => {
        if (!selected || imgPromptLoading) return;
        setImgPromptLoading(true); setError(null);
        try {
            const res = await ebookApi.imagePrompts(selected.id);
            setImgPrompts(res.prompts);
            if (res.prompts.length === 0 && res.message) setError(res.message);
        } catch (e: any) { setError(e?.message || '이미지 프롬프트 생성 실패'); }
        finally { setImgPromptLoading(false); }
    };

    // ChatGPT에 붙여넣었을 때 곧바로 이미지 생성 모드로 반응하도록 실행 지시 문구를 앞에 붙임.
    // 순수 설명문만 복사하면 ChatGPT가 텍스트로만 답하고 그림을 안 만들던 문제(2026-07-25 사장 지적) 해결.
    const copyPrompt = async (no: number, text: string) => {
        try {
            await navigator.clipboard.writeText(`아래 내용으로 이미지를 만들어줘:\n\n${text}`);
            setCopiedNo(no); setTimeout(() => setCopiedNo(null), 1500);
        } catch { /* 무시 */ }
    };

    // 폴링: 큐 처리 상태를 5초 간격으로 조회 — done+failed가 total에 도달하면 자동 중단.
    // 창을 닫아도 서버(shared-api 백그라운드 타이머)는 계속 처리하고, 재방문 시 이 폴링이 이어받는다.
    const pollImageQueue = useCallback((projectId: number, total: number) => {
        if (imgGenPollRef.current) clearInterval(imgGenPollRef.current);
        imgGenPollRef.current = setInterval(async () => {
            try {
                const st = await ebookApi.imageQueueStatus(projectId);
                const doneUrls: Record<string, string> = {};
                const failedSet = new Set<string>();
                for (const [caption, s] of Object.entries(st.slots)) {
                    if (s.status === 'done' && s.imageUrl) doneUrls[caption] = s.imageUrl;
                    if (s.status === 'failed') failedSet.add(caption);
                }
                setImgGenResults(prev => ({ ...prev, ...doneUrls }));
                setImgGenFailed(failedSet);
                setImgGenProgress({ done: st.counts.done + st.counts.failed, total });
                if (st.counts.queued === 0) {
                    if (imgGenPollRef.current) clearInterval(imgGenPollRef.current);
                    imgGenPollRef.current = null;
                    setImgGenBusy(false);
                    setDocxUrl(null); // 이미지가 바뀌었으니 기존 문서 무효
                    if (failedSet.size > 0) setImgGenError(`${failedSet.size}개는 생성에 실패해 포인트가 환불됐어요. 재시도 버튼으로 다시 만들 수 있어요.`);
                }
            } catch { /* 일시적 네트워크 오류 — 다음 폴링에서 재시도 */ }
        }, 5000);
    }, []);

    useEffect(() => () => { if (imgGenPollRef.current) clearInterval(imgGenPollRef.current); }, []);

    // 그림 이미지 일괄 생성: 자리들을 서버 큐에 한 번에 등록(전체 선차감) → 실제 생성은 서버
    // 백그라운드 타이머(15초 간격 1개씩, 다른 이미지 기능과 쿼터 신호등 공유)가 처리.
    // ★사장 지적(2026-07-25) 반영: 예전엔 프론트가 순차 동기 호출을 해서 쿼터 걸리면 남은
    // 자리 전부 시도조차 못 하고 멈췄음 — 지금은 등록만 하고 폴링으로 진행률만 본다.
    const runQueueImages = async (targets: { caption: string; chapterNo: number; prompt: string }[]) => {
        if (!selected) return;
        setImgGenError(null);
        try {
            await ebookApi.queueImages(selected.id, targets);
            setImgGenBusy(true);
            setImgGenProgress({ done: 0, total: targets.length });
            setImgGenFailed(prev => { const next = new Set(prev); targets.forEach(t => next.delete(t.caption)); return next; });
            pollImageQueue(selected.id, targets.length);
        } catch (e: any) {
            setImgGenError(e?.message || '이미지 생성 등록에 실패했어요.');
        }
    };

    const startImageGeneration = async (targets: { caption: string; chapterNo: number; prompt: string }[]) => {
        if (!selected || targets.length === 0) return;
        try {
            const est = await ebookApi.imageCost(selected.id, targets.length);
            setPointConfirm({
                title: '그림 이미지 생성 포인트 차감',
                lines: [`그림 ${est.count}개 × ${est.perImageCost.toLocaleString()}P`, `= 총 ${est.cost.toLocaleString()}P가 차감됩니다.`, '서버가 여유 있게 순서대로 진행해요(자리당 약 15초~).'],
                onConfirm: () => runQueueImages(targets),
            });
        } catch (e: any) { setImgGenError(e?.message || '견적 계산 실패'); }
    };

    const generateAllImages = () => {
        if (!imgPrompts || imgPrompts.length === 0 || imgGenBusy) return;
        const targets = imgPrompts.filter(ip => !imgGenResults[ip.caption] && ip.prompt);
        startImageGeneration(targets);
    };

    const retryFailedImage = (ip: { caption: string; chapterNo: number; prompt: string }) => {
        if (imgGenBusy) return;
        startImageGeneration([ip]);
    };

    // 탭4: 예약 시각 저장 (품절이면 409 → 안내 + 슬롯 새로고침)
    const saveSchedule = async (hour: number | null) => {
        if (!selected || savingSchedule) return;
        setSavingSchedule(true); setError(null);
        try {
            await ebookApi.setSchedule(selected.id, hour);
            setSelected(prev => prev ? { ...prev, scheduledHour: hour } : prev);
            loadSlots(); // 예약 반영 후 슬롯 현황 갱신
        } catch (e: any) {
            setError(e?.message || '예약 저장 실패');
            loadSlots(); // 품절이었을 수 있으니 현황 새로고침(다른 시간대 유도)
        }
        finally { setSavingSchedule(false); }
    };

    // 탭4: 시간대 슬롯 현황(품절 여부) 로드
    const loadSlots = useCallback(() => {
        ebookApi.getSlots().then(r => setSlots(r.slots)).catch(() => {});
    }, []);

    // ※ 즉시 자료수집(collectAll) 제거 — 자료수집·본문 모두 새벽 크론에서 처리. 체크(=등록)만 한다.

    // 탭2: 자료수집 체크 토글 저장 (개별/전체). collect 없으면 true로 간주.
    const saveCollectFlags = async (flags: Record<string, boolean>) => {
        if (!selected) return;
        // 낙관적 갱신
        setSelected(prev => prev ? { ...prev, chapters: (prev.chapters ?? []).map(c => flags[String(c.no)] !== undefined ? { ...c, collect: flags[String(c.no)] } : c) } : prev);
        try { await ebookApi.setCollectFlags(selected.id, flags); }
        catch (e: any) { setError(e?.message || '체크 저장 실패'); }
    };
    const toggleChapterCollect = (no: number, checked: boolean) => saveCollectFlags({ [String(no)]: checked });
    const toggleAllCollect = (checked: boolean) => {
        const flags: Record<string, boolean> = {};
        (selected?.chapters ?? []).forEach(c => { flags[String(c.no)] = checked; });
        saveCollectFlags(flags);
    };

    const loadList = useCallback(() => {
        ebookApi.list().then(setList).catch(() => {});
    }, []);
    useEffect(() => { loadList(); }, [loadList]);

    // 자료 수집 탭(4) 열릴 때 시간대 예약 현황(품절) 로드
    useEffect(() => { if (selected && activeTab === 4) loadSlots(); }, [selected?.id, activeTab, loadSlots]);

    // 선택된 전자책이 바뀌면 주제·제목 입력값 + 저장된 문서 URL 동기화(재방문 시 다운로드 버튼 유지)
    useEffect(() => {
        setTitleDraft(selected?.topic || '');
        setTitleEditDraft(selected?.title || selected?.topic || '');
        setEditingBookTitle(false);
        setAuthorDraft(selected?.author || '');
        setDocxUrl(selected?.docxUrl || null);
    }, [selected?.id]);

    const handleCreate = async () => {
        if (!topic.trim() || creating) return;
        setCreating(true); setError(null);
        try {
            const { project } = await ebookApi.create(topic.trim());
            setTopic('');
            setShowForm(false);
            setSelected(project);
            setActiveTab(1); // 생성 직후 책정보(제목·목차) 탭으로
            loadList();
        } catch (e: any) {
            setError(e.message || '목차 생성에 실패했습니다.');
        } finally { setCreating(false); }
    };

    const openProject = async (id: number) => {
        setError(null); // 화면 전환 시 이전 에러 제거
        try {
            const project = await ebookApi.get(id);
            setSelected(project);
            setShowForm(false); setActiveTab(1); setEditing(false);
            // 그림 자리 상태 복원(재방문 시 유지) — 완료분은 미리보기, 진행 중(queued)이면 폴링 자동 재개.
            // ★버그 수정(2026-07-25 사장 발견): imgPrompts를 복원 안 해서 재방문 시 "AI 이미지
            // 일괄 생성" 버튼(N/M 표시가 들어있는 그 버튼) 자체가 사라지고 진행바만 남는 문제 —
            // imageSlotsJson에 caption/chapterNo/prompt가 이미 다 있으니 여기서 imgPrompts로 변환해 복원.
            setImgGenFailed(new Set());
            if (project.imageSlotsJson) {
                try {
                    const slots: EbookImageSlot[] = JSON.parse(project.imageSlotsJson);
                    const chapterTitleOf = (no: number) => project.chapters?.find(c => c.no === no)?.title || `${no}장`;
                    setImgPrompts(slots.map((s, i) => ({ no: i + 1, chapterTitle: chapterTitleOf(s.chapterNo), caption: s.caption, prompt: s.prompt })));
                    setImgGenResults(Object.fromEntries(slots.filter(s => s.status === 'done' && s.imageUrl).map(s => [s.caption, s.imageUrl as string])));
                    setImgGenFailed(new Set(slots.filter(s => s.status === 'failed').map(s => s.caption)));
                    const queuedCount = slots.filter(s => s.status === 'queued').length;
                    if (queuedCount > 0) {
                        setImgGenBusy(true);
                        setImgGenProgress({ done: slots.length - queuedCount, total: slots.length });
                        pollImageQueue(project.id, slots.length);
                    }
                } catch { setImgGenResults({}); }
            } else { setImgGenResults({}); setImgPrompts(null); }
            // AI 표지 후보 복원 — coverCandidatesJson은 큐 슬롯 배열([{engine,status,url?}])로
            // 저장된다. 완료분만 골라 보여주고, 아직 queued가 남아 있으면(창을 닫았다 돌아온
            // 경우) 폴링을 재개해 마저 받는다.
            try {
                const slots: { engine: 'gemini' | 'gpt'; status: string; url?: string }[] = project.coverCandidatesJson ? JSON.parse(project.coverCandidatesJson) : [];
                setCoverCandidates(slots.filter(s => s.status === 'done' && s.url).map(s => ({ engine: s.engine, url: s.url as string })));
                if (slots.some(s => s.status === 'queued')) { setCoverMaking(true); pollCoverQueue(project.id); }
                else setCoverMaking(false);
            } catch { setCoverCandidates([]); }
        } catch {}
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('이 전자책을 삭제할까요?')) return;
        try { await ebookApi.remove(id); if (selected?.id === id) setSelected(null); loadList(); } catch {}
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-stretch md:items-center justify-center md:p-4" style={{ background: 'rgba(20,12,30,0.5)' }}>
            <div className="w-full md:max-w-5xl h-full md:h-auto md:max-h-[92vh] flex flex-col md:rounded-2xl overflow-hidden shadow-2xl" style={{ background: T.bg }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${T.border}`, background: T.card }}>
                    <div className="flex items-center gap-2">
                        <BookOpen size={17} style={{ color: T.accent }} />
                        <span className="font-bold text-base" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>전자책 만들기 <span className="text-[10px] tracking-[0.15em]" style={{ color: T.accent }}>EBOOK STUDIO</span></span>
                    </div>
                    <div className="flex items-center gap-1">
                        <HelpButton
                            title="전자책 만들기, 이렇게 진행돼요"
                            accent={T.accent}
                            steps={[
                                { title: '제목·목차 정하기', desc: '주제를 입력하면 작가 AI가 목차를 만들어줘요. 제목·저자명·책 크기(판형)를 정합니다.' },
                                { title: '만들 챕터 고르고 새벽 시간 예약', desc: '자료 수집 탭에서 만들 챕터를 체크하고 새벽 시간(1~5시)을 예약하면, 그 시각에 자료수집부터 본문까지 자동으로 만들어져요.' },
                                { title: '다음날 문서 받고 출판', desc: '초안 만들기 탭에서 표지를 올리고 구글 문서(.docx)를 받아 구글 독스에서 마무리한 뒤, 북크크(bookk.co.kr)에서 바로 출판하세요.' },
                            ]}
                            tip="본문은 밤사이 자동으로 만들어져요. 오늘 예약하고 내일 다시 들러 결과를 확인하세요 🌙"
                        />
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X size={18} style={{ color: T.inkMute }} /></button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* 목록 화면: 전체폭 (선택·작성 전에만). 선택/작성 시 숨기고 풀폭 전환(주식분석 패턴) */}
                    <div className={`${!selected && !showForm ? 'flex' : 'hidden'} w-full shrink-0 flex-col`}>
                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="max-w-4xl mx-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>내 전자책</h3>
                                    <button onClick={() => { setShowForm(true); setSelected(null); setError(null); }}
                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                                        style={{ background: T.accent, color: '#fff' }}>
                                        <Plus size={15} /> 새 전자책
                                    </button>
                                </div>

                                {list.length === 0
                                    ? <div className="text-center text-sm py-16" style={{ color: T.inkMute }}>아직 만든 전자책이 없어요. <b style={{ color: T.accent }}>새 전자책</b>으로 시작해 보세요.</div>
                                    : (
                                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                                        {list.map(p => (
                                            <button key={p.id} onClick={() => openProject(p.id)}
                                                className="text-left p-4 rounded-2xl flex flex-col gap-2 group transition hover:shadow-md"
                                                style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <BookOpen size={18} style={{ color: T.accent, flexShrink: 0 }} />
                                                    <Trash2 size={14} className="opacity-0 group-hover:opacity-100 transition" style={{ color: '#C62828' }} onClick={(e) => handleDelete(p.id, e)} />
                                                </div>
                                                <p className="text-sm font-bold leading-snug" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>{p.title || p.topic}</p>
                                                <p className="text-[11px] mt-auto" style={{ color: T.inkMute }}>{new Date(p.updatedAt).toLocaleDateString('ko-KR')}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 폼(새 전자책) 또는 상세(작업) — 목록일 땐 숨김 */}
                    <div className={`${showForm || selected ? 'flex-1' : 'hidden'} overflow-y-auto`}>
                        {showForm ? (
                            <div className="p-6 max-w-lg mx-auto">
                                <div className="flex items-center gap-2 mb-2">
                                    {list.length > 0 && (
                                        <button onClick={() => { setShowForm(false); setError(null); }} className="inline-flex items-center gap-1 text-xs font-bold mr-1" style={{ color: T.inkMute }}>
                                            <ChevronLeft size={15} /> 목록으로
                                        </button>
                                    )}
                                    <h3 className="text-lg font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>어떤 책을 만들까요?</h3>
                                </div>
                                <p className="text-xs mb-4" style={{ color: T.inkSoft }}>주제를 입력하면 강지훈 작가가 초보자용 책 목차를 설계해 드려요.</p>
                                <textarea
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    placeholder="예: AI가 처음인 당신을 위한 쉬운 AI 이야기 — AI란 무엇이고 지금 어디로 가고 있나"
                                    rows={3}
                                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none"
                                    style={{ background: T.card, border: `1px solid ${T.border}`, color: T.ink }}
                                />
                                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                                <button onClick={handleCreate} disabled={creating || !topic.trim()}
                                    className="w-full mt-3 py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(135deg, ${T.accent}, #A98BC9)`, color: '#fff' }}>
                                    {creating ? <><Loader size={15} className="animate-spin" /> 목차 설계 중...</> : <><BookOpen size={15} /> 목차 만들기</>}
                                </button>
                            </div>
                        ) : selected ? (
                            <div className="px-5 md:px-6 pb-5 md:pb-6 max-w-4xl mx-auto">
                                {/* 목록으로 + 진행 탭 — 스크롤해도 상단 고정(sticky). 배경 깔아 콘텐츠 비침 방지 */}
                                <div className="sticky top-0 z-20 pt-5 md:pt-6 pb-2" style={{ background: T.bg }}>
                                    {/* 목록으로 복귀 — 탭과 같은 알약 크기, 브라운 톤(나가기 성격, 진행단계 퍼플과 구분) */}
                                    <button onClick={() => { setSelected(null); setEditing(false); setError(null); }}
                                        className="mb-2 inline-flex items-center gap-1 rounded-full font-bold transition"
                                        style={{
                                            fontSize: 12, padding: '5px 13px',
                                            color: '#fff', background: T.inkSoft,
                                            border: `1px solid ${T.inkSoft}`,
                                            boxShadow: '0 2px 8px -3px rgba(107,95,86,0.5)',
                                        }}>
                                        <ChevronLeft size={14} strokeWidth={2.6} /> 목록으로
                                    </button>

                                    {/* ── 진행 탭 네비게이션 (1제목 → 3초안) ── */}
                                    <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                                    {TABS.map((t, i) => {
                                        const active = activeTab === t.id;
                                        return (
                                            <React.Fragment key={t.id}>
                                                {i > 0 && <span className="shrink-0 text-[10px]" style={{ color: T.inkMute }}>›</span>}
                                                <button onClick={() => { setActiveTab(t.id); setEditing(false); setError(null); }}
                                                    className="shrink-0 inline-flex items-center gap-1 rounded-full font-bold transition"
                                                    style={{
                                                        fontSize: 12, padding: '5px 12px',
                                                        color: active ? '#fff' : T.inkSoft,
                                                        background: active ? T.accent : T.surface,
                                                        border: `1px solid ${active ? T.accent : T.border}`,
                                                        boxShadow: active ? '0 2px 8px -2px rgba(142,111,183,0.5)' : 'none',
                                                    }}>
                                                    <span className="inline-flex items-center justify-center rounded-full" style={{ width: 16, height: 16, fontSize: 10, background: active ? 'rgba(255,255,255,0.25)' : '#fff', color: active ? '#fff' : T.inkMute, border: active ? 'none' : `1px solid ${T.border}` }}>{i + 1}</span>
                                                    {t.label}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                                    </div>
                                </div>{/* /sticky 래퍼(목록으로+탭) */}

                                {/* ── 탭4: 자료 일괄 수집 (예약 + 지금 바로) ── */}
                                {activeTab === 4 && (() => {
                                    const chs = selected.chapters ?? [];
                                    const total = chs.length;
                                    const withSrc = chs.filter(c => c.sourceStatus === 'done').length;
                                    // 체크 = "이번 새벽에 만들어줘". 본문이 만들어지면 백엔드가 collect=false로 해제한다.
                                    // collect 필드 없으면 true로 간주(하위호환). 본문 있는데 다시 체크하면 재생성 의도(존중).
                                    const isChecked = (c: typeof chs[number]) => c.collect === true || (c.collect === undefined && !(typeof c.contentMd === 'string' && c.contentMd.trim()));
                                    const checkedCount = chs.filter(isChecked).length;
                                    const allChecked = total > 0 && checkedCount === total;
                                    return (
                                    <div className="space-y-4">
                                        {error && <p className="text-xs text-red-500">{error}</p>}

                                        {/* 예약 시각 (정원제 — 품절 표시) */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                            <p className="text-sm font-bold mb-1" style={{ color: T.ink }}>⏰ 새벽 자동 생성 예약</p>
                                            <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>아래에서 <b style={{ color: T.accent }}>만들 챕터를 고르고</b> 새벽 시간을 골라두면, 그 시각에 <b style={{ color: T.accent }}>자료 수집부터 본문까지 자동으로 만들어져요</b>. 다음날 <b style={{ color: T.accent }}>초안 만들기</b> 탭에서 문서(.docx)를 받으세요. <span style={{ color: T.inkMute }}>시간대별 정원이 있어, 차면 다른 시간을 골라주세요.</span></p>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {[1, 2, 3, 4, 5].map(h => {
                                                    const on = selected.scheduledHour === h;
                                                    const slot = slots.find(s => s.hour === h);
                                                    const soldOut = !on && (slot?.soldOut ?? false); // 내가 잡은 슬롯은 품절이어도 표시 유지
                                                    return (
                                                        <button key={h} onClick={() => { if (!soldOut) saveSchedule(on ? null : h); }} disabled={savingSchedule || soldOut}
                                                            title={soldOut ? '예약 마감(품절)' : ''}
                                                            className="rounded-xl text-sm font-bold disabled:cursor-not-allowed" style={{
                                                                padding: '7px 14px',
                                                                color: on ? '#fff' : soldOut ? T.inkMute : T.inkSoft,
                                                                background: on ? T.accent : soldOut ? '#EEE9E2' : T.surface,
                                                                border: `1px solid ${on ? T.accent : T.border}`,
                                                                opacity: soldOut ? 0.65 : 1,
                                                                textDecoration: soldOut ? 'line-through' : 'none',
                                                            }}>
                                                            새벽 {h}시{soldOut ? ' · 품절' : slot ? ` · ${slot.capacity - slot.used}자리` : ''}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[11px] mt-2" style={{ color: selected.scheduledHour ? T.accent : T.inkMute }}>
                                                {selected.scheduledHour ? `새벽 ${selected.scheduledHour}시에 생성 예약됨 (다시 누르면 해제)` : '예약 안 됨 — 아래에서 챕터를 고르고 시간을 골라주세요'}
                                            </p>
                                        </div>

                                        {/* 새벽에 만들 챕터 선택(체크 = 예약 등록). 즉시 수집 없음 — 자료수집·본문 모두 새벽 크론 처리. */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.accentBorder}` }}>
                                            <p className="text-sm font-bold mb-1" style={{ color: T.ink }}>새벽에 만들 챕터 선택</p>
                                            <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>체크한 챕터는 <b style={{ color: T.accent }}>위에서 예약한 새벽 시간</b>에 자료 수집 + 본문 작성까지 자동으로 만들어져요. 이미 만든 챕터도 체크하면 새벽에 다시 만듭니다. · 선택 {checkedCount}/{total} · 자료완료 {withSrc}</p>

                                            {/* 전체 선택 토글 (등록은 체크만으로 즉시 저장됨 — 별도 버튼 없음) */}
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none" style={{ color: T.ink }}>
                                                    <input type="checkbox" checked={allChecked} onChange={e => toggleAllCollect(e.target.checked)} style={{ accentColor: T.accent, width: 15, height: 15 }} />
                                                    전체 선택
                                                </label>
                                                <span className="text-[11px]" style={{ color: T.inkMute }}>체크하면 자동으로 새벽 생성에 등록돼요</span>
                                            </div>

                                            {/* 챕터별 체크박스 + 상태 (체크=새벽 생성 등록) */}
                                            {total > 0 && (
                                                <div className="mt-1 space-y-1">
                                                    {chs.map(ch => {
                                                        const hasSrc = ch.sourceStatus === 'done';
                                                        const failed = ch.sourceStatus === 'failed';
                                                        const checked = isChecked(ch);
                                                        // 라벨: 체크+자료있음=재수집 예정 / 체크+자료없음=수집 예정 / 미체크+자료있음=자료수집완료 / 미체크+없음=미선택
                                                        const label = failed ? '수집 실패'
                                                            : checked ? (hasSrc ? '재수집 예정' : '수집 예정')
                                                            : (hasSrc ? '자료수집완료' : '미선택');
                                                        const color = failed ? '#C62828'
                                                            : checked ? T.accent
                                                            : (hasSrc ? '#5BA36A' : T.inkMute);
                                                        return (
                                                            <label key={ch.no} className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 cursor-pointer select-none" style={{ background: checked ? T.surface : 'transparent', opacity: checked ? 1 : 0.7 }}>
                                                                <input type="checkbox" checked={checked} onChange={e => toggleChapterCollect(ch.no, e.target.checked)} style={{ accentColor: T.accent, width: 15, height: 15, flexShrink: 0 }} />
                                                                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: T.accentSoft, color: T.accent }}>{ch.no}</span>
                                                                <span className="flex-1 truncate" style={{ color: T.ink }}>{ch.title}</span>
                                                                <span className="shrink-0 font-semibold" style={{ color }}>{label}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* ── 탭3(초안): 본문 일괄 생성 → 문서(.docx)/PDF ── */}
                                {activeTab === 5 && (() => {
                                    const chs = selected.chapters ?? [];
                                    const total = chs.length;
                                    const withSrc = chs.filter(c => c.sourceStatus === 'done').length;
                                    const withBody = chs.filter(c => typeof c.contentMd === 'string' && c.contentMd.trim()).length;
                                    const canPdf = withBody > 0;
                                    return (
                                    <div className="space-y-4">
                                        {error && <p className="text-xs text-red-500">{error}</p>}

                                        {/* 1단계: 본문(새벽 자동 생성 결과 보기) */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold" style={{ width: 18, height: 18, background: T.accent, color: '#fff' }}>1</span>
                                                <p className="text-sm font-bold" style={{ color: T.ink }}>본문</p>
                                            </div>
                                            <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>
                                                본문은 <b style={{ color: T.accent }}>자료 수집 탭에서 예약한 새벽 시간에 자동으로 만들어져요</b>. 다음날 들어와 확인하고, 아래에서 문서(.docx)를 받으세요. · 전체 {total} · 자료완료 {withSrc} · 본문완료 {withBody}
                                            </p>
                                            {withBody === 0 && (
                                                <p className="text-[11px] mb-2 px-3 py-2 rounded-lg" style={{ color: T.inkSoft, background: T.surface, border: `1px dashed ${T.border}` }}>
                                                    {withSrc === 0
                                                        ? <>아직 본문이 없어요. <b style={{ color: T.accent }}>자료 수집</b> 탭에서 만들 챕터를 고르고 새벽 시간을 예약해주세요. <b style={{ color: T.accent }}>새벽 예약 시간이 지나면</b> 자료 수집부터 본문까지 자동으로 채워집니다. 내일 다시 들러주세요 🌙</>
                                                        : <>자료가 준비됐어요. <b style={{ color: T.accent }}>새벽 예약 시간이 지나면</b> 본문이 자동으로 채워집니다. 내일 다시 들러주세요 🌙</>}
                                                </p>
                                            )}

                                            {/* 챕터별 상태 + 본문 보기(읽기 전용) */}
                                            {total > 0 && (
                                                <div className="mt-3 space-y-1.5">
                                                    {chs.map(ch => {
                                                        const hasBody = typeof ch.contentMd === 'string' && ch.contentMd.trim();
                                                        const label = hasBody ? `완성 · ${ch.contentMd!.length.toLocaleString()}자` : ch.sourceStatus === 'done' ? '생성 대기(새벽)' : '자료 없음';
                                                        const color = hasBody ? '#5BA36A' : ch.sourceStatus === 'done' ? T.accent : T.inkMute;
                                                        const open = contentOpenNo === ch.no;
                                                        return (
                                                            <div key={ch.no} className="rounded-lg" style={{ border: open ? `1px solid ${T.border}` : 'none' }}>
                                                                <div className="flex items-center gap-2 text-xs px-1 py-1">
                                                                    <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: T.accentSoft, color: T.accent }}>{ch.no}</span>
                                                                    <span className="flex-1 truncate" style={{ color: T.ink }}>{ch.title}</span>
                                                                    {hasBody && (
                                                                        <button onClick={() => setContentOpenNo(open ? null : ch.no)}
                                                                            className="shrink-0 text-[11px] font-bold rounded-md" style={{ padding: '3px 8px', color: T.accent, background: T.accentSoft }}>
                                                                            {open ? '접기 ▲' : '본문 보기 ▼'}
                                                                        </button>
                                                                    )}
                                                                    <span className="shrink-0 font-semibold" style={{ color }}>{label}</span>
                                                                </div>

                                                                {/* 펼침: 본문 미리보기(읽기 전용) */}
                                                                {open && hasBody && (
                                                                    <div className="px-2 pb-2">
                                                                        <div className="rounded-lg p-3 text-sm leading-relaxed ebook-md" style={{ background: '#fff', border: `1px solid ${T.border}`, color: T.ink, fontFamily: '"Nanum Myeongjo", serif', maxHeight: 280, overflowY: 'auto' }}>
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{ch.contentMd!}</ReactMarkdown>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <p className="text-[11px] mt-2" style={{ color: T.inkMute }}>
                                                💡 본문이 다 채워지면 아래에서 <b style={{ color: T.accent }}>문서(.docx)</b>를 받아 구글 독스에서 자유롭게 편집한 뒤, <b style={{ color: T.accent }}>북크크(bookk.co.kr)</b>에서 바로 출판하세요.
                                            </p>
                                        </div>

                                        {/* 3단계: 문서 만들기 (구글 독스용 .docx) — 표지는 탭1(제목·목차)로 이동(2026-07-26,
                                            사장 지시: "표지를 먼저 만들어야 나중에 책 표지가 틀려지지 않는다" — 표지 이미지
                                            속 제목을 그대로 책 제목으로 확정하는 흐름과 맞추기 위해 제목 입력 바로 아래로 배치) */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${canPdf ? T.accentBorder : T.border}`, opacity: canPdf ? 1 : 0.6 }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold" style={{ width: 18, height: 18, background: canPdf ? T.accent : T.inkMute, color: '#fff' }}>3</span>
                                                <p className="text-sm font-bold" style={{ color: T.ink }}>문서 만들기</p>
                                            </div>
                                            <ul className="text-[11px] mb-3 space-y-1 list-disc list-inside" style={{ color: T.inkSoft }}>
                                                <li>북크크 양식으로 <b style={{ color: T.accent }}>구글 문서(.docx)</b>를 만들어요.</li>
                                                <li>구글 독스에서 열면 글·표·그림을 자유롭게 편집할 수 있어요.</li>
                                                <li>마무리한 문서는 <b style={{ color: T.accent }}>북크크(bookk.co.kr)</b>에 올려 그대로 출판하세요.</li>
                                                <li>저자명: <b style={{ color: T.accent }}>{selected.author || '미설정'}</b> · 표지: <b style={{ color: selected.coverUrl ? '#5BA36A' : T.inkMute }}>{selected.coverUrl ? '있음(첫 페이지)' : '없음'}</b></li>
                                            </ul>

                                            <div className="flex gap-2 flex-wrap">
                                                {/* 만든 문서가 있으면 다운로드 버튼 먼저 노출(재방문 시 유지). 내용 바꾸면 서버가 무효화 → 다시 만들기. */}
                                                {docxUrl && !docxMaking && (
                                                    <a href={docxUrl} target="_blank" rel="noopener noreferrer" download
                                                        className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl" style={{ padding: '8px 16px', color: '#fff', background: '#5BA36A' }}>
                                                        <ExternalLink size={14} /> 문서 다운로드
                                                    </a>
                                                )}
                                                <button onClick={makeDocx} disabled={!canPdf || docxMaking}
                                                    className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: docxUrl ? T.accent : '#fff', background: docxUrl ? T.accentSoft : T.accent, border: docxUrl ? `1px solid ${T.accentBorder}` : 'none' }}>
                                                    {(() => {
                                                        const hasImages = Object.keys(imgGenResults).length > 0;
                                                        if (docxMaking) return <><Loader size={14} className="animate-spin" /> 문서 만드는 중…</>;
                                                        const label = docxUrl ? '문서 다시 만들기' : '구글 문서(.docx) 만들기';
                                                        // 완성된 그림이 있으면 라벨에 명시(사장 요청 — 클릭 전에 이미지 포함 여부를 알 수 있게)
                                                        return <><FileText size={14} /> {hasImages ? `🖼️ 이미지 포함 ${label}` : label}</>;
                                                    })()}
                                                </button>
                                                {/* 문서를 받았으면 북크크 출판 사이트로 바로 이동 */}
                                                {docxUrl && !docxMaking && (
                                                    <a href="https://bookk.co.kr" target="_blank" rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl" style={{ padding: '8px 16px', color: '#fff', background: '#E8703A' }}>
                                                        <ExternalLink size={14} /> 북크크에서 출판하기
                                                    </a>
                                                )}
                                            </div>

                                            {docxUrl && (
                                                <ul className="text-[11px] mt-2 space-y-1 list-disc list-inside" style={{ color: T.inkSoft }}>
                                                    <li>📎 받은 .docx를 구글 드라이브에 올리고 우클릭 → <b>연결 앱 → Google 문서</b>로 열면 편집돼요.</li>
                                                    <li>마무리한 문서는 <b style={{ color: T.accent }}>북크크(bookk.co.kr)</b>에 올려 바로 출판하세요.</li>
                                                    <li>내용을 바꾸면 <b style={{ color: T.accent }}>다시 만들기</b>로 새로 받으세요.</li>
                                                </ul>
                                            )}
                                            {!canPdf && <p className="text-[11px] mt-2" style={{ color: T.inkMute }}>본문을 먼저 만들어 주세요.</p>}
                                        </div>

                                        {/* 이미지 프롬프트 뽑기 — 본문 [그림:설명] 자리별 ChatGPT용 프롬프트 */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <ImagePlus size={15} style={{ color: T.accent }} />
                                                <p className="text-sm font-bold" style={{ color: T.ink }}>그림 이미지 프롬프트 뽑기</p>
                                            </div>
                                            <ul className="text-[11px] mb-3 space-y-1 list-disc list-inside" style={{ color: T.inkSoft }}>
                                                <li>본문의 <b>[그림: 설명]</b> 자리마다 책 내용에 맞는 한글 프롬프트를 만들어 드려요(일괄 500P).</li>
                                                <li><b>복사</b> 버튼을 누르면 ChatGPT에 그대로 붙여넣기만 해도 이미지가 만들어지는 문구가 함께 복사돼요.</li>
                                                <li>또는 <b style={{ color: T.accent }}>AI 이미지 일괄 생성</b>(장당 200P)으로 바로 만들어 문서에 자동으로 넣을 수도 있어요.</li>
                                            </ul>
                                            {!selected.charged && (
                                                <p className="text-[11px] mb-2 font-semibold" style={{ color: '#C0392B' }}>⚠️ 먼저 위에서 <b>구글 문서(.docx) 만들기</b>를 완료해야 그림 기능을 사용할 수 있어요.</p>
                                            )}
                                            {Object.keys(imgGenResults).length > 0 && (
                                                <p className="text-[11px] mb-2" style={{ color: T.inkMute }}>ℹ️ 이미 만들어진 그림이 있어 프롬프트를 다시 뽑을 수 없어요(중복 과금 방지). 그림을 더 넣으려면 본문에 <b>[그림: 설명]</b> 자리를 추가한 뒤 다시 시도하세요.</p>
                                            )}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button onClick={makeImagePrompts} disabled={!canPdf || !selected.charged || imgPromptLoading || Object.keys(imgGenResults).length > 0}
                                                    className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: '#fff', background: T.accent }}>
                                                    {imgPromptLoading ? <><Loader size={14} className="animate-spin" /> 프롬프트 만드는 중…</> : <><ImagePlus size={14} /> 이미지 프롬프트 뽑기</>}
                                                </button>
                                                {imgPrompts && imgPrompts.length > 0 && (() => {
                                                    // "만들 게 남아있는지" 계산 — 전부 done이면 눌러도 아무 일 없는 버튼이
                                                    // 계속 활성 상태로 보이던 문제(2026-07-25 사장 지적) 수정: 남은 게
                                                    // 없으면 완료 배지로 바꾸고 비활성화.
                                                    const remaining = imgPrompts.filter(ip => !imgGenResults[ip.caption] && ip.prompt).length;
                                                    const allDone = remaining === 0 && !imgGenBusy;
                                                    return (
                                                        <button onClick={generateAllImages} disabled={imgGenBusy || allDone}
                                                            className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: '#fff', background: allDone ? '#9089A1' : '#5BA36A' }}>
                                                            {imgGenBusy
                                                                ? <><Loader size={14} className="animate-spin" /> 순서대로 생성 중… {imgGenProgress.done}/{imgGenProgress.total}</>
                                                                : allDone
                                                                    ? <><Check size={14} /> 모든 그림 생성 완료</>
                                                                    : <><ImagePlus size={14} /> {Object.keys(imgGenResults).length > 0 ? '나머지 이미지 이어서 생성' : 'AI 이미지 일괄 생성'}</>}
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                            {imgGenError && <p className="text-[11px] mt-2" style={{ color: '#C0392B' }}>{imgGenError}</p>}
                                            {imgGenBusy && (
                                                <p className="text-[11px] mt-2" style={{ color: T.inkMute }}>⏳ 창을 닫아도 계속 만들어져요 — 다시 열면 진행 상황이 그대로 보여요.</p>
                                            )}
                                            {imgGenBusy && imgGenProgress.total > 0 && (
                                                <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.accentSoft }}>
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${(imgGenProgress.done / imgGenProgress.total) * 100}%`, background: T.accent }} />
                                                </div>
                                            )}

                                            {imgPrompts && imgPrompts.length > 0 && (
                                                <div className="mt-3 flex flex-col gap-2">
                                                    {imgPrompts.map(ip => {
                                                        const genUrl = imgGenResults[ip.caption];
                                                        const failed = imgGenFailed.has(ip.caption);
                                                        return (
                                                        <div key={ip.no} className="rounded-xl p-3" style={{ background: '#fff', border: `1px solid ${T.border}` }}>
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <span className="text-[11px] font-bold" style={{ color: T.accent }}>그림 {ip.no} · {ip.chapterTitle}</span>
                                                                <button onClick={() => copyPrompt(ip.no, ip.prompt)} className="inline-flex items-center gap-1 text-[11px] font-bold rounded-lg" style={{ padding: '4px 10px', color: copiedNo === ip.no ? '#fff' : T.accent, background: copiedNo === ip.no ? '#5BA36A' : T.accentSoft, border: `1px solid ${T.accentBorder}` }}>
                                                                    {copiedNo === ip.no ? <><Check size={11} /> 복사됨</> : <>복사</>}
                                                                </button>
                                                            </div>
                                                            <p className="text-[11px] mb-1" style={{ color: T.inkMute }}>📍 {ip.caption}</p>
                                                            <p className="text-xs mb-2" style={{ color: T.ink, lineHeight: 1.6 }}>{ip.prompt}</p>
                                                            {genUrl && (
                                                                <div className="flex items-center gap-2">
                                                                    <img src={genUrl} alt={ip.caption} className="rounded-lg" style={{ width: 100, height: 75, objectFit: 'cover', border: `1px solid ${T.border}` }} />
                                                                    <span className="text-[11px] font-bold" style={{ color: '#5BA36A' }}>✓ 생성됨 — 문서 만들기 시 자동으로 들어가요</span>
                                                                </div>
                                                            )}
                                                            {failed && !genUrl && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-bold" style={{ color: '#C0392B' }}>❌ 생성 실패(포인트 환불됨)</span>
                                                                    <button onClick={() => retryFailedImage(ip)} disabled={imgGenBusy}
                                                                        className="text-[11px] font-bold rounded-lg disabled:opacity-40" style={{ padding: '4px 10px', color: T.accent, background: T.accentSoft, border: `1px solid ${T.accentBorder}` }}>
                                                                        다시 시도
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* ── 탭1: 책 정보 (제목·저자) + 목차(보기/수정) ── */}
                                {activeTab === 1 && <>
                                {/* 주제·제목 카드 — 2026-07-26 사장 지시로 역할 분리:
                                    "책 주제"는 사용자가 직접 고치는 입력칸(목차·표지가 이걸 참고하진 않음, 최초 생성 재료).
                                    "책 제목"은 읽기전용 표시 + 수정모드 — 목차·표지 생성이 실제로 참고하는 확정값이며,
                                    AI 표지를 고르면 그 안의 카피가 draft로 채워져 사용자 확인 후에만 저장된다. */}
                                <div className="rounded-2xl p-5 mb-4" style={{ background: 'linear-gradient(135deg, #ffffff, #f7f3fb)', border: `1px solid ${T.accentBorder}`, boxShadow: '0 4px 16px -8px rgba(142,111,183,0.4)' }}>
                                    <p className="text-[10px] tracking-widest mb-2" style={{ color: T.accent }}>책 주제</p>
                                    <div className="flex flex-col gap-2">
                                        <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} placeholder="책 주제(예: 클로드 코드로 초보자용 홈페이지 만들기)"
                                            className="w-full text-sm rounded-lg px-3 py-2" style={{ color: T.ink, border: `1px solid ${T.accentBorder}`, background: '#fff' }} />
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] shrink-0" style={{ color: T.inkSoft }}>저자명</span>
                                            {/* min-w-0: flex 자식이 줄어들 수 있게(없으면 input이 버튼을 화면 밖으로 밀어냄, 모바일 잘림) */}
                                            <input value={authorDraft} onChange={e => setAuthorDraft(e.target.value)} placeholder="예: 강지훈"
                                                className="flex-1 min-w-0 text-sm rounded-lg px-3 py-1.5" style={{ color: T.ink, border: `1px solid ${T.border}`, background: '#fff' }} />
                                            <button onClick={saveTitle} disabled={savingTitle || !titleDraft.trim()} className="shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg disabled:opacity-50" style={{ padding: '8px 12px', color: '#fff', background: T.accent }}>
                                                {savingTitle ? <Loader size={13} className="animate-spin" /> : <Save size={13} />} 저장
                                            </button>
                                        </div>

                                        {/* 책 제목 — 목차·표지가 실제로 참고하는 값. 평소엔 표시만, 표지를 고르면
                                            자동으로 수정모드가 열려 draft를 확인·수정한 뒤 저장해야 확정된다. */}
                                        <div className="mt-2 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                                            <p className="text-[10px] tracking-widest mb-2" style={{ color: T.accent }}>책 제목</p>
                                            {editingBookTitle ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <input value={titleEditDraft} onChange={e => setTitleEditDraft(e.target.value)} placeholder="책 제목"
                                                        autoFocus
                                                        className="w-full text-xl font-bold rounded-lg px-3 py-2" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif', border: `1px solid ${T.accentBorder}`, background: '#fff' }} />
                                                    <p className="text-[11px]" style={{ color: T.inkMute }}>표지에서 읽어온 제목이에요. 확인하고 필요하면 고친 뒤 저장하세요.</p>
                                                    <div className="flex gap-1.5">
                                                        <button onClick={saveBookTitle} disabled={savingBookTitle || !titleEditDraft.trim()}
                                                            className="inline-flex items-center gap-1 text-xs font-bold rounded-lg disabled:opacity-50" style={{ padding: '8px 12px', color: '#fff', background: T.accent }}>
                                                            {savingBookTitle ? <Loader size={13} className="animate-spin" /> : <Save size={13} />} 제목 저장
                                                        </button>
                                                        <button onClick={() => { setEditingBookTitle(false); setTitleEditDraft(selected.title || selected.topic || ''); }}
                                                            className="text-xs font-bold rounded-lg" style={{ padding: '8px 12px', color: T.inkMute, border: `1px solid ${T.border}` }}>
                                                            취소
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-xl font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>{selected.title || selected.topic}</p>
                                                    <button onClick={() => { setTitleEditDraft(selected.title || selected.topic || ''); setEditingBookTitle(true); }}
                                                        className="inline-flex items-center gap-1 text-xs font-bold rounded-lg" style={{ padding: '5px 10px', color: T.accent, border: `1px solid ${T.accentBorder}`, background: T.accentSoft }}>
                                                        <Pencil size={11} /> 수정
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* 책 판형 선택 (문서 크기 결정) */}
                                        <div className="mt-1">
                                            <span className="text-[11px]" style={{ color: T.inkSoft }}>책 크기(판형)</span>
                                            <div className="flex gap-1.5 flex-wrap mt-1">
                                                {[
                                                    { key: 'sinkuk', label: '신국판', desc: '152×225mm' },
                                                    { key: 'a5', label: 'A5', desc: '148×210mm' },
                                                    { key: 'gukbae', label: '국배판', desc: '188×257mm' },
                                                ].map(s => {
                                                    const on = (selected.pageSize || 'sinkuk') === s.key;
                                                    return (
                                                        <button key={s.key} onClick={() => savePageSize(s.key)}
                                                            className="rounded-lg text-xs font-bold" style={{ padding: '6px 11px', color: on ? '#fff' : T.inkSoft, background: on ? T.accent : T.surface, border: `1px solid ${on ? T.accent : T.border}` }}>
                                                            {s.label} <span className="font-normal" style={{ fontSize: 10, opacity: 0.8 }}>{s.desc}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

                                {/* 표지 만들기 — 탭5(초안 만들기)에서 이동(2026-07-26, 사장 지시). 표지를 먼저
                                    만들고 그 안의 제목을 확정한 뒤 목차를 만드는 흐름과 맞추기 위해 제목 카드
                                    바로 아래·목차 위로 배치. */}
                                <div className="rounded-2xl p-4 mb-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                    <p className="text-sm font-bold mb-1" style={{ color: T.ink }}>표지 만들기 <span className="text-[11px] font-normal" style={{ color: T.inkMute }}>(선택)</span></p>
                                    <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>직접 만든 표지를 올리거나, <b style={{ color: T.accent }}>AI가 제목·목차를 참고해 서로 다른 화풍의 표지 2장을 만들어</b> 드려요(마음에 드는 쪽 선택). 올린 표지는 문서(.docx) 첫 페이지에 꽉 차게 들어가요. <span style={{ color: T.inkMute }}>세로형(예: 1024×1536) 권장 · JPG/PNG · 최대 15MB</span></p>
                                    <div className="flex items-start gap-3 flex-wrap">
                                        <label className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl cursor-pointer" style={{ padding: '8px 16px', color: '#fff', background: T.accent, opacity: coverMaking ? 0.4 : 1 }}>
                                            {coverMaking ? <><Loader size={14} className="animate-spin" /> 처리 중…</> : <><ImagePlus size={14} /> {selected.coverUrl ? '표지 바꾸기' : '표지 이미지 올리기'}</>}
                                            <input type="file" accept="image/*" disabled={coverMaking} className="hidden"
                                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.currentTarget.value = ''; }} />
                                        </label>
                                        <button onClick={generateAICover} disabled={coverMaking}
                                            className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: T.accent, background: T.accentSoft, border: `1px solid ${T.accentBorder}` }}>
                                            {coverMaking ? <><Loader size={14} className="animate-spin" /> 만드는 중…</> : <>✨ AI로 표지 만들기</>}
                                        </button>
                                        {selected.coverUrl && (
                                            <>
                                                <img src={selected.coverUrl} alt="표지 미리보기" onClick={() => setZoomImage(selected.coverUrl!)} className="rounded-lg cursor-zoom-in" style={{ width: 90, height: 120, objectFit: 'cover', border: `1px solid ${T.border}` }} />
                                                <button onClick={handleSaveCover} disabled={coverSaving}
                                                    className="inline-flex items-center gap-1 text-xs font-bold rounded-lg self-start disabled:opacity-40" style={{ padding: '6px 10px', color: T.accent, background: T.accentSoft }}>
                                                    {coverSaving ? <Loader size={12} className="animate-spin" /> : <Download size={12} />} {coverSaving ? '저장 중…' : '저장'}
                                                </button>
                                                <button onClick={removeCover} disabled={coverMaking}
                                                    className="inline-flex items-center gap-1 text-xs font-bold rounded-lg self-start disabled:opacity-40" style={{ padding: '6px 10px', color: '#C62828', background: '#FDECEC' }}>
                                                    <Trash2 size={12} /> 제거
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    {/* AI 표지 진행/후보 — 만드는 중엔 완료된 것부터 뜨고(5초 폴링), 2장 다 나오면
                                        고를 수 있다. 창을 닫아도 서버가 계속 만들고, 다시 열면 이어서 보인다. */}
                                    {(coverMaking || coverCandidates.length > 0) && (
                                        <div className="mt-3 rounded-xl p-3" style={{ background: T.accentSoft, border: `1px solid ${T.accentBorder}` }}>
                                            <p className="text-[11px] font-bold mb-2" style={{ color: T.ink }}>
                                                {coverMaking
                                                    ? `표지를 만들고 있어요(${coverCandidates.length}/2) — 최대 2분 정도 걸려요. 창을 닫아도 계속 만들어져요.`
                                                    : '마음에 드는 표지를 고르세요'}
                                            </p>
                                            <div className="flex gap-3 flex-wrap">
                                                {coverCandidates.map(c => (
                                                    <div key={c.url} className="flex flex-col items-center gap-1.5">
                                                        <img src={c.url} alt={`표지 후보 (${c.engine})`} onClick={() => setZoomImage(c.url)} className="rounded-lg cursor-zoom-in" style={{ width: 120, height: 160, objectFit: 'cover', border: `1px solid ${T.border}` }} />
                                                        {!coverMaking && (
                                                            <button onClick={() => pickCoverCandidate(c.url)} disabled={coverMaking}
                                                                className="text-xs font-bold rounded-lg disabled:opacity-40" style={{ padding: '6px 14px', color: '#fff', background: T.accent }}>
                                                                이걸로 할래요
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {coverMaking && coverCandidates.length < 2 && (
                                                    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg" style={{ width: 120, height: 160, border: `1px dashed ${T.border}` }}>
                                                        <Loader size={18} className="animate-spin" style={{ color: T.accent }} />
                                                    </div>
                                                )}
                                            </div>
                                            {!coverMaking && <p className="text-[11px] mt-2" style={{ color: T.inkMute }}>둘 다 마음에 안 들면 다시 만들 수 있어요(포인트가 다시 차감됩니다).</p>}
                                        </div>
                                    )}
                                    {coverSaveToast && (
                                        <p className="text-[11px] mt-2" style={{ color: T.accent }}>{coverSaveToast}</p>
                                    )}
                                </div>

                                {/* 목차 헤더 + 보기/수정 토글 */}
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-bold" style={{ color: T.ink }}>목차 <span className="text-[11px] font-normal" style={{ color: T.inkMute }}>({(selected.chapters ?? []).length}챕터)</span></p>
                                    {editing
                                        ? <div className="flex gap-1.5 shrink-0">
                                            <button onClick={saveToc} disabled={savingToc} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ color: '#fff', background: T.accent }}>{savingToc ? <Loader size={12} className="animate-spin" /> : <Save size={12} />} 목차 저장</button>
                                            <button onClick={() => cancelEdit()} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.inkMute, border: `1px solid ${T.border}` }}>취소</button>
                                          </div>
                                        : <div className="flex gap-1.5 shrink-0">
                                            <button onClick={startEdit} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.accent, border: `1px solid ${T.accentBorder}`, background: T.accentSoft }}><Pencil size={12} /> 목차 수정</button>
                                            <button onClick={regenerateToc} disabled={regenToc} title="현재 제목을 보고 목차를 새로 만들어요" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ color: T.accent, border: `1px solid ${T.accentBorder}`, background: T.accentSoft }}>
                                                {regenToc ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />} 목차 다시 만들기
                                            </button>
                                          </div>}
                                </div>

                                {/* 목차 보기 (단순 챕터 리스트) */}
                                {!editing && (
                                    <div className="space-y-2">
                                        {(selected.chapters ?? []).map(ch => {
                                            const st = ch.sourceStatus ?? 'idle';
                                            const isCollecting = st === 'collecting' || collectingNo === ch.no;
                                            const isDone = st === 'done';
                                            const isFailed = st === 'failed';
                                            const open = expandedNo === ch.no;
                                            return (
                                            <div key={ch.no} className="rounded-xl p-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                                <div className="flex gap-3">
                                                    <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: T.accentSoft, color: T.accent, border: `1px solid ${T.accentBorder}` }}>{ch.no}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold" style={{ color: T.ink }}>{ch.title}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: T.inkSoft }}>{ch.summary}</p>

                                                        {/* 자료수집 영역 — 탭5(초안/배치)에서 부활 예정, 현재 비활성 */}
                                                        {false && (
                                                        <div className="mt-3">
                                                            {/* 수집 전: 큰 버튼 */}
                                                            {!isCollecting && !isDone && !isFailed && (
                                                                <button onClick={() => collectSources(ch.no)} disabled={collectingNo !== null}
                                                                    className="inline-flex items-center gap-1.5 font-bold rounded-xl disabled:opacity-40"
                                                                    style={{ fontSize: 13, padding: '8px 16px', color: '#fff', background: T.accent, boxShadow: '0 3px 10px -3px rgba(142,111,183,0.6)' }}>
                                                                    <Search size={15} /> 자료 수집하기
                                                                </button>
                                                            )}

                                                            {/* 수집 중: 또렷한 단계 표시줄 (접수 → 수집 → 완료) */}
                                                            {isCollecting && (
                                                                <div className="rounded-xl p-3" style={{ background: T.accentSoft, border: `1.5px solid ${T.accentBorder}` }}>
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <Stage label="접수" state="done" />
                                                                        <span style={{ color: T.accent, fontWeight: 700 }}>›</span>
                                                                        <Stage label="자료 수집 중" state="current" />
                                                                        <span style={{ color: T.inkMute, fontWeight: 700 }}>›</span>
                                                                        <Stage label="완료" state="todo" />
                                                                    </div>
                                                                    <p className="mt-2" style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>웹에서 자료를 찾고 있어요… 잠시만 기다려 주세요 (보통 5~15초)</p>
                                                                </div>
                                                            )}

                                                            {/* 완료: 또렷한 완료 배지 + 액션 */}
                                                            {isDone && (
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="inline-flex items-center gap-1.5 rounded-xl" style={{ fontSize: 13, fontWeight: 800, padding: '7px 14px', color: '#fff', background: '#5BA36A', boxShadow: '0 3px 10px -3px rgba(91,163,106,0.6)' }}>
                                                                        <Check size={16} strokeWidth={3} /> 수집 완료 · {ch.sources?.length ?? 0}건
                                                                    </span>
                                                                    <button onClick={() => setExpandedNo(open ? null : ch.no)} className="font-bold rounded-xl" style={{ fontSize: 13, padding: '7px 14px', color: T.accent, background: T.accentSoft, border: `1.5px solid ${T.accentBorder}` }}>
                                                                        {open ? '자료 접기 ▲' : '자료 보기 ▼'}
                                                                    </button>
                                                                    <button onClick={() => collectSources(ch.no)} disabled={collectingNo !== null} className="inline-flex items-center gap-1 font-bold rounded-xl disabled:opacity-40" style={{ fontSize: 13, padding: '7px 14px', color: '#fff', background: '#B58F4A', boxShadow: '0 3px 10px -3px rgba(181,143,74,0.6)' }}>
                                                                        <Search size={14} /> 다시 수집
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* 실패 */}
                                                            {isFailed && (
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="inline-flex items-center gap-1.5 rounded-xl" style={{ fontSize: 13, fontWeight: 700, padding: '7px 14px', color: '#fff', background: '#D04545' }}>
                                                                        <AlertCircle size={15} /> 수집 실패
                                                                    </span>
                                                                    <button onClick={() => collectSources(ch.no)} disabled={collectingNo !== null} className="font-bold rounded-xl disabled:opacity-40" style={{ fontSize: 13, padding: '7px 14px', color: '#fff', background: T.accent }}>다시 시도</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 수집된 자료 목록 (펼치기) — 어떤 형태로 와도 안전하게 문자열화 */}
                                                {false && open && isDone && Array.isArray(ch.sources) && ch.sources.length > 0 && (
                                                    <div className="mt-3 ml-10 space-y-2">
                                                        {ch.sources.map((s: any, si) => {
                                                            const sTitle = typeof s?.title === 'string' ? s.title : (s == null ? '' : String(s));
                                                            const sSummary = typeof s?.summary === 'string' ? s.summary : '';
                                                            const sTable = typeof s?.tableData === 'string' ? s.tableData : '';
                                                            const sUrl = typeof s?.url === 'string' ? s.url : '';
                                                            return (
                                                            <div key={si} className="rounded-lg p-2.5" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                                                                <p className="text-xs font-semibold flex items-start gap-1.5" style={{ color: T.ink }}>
                                                                    <FileText size={12} className="shrink-0 mt-0.5" style={{ color: T.accent }} />{sTitle}
                                                                </p>
                                                                {sSummary && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>{sSummary}</p>}
                                                                {sTable && (
                                                                    <p className="text-[10px] mt-1 px-2 py-1 rounded" style={{ color: T.inkSoft, background: '#fff', border: `1px dashed ${T.border}` }}>📊 {sTable}</p>
                                                                )}
                                                                {sUrl && (
                                                                    <a href={sUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] mt-1.5" style={{ color: T.accent }}>
                                                                        <ExternalLink size={10} /> 출처 보기
                                                                    </a>
                                                                )}
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                            </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* 목차 수정 (editing 모드): 챕터 편집 + 순서변경 */}
                                {editing && (
                                    <div className="space-y-2">
                                        <p className="text-[11px] mb-2" style={{ color: T.inkMute }}>챕터를 수정/추가/삭제하고 순서를 바꾼 뒤 위의 <b style={{ color: T.accent }}>목차 저장</b>을 눌러주세요. (책 제목·저자는 위 카드에서 수정)</p>
                                        {editChapters.map((ch, i) => (
                                            <div key={i} className="flex gap-2 rounded-xl p-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                                <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                                                    <button onClick={() => moveCh(i, -1)} disabled={i === 0} className="disabled:opacity-30"><ChevronUp size={14} style={{ color: T.inkMute }} /></button>
                                                    <span className="text-[10px] text-center" style={{ color: T.accent }}>{i + 1}</span>
                                                    <button onClick={() => moveCh(i, 1)} disabled={i === editChapters.length - 1} className="disabled:opacity-30"><ChevronDown size={14} style={{ color: T.inkMute }} /></button>
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <input value={ch.title} onChange={e => setCh(i, 'title', e.target.value)} placeholder="챕터 제목"
                                                        className="w-full text-sm font-semibold rounded-lg px-2 py-1" style={{ color: T.ink, border: `1px solid ${T.border}`, background: '#fff' }} />
                                                    <input value={ch.summary} onChange={e => setCh(i, 'summary', e.target.value)} placeholder="한 줄 요약"
                                                        className="w-full text-xs rounded-lg px-2 py-1" style={{ color: T.inkSoft, border: `1px solid ${T.border}`, background: '#fff' }} />
                                                </div>
                                                <button onClick={() => delCh(i)} className="shrink-0 self-start"><Trash2 size={14} style={{ color: '#C62828' }} /></button>
                                            </div>
                                        ))}
                                        <button onClick={addCh} className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1" style={{ color: T.accent, border: `1px dashed ${T.accentBorder}`, background: T.accentSoft }}>
                                            <Plus size={13} /> 챕터 추가
                                        </button>
                                    </div>
                                )}
                                </>}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* 포인트 차감 확인 모달(docx 만들기·그림 이미지 생성 공용) — brower confirm() 대신 디자인 모달로(사장 요청). */}
            {pointConfirm && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(20,12,30,0.5)' }}>
                    <div className="w-full max-w-sm rounded-2xl p-5 shadow-2xl" style={{ background: T.card }}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="inline-flex items-center justify-center rounded-full w-8 h-8" style={{ background: T.accentSoft }}>
                                {pointConfirm.icon ?? <ImagePlus size={16} style={{ color: T.accent }} />}
                            </span>
                            <p className="text-sm font-bold" style={{ color: T.ink }}>{pointConfirm.title}</p>
                        </div>
                        <div className="rounded-xl p-3 mb-4 space-y-1" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                            {pointConfirm.lines.map((line, i) => (
                                <p key={i} className="text-sm" style={{ color: i === pointConfirm.lines.length - 1 && line.includes('P') ? T.accent : T.inkSoft, fontWeight: line.includes('총') || line.includes('차감') ? 700 : 400 }}>{line}</p>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setPointConfirm(null)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ color: T.inkMute, background: T.surface, border: `1px solid ${T.border}` }}>
                                취소
                            </button>
                            <button onClick={() => { const fn = pointConfirm.onConfirm; setPointConfirm(null); fn(); }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: T.accent }}>
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 표지 이미지 확대보기(라이트박스) + 저장. 확정 표지·후보 이미지 클릭 시 공통 사용. */}
            {zoomImage && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" style={{ background: 'rgba(20,12,30,0.85)' }} onClick={() => setZoomImage(null)}>
                    <button onClick={() => setZoomImage(null)} className="absolute top-4 right-4 rounded-full p-2" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                        <X size={20} />
                    </button>
                    <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
                        <img src={zoomImage} alt="표지 확대보기" className="rounded-lg" style={{ maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain' }} />
                        <button onClick={() => saveCoverImage(zoomImage)} disabled={coverSaving}
                            className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: '#fff', background: T.accent }}>
                            {coverSaving ? <Loader size={14} className="animate-spin" /> : <Download size={14} />} {coverSaving ? '저장 중…' : '이미지 저장'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
