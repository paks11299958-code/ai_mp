import React, { useState, useEffect, useRef } from 'react';
import { Persona, PersonaImage, PersonaVideo } from '../types';
import { personaImageApi, personaVideoApi, settingsApi, knowledgeApi, triggerVideoApi } from '../services/apiService';
import { TriggerVideo } from '../types';
import { STAGES } from '../utils/level';
import { generateImageDescription } from '../services/geminiService';
import { Icon } from './Icons';

interface AdminPanelProps {
    personas: Persona[];
    onSave: (persona: Persona) => Promise<void>;
    onDelete: (id: string) => void;
    onClose: () => void;
    onImagesChanged?: (personaId: string) => void;
}

const AVAILABLE_ICONS = ['Bot', 'Code2', 'PenTool', 'Languages', 'Send', 'Settings'];
const AVAILABLE_COLORS = [
    { label: '파랑-청록', value: 'from-blue-500 to-cyan-500' },
    { label: '초록-청록', value: 'from-emerald-500 to-teal-500' },
    { label: '보라-분홍', value: 'from-purple-500 to-pink-500' },
    { label: '주황-호박', value: 'from-orange-500 to-amber-500' },
    { label: '빨강-장미', value: 'from-red-500 to-rose-500' },
    { label: '남색-보라', value: 'from-indigo-500 to-violet-500' },
];

const DEFAULT_IDS = ['general', 'coder', 'writer', 'translator'];

const INSTRUCTION_EXAMPLE = `[역할]
- 사용자의 감정을 공감하고 스스로 정리할 수 있도록 돕는다
- 단순 위로가 아닌 감정의 원인과 패턴을 함께 탐색한다

[말투]
- 차분하고 따뜻하게, 짧고 명확한 문장
- "~일 수 있어요", "~처럼 들려요" 완곡한 표현 사용

[응답 구조]
1. 감정 반영
2. 상황 정리
3. 핵심 질문 1~2개

[금지]
- "괜찮아질 거예요" 같은 단순 위로 금지
- 성급한 해결책 제시 금지`;

const IDENTITY_EXAMPLE = `당신은 AI가 아닌 실제 인물입니다.
당신은 '서윤'이라는 감정 치유 전문 임상심리학자입니다.
{imageDescription}

"저는 AI입니다", "인공지능입니다"라는 말은 절대 하지 마세요.
외모에 대한 칭찬을 받으면 실제 그 사람처럼 자연스럽게 받아들이세요.`;

export const AdminPanel: React.FC<AdminPanelProps> = ({ personas, onSave, onDelete, onClose, onImagesChanged }) => {
    const [selectedId, setSelectedId] = useState<string>(personas[0]?.id || '');
    const [activeTab, setActiveTab] = useState<'info' | 'gallery' | 'knowledge' | 'triggers'>('info');
    const [showGlobalSettings, setShowGlobalSettings] = useState(false);
    const [commonInstruction, setCommonInstruction] = useState('');
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);
    const [showSavedModal, setShowSavedModal] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instruction, setInstruction] = useState('');
    const [identityPrompt, setIdentityPrompt] = useState('');
    const [iconName, setIconName] = useState('Bot');
    const [colorClass, setColorClass] = useState(AVAILABLE_COLORS[0].value);
    const [imageUrl, setImageUrl] = useState('');
    const [isVisible, setIsVisible] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showInstructionExample, setShowInstructionExample] = useState(false);
    const [showIdentityExample, setShowIdentityExample] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 이미지 갤러리 상태
    const [images, setImages] = useState<PersonaImage[]>([]);
    const [imageDesc, setImageDesc] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // 지식 상태
    const [knowledgeList, setKnowledgeList] = useState<{ sourceId: string | null; title: string | null; chunkCount: number; preview: string; createdAt: string }[]>([]);
    const [knowledgeTitle, setKnowledgeTitle] = useState('');
    const [knowledgeText, setKnowledgeText] = useState('');
    const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);

    // 이미지 해제 단계 저장 상태
    const [pendingLevel, setPendingLevel] = useState(1);
    const [savingLevel, setSavingLevel] = useState(false);
    const [savedLevel, setSavedLevel] = useState(false);

    // 트리거 영상 상태
    const [triggerVideos, setTriggerVideos] = useState<TriggerVideo[]>([]);
    const [tvTitle, setTvTitle] = useState('');
    const [tvDescription, setTvDescription] = useState('');
    const [tvKeywords, setTvKeywords] = useState('');
    const [tvTag, setTvTag] = useState('');
    const [tvUploading, setTvUploading] = useState(false);
    const [tvExtracting, setTvExtracting] = useState(false);
    const [tvEditingId, setTvEditingId] = useState<number | null>(null);
    const [tvEditKeywords, setTvEditKeywords] = useState('');
    const [tvEditTag, setTvEditTag] = useState('');
    const tvFileInputRef = useRef<HTMLInputElement>(null);

    // 동영상 상태
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
    const [videos, setVideos] = useState<PersonaVideo[]>([]);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [isAddingVideo, setIsAddingVideo] = useState(false);
    const videoFileInputRef = useRef<HTMLInputElement>(null);
    const [playingVideo, setPlayingVideo] = useState<{ url: string; title?: string } | null>(null);

    useEffect(() => {
        settingsApi.get().then(s => setCommonInstruction(s.commonInstruction || '')).catch(() => {});
    }, []);

    useEffect(() => {
        const lv = images.find(i => i.id === selectedImageId)?.requiredLevel ?? 1;
        setPendingLevel(lv);
        setSavedLevel(false);
    }, [selectedImageId, images]);

    useEffect(() => {
        setActiveTab('info');
        setSelectedImageId(null);
        setVideos([]);
        if (selectedId === 'new') {
            setName(''); setJobTitle(''); setDescription(''); setInstruction(''); setIdentityPrompt('');
            setIconName('Bot'); setColorClass(AVAILABLE_COLORS[0].value);
            setImageUrl(''); setIsVisible(true); setShowSuccess(false); setImages([]);
        } else {
            const p = personas.find(p => p.id === selectedId);
            if (p) {
                setName(p.name); setJobTitle(p.jobTitle || ''); setDescription(p.description || '');
                setInstruction(p.systemInstruction); setIdentityPrompt(p.identityPrompt || '');
                setIconName(p.iconName || 'Bot'); setColorClass(p.colorClass || AVAILABLE_COLORS[0].value);
                setImageUrl(p.imageUrl || ''); setIsVisible(p.isVisible !== false); setShowSuccess(false);
            }
            personaImageApi.getAll(selectedId).then(setImages).catch(() => setImages([]));
            knowledgeApi.getAll(selectedId).then(setKnowledgeList).catch(() => setKnowledgeList([]));
            triggerVideoApi.getAll(selectedId).then(setTriggerVideos).catch(() => setTriggerVideos([]));
        }
    }, [selectedId, personas]);

    const handleSaveGlobal = async () => {
        setIsSavingGlobal(true);
        try {
            await settingsApi.update({ commonInstruction });
            localStorage.removeItem('settings_cache');
            setShowSavedModal(true);
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setIsSavingGlobal(false);
        }
    };

    // ── 핸들러 ────────────────────────────────────────────────

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('5MB 이하 이미지만 업로드 가능합니다.'); return; }
        setIsUploadingImage(true);
        try {
            let desc = imageDesc.trim();
            if (!desc) {
                const reader = new FileReader();
                const base64 = await new Promise<string>(resolve => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
                setImageDesc('설명 생성 중...');
                desc = await generateImageDescription(base64) || '';
                setImageDesc(desc);
            }
            const { signedUrl, publicUrl } = await personaImageApi.getSignedUrl(selectedId, file.type, file.name);
            await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            const isFirst = images.length === 0;
            const newImage = await personaImageApi.create(selectedId, publicUrl, desc, isFirst);
            setImages(prev => isFirst ? [{ ...newImage, isMain: true }, ...prev] : [...prev, newImage]);
            setImageDesc('');
            if (galleryInputRef.current) galleryInputRef.current.value = '';
            onImagesChanged?.(selectedId);
        } catch (e: any) {
            alert('이미지 업로드 실패: ' + e.message);
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleReorderImage = async (imageId: number, direction: 'left' | 'right') => {
        const idx = images.findIndex(img => img.id === imageId);
        if (direction === 'left' && idx === 0) return;
        if (direction === 'right' && idx === images.length - 1) return;
        const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
        const newImages = [...images];
        [newImages[idx], newImages[swapIdx]] = [newImages[swapIdx], newImages[idx]];
        setImages(newImages);
        try {
            await Promise.all([
                personaImageApi.updateOrder(selectedId, newImages[idx].id, idx),
                personaImageApi.updateOrder(selectedId, newImages[swapIdx].id, swapIdx),
            ]);
        } catch (e: any) {
            alert('순서 변경 실패: ' + e.message);
        }
    };

    const handleSetMain = async (imageId: number) => {
        try {
            await personaImageApi.setMain(selectedId, imageId);
            setImages(prev => prev.map(img => ({ ...img, isMain: img.id === imageId })));
        } catch (e: any) {
            alert('대표 이미지 설정 실패: ' + e.message);
        }
    };

    const handleDeleteImage = async (imageId: number) => {
        if (!window.confirm('이미지를 삭제하시겠습니까?')) return;
        try {
            await personaImageApi.delete(selectedId, imageId);
            setImages(prev => {
                const filtered = prev.filter(img => img.id !== imageId);
                if (filtered.length > 0 && !filtered.some(img => img.isMain)) filtered[0] = { ...filtered[0], isMain: true };
                return filtered;
            });
            if (selectedImageId === imageId) { setSelectedImageId(null); setVideos([]); }
            onImagesChanged?.(selectedId);
        } catch (e: any) {
            alert('이미지 삭제 실패: ' + e.message);
        }
    };

    const handleSelectImage = async (imageId: number) => {
        if (selectedImageId === imageId) { setSelectedImageId(null); setVideos([]); return; }
        setSelectedImageId(imageId);
        try { setVideos(await personaVideoApi.getAll(imageId)); } catch { setVideos([]); }
    };

    const handleAddVideo = async () => {
        if (!selectedImageId || !videoUrl.trim()) return;
        setIsAddingVideo(true);
        try {
            const video = await personaVideoApi.create(selectedImageId, { videoUrl: videoUrl.trim(), title: videoTitle.trim() || undefined });
            setVideos(prev => [...prev, video]);
            setVideoUrl(''); setVideoTitle('');
            onImagesChanged?.(selectedId);
        } catch (e: any) {
            alert('동영상 추가 실패: ' + e.message);
        } finally {
            setIsAddingVideo(false);
        }
    };

    const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedImageId) return;
        if (file.size > 20 * 1024 * 1024) { alert('20MB 이하 동영상만 업로드 가능합니다.'); return; }
        setIsAddingVideo(true);
        try {
            const { signedUrl, publicUrl } = await personaVideoApi.getSignedUrl(file.type, file.name);
            await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            const video = await personaVideoApi.create(selectedImageId, { videoUrl: publicUrl, title: videoTitle.trim() || file.name });
            setVideos(prev => [...prev, video]);
            setVideoTitle('');
            if (videoFileInputRef.current) videoFileInputRef.current.value = '';
            onImagesChanged?.(selectedId);
        } catch (e: any) {
            alert('동영상 업로드 실패: ' + e.message);
        } finally {
            setIsAddingVideo(false);
        }
    };

    const handleDeleteVideo = async (videoId: number) => {
        if (!window.confirm('동영상을 삭제하시겠습니까?')) return;
        try {
            await personaVideoApi.delete(videoId);
            setVideos(prev => prev.filter(v => v.id !== videoId));
            onImagesChanged?.(selectedId);
        } catch (e: any) {
            alert('동영상 삭제 실패: ' + e.message);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !instruction.trim()) { alert('이름과 시스템 프롬프트를 입력해주세요.'); return; }
        const isNew = selectedId === 'new';
        const idToSave = isNew ? `custom-${Date.now()}` : selectedId;
        setIsSaving(true);
        try {
            await onSave({ id: idToSave, name, jobTitle: jobTitle.trim() || undefined, description, systemInstruction: instruction, identityPrompt: identityPrompt.trim() || undefined, iconName, colorClass, imageUrl, isVisible });
            localStorage.removeItem('personas_cache');
            if (isNew) setSelectedId(idToSave);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (window.confirm(`'${name}' AI를 정말 삭제하시겠습니까?`)) {
            onDelete(selectedId);
            setSelectedId(personas[0]?.id || 'new');
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('이미지 크기는 5MB 이하로 업로드해주세요.'); return; }
        const reader = new FileReader();
        reader.onloadend = () => setImageUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const isDefaultPersona = DEFAULT_IDS.includes(selectedId);
    const activePersona = personas.find(p => p.id === selectedId);

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-900 z-40 relative animate-in fade-in duration-200">

            {/* 동영상 재생 모달 */}
            {playingVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPlayingVideo(null)}>
                    <div className="relative max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <p className="text-white text-sm font-medium truncate flex-1">{playingVideo.title}</p>
                            <button onClick={() => setPlayingVideo(null)} className="ml-3 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-1.5 rounded-lg transition-colors shrink-0">
                                <Icon name="X" size={18} />
                            </button>
                        </div>
                        <video
                            src={playingVideo.url}
                            controls
                            autoPlay
                            className="w-full rounded-xl bg-black max-h-[70vh]"
                        />
                    </div>
                </div>
            )}

            {/* 저장 완료 모달 */}
            {showSavedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-72 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <Icon name="Save" size={22} className="text-emerald-400" />
                        </div>
                        <p className="text-white font-semibold mb-1">저장되었습니다.</p>
                        <p className="text-xs text-gray-400 mb-5">공통 설정이 모든 페르소나에 적용됩니다.</p>
                        <button
                            onClick={() => { setShowSavedModal(false); setShowGlobalSettings(false); }}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-xl transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

            {/* ── 헤더 ── */}
            <header className="h-14 border-b border-gray-800 bg-gray-900/95 flex items-center justify-between px-5 shrink-0">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Icon name="Settings" size={18} className="text-blue-400" />
                    관리자 설정
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-1.5 rounded-lg transition-colors">
                    <Icon name="X" size={18} />
                </button>
            </header>

            {/* ── 바디: 좌측 사이드바 + 우측 콘텐츠 ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* 좌측: 페르소나 목록 */}
                <aside className="w-52 shrink-0 border-r border-gray-800 flex flex-col bg-gray-900/60">
                    <div className="px-4 py-3 border-b border-gray-800">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">페르소나</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {personas.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedId(p.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group
                                    ${selectedId === p.id
                                        ? `bg-gradient-to-r ${p.colorClass} text-white shadow-md`
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                    }`}
                            >
                                {p.imageUrl ? (
                                    <img
                                        src={p.imageUrl}
                                        alt={p.name}
                                        className={`w-8 h-8 rounded-lg object-cover shrink-0 border-2 transition-all ${
                                            selectedId === p.id ? 'border-white/40' : 'border-transparent'
                                        }`}
                                    />
                                ) : (
                                    <div className={`p-1.5 rounded-lg shrink-0 transition-colors
                                        ${selectedId === p.id ? 'bg-white/20' : 'bg-gray-800 group-hover:bg-gray-700'}`}>
                                        <Icon name={p.iconName} size={15} />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{p.name}</p>
                                    {p.description && (
                                        <p className={`text-[10px] truncate ${selectedId === p.id ? 'text-white/70' : 'text-gray-600'}`}>
                                            {p.description}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="p-2 border-t border-gray-800 space-y-1">
                        <button
                            onClick={() => setSelectedId('new')}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border border-dashed
                                ${selectedId === 'new'
                                    ? 'bg-gray-800 text-white border-blue-500'
                                    : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300 border-gray-700'
                                }`}
                        >
                            <Icon name="Plus" size={15} />
                            새 AI 추가
                        </button>
                        <button
                            onClick={() => setShowGlobalSettings(v => !v)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all
                                ${showGlobalSettings
                                    ? 'bg-purple-600/20 text-purple-400 border border-purple-600/40'
                                    : 'text-gray-600 hover:bg-gray-800 hover:text-gray-400'
                                }`}
                        >
                            <Icon name="Settings" size={13} />
                            공통 설정
                        </button>
                    </div>
                </aside>

                {/* 우측: 탭 + 콘텐츠 */}
                <div className="flex-1 flex flex-col overflow-hidden">

                {/* 공통 설정 패널 */}
                {showGlobalSettings && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name="Settings" size={16} className="text-purple-400" />
                                <h3 className="text-sm font-bold text-white">공통 시스템 프롬프트</h3>
                                <span className="text-xs text-gray-500">— 모든 페르소나에 자동 적용</span>
                            </div>
                            <div className="bg-purple-900/10 border border-purple-800/30 rounded-xl px-4 py-3 text-xs text-purple-300 leading-relaxed">
                                여기에 입력한 내용이 <span className="font-semibold">모든 페르소나의 행동 지침 앞</span>에 자동으로 삽입됩니다.<br />
                                사용자 요청 우선 규칙, 언어 설정, 공통 금지 사항 등에 활용하세요.
                            </div>
                            <textarea
                                value={commonInstruction}
                                onChange={e => setCommonInstruction(e.target.value)}
                                rows={12}
                                className="w-full bg-gray-800 border border-purple-900/40 rounded-xl px-3.5 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:outline-none resize-y leading-relaxed"
                                placeholder={`[사용자 요청 우선]\n- 사용자가 호칭, 말투, 역할 등을 변경 요청하면 즉시 따른다\n- 시스템 설정보다 사용자의 실시간 요청을 우선시한다\n\n[공통 규칙]\n- 항상 한국어로 대화한다`}
                            />
                            <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                                <button onClick={() => setShowGlobalSettings(false)}
                                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                                    취소
                                </button>
                                <div className="ml-auto">
                                    <button onClick={handleSaveGlobal} disabled={isSavingGlobal}
                                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium py-2 px-5 rounded-xl flex items-center transition-colors">
                                        <Icon name="Save" size={15} className="mr-2" />
                                        {isSavingGlobal ? '저장 중...' : '저장'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!showGlobalSettings && <>

                    {/* 탭 바 */}
                    {selectedId !== 'new' && (
                        <div className="border-b border-gray-800 px-6 flex shrink-0">
                            {(['info', 'gallery', 'knowledge', 'triggers'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-all
                                        ${activeTab === tab
                                            ? 'border-blue-500 text-white'
                                            : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                                        }`}
                                >
                                    {tab === 'info' ? '기본 정보' : tab === 'gallery' ? '이미지 / 동영상' : tab === 'knowledge' ? '지식 창고' : '트리거 영상'}
                                    {tab === 'gallery' && images.length > 0 && (
                                        <span className="ml-2 bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded-full">{images.length}</span>
                                    )}
                                    {tab === 'knowledge' && knowledgeList.length > 0 && (
                                        <span className="ml-2 bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded-full">{knowledgeList.length}</span>
                                    )}
                                    {tab === 'triggers' && triggerVideos.length > 0 && (
                                        <span className="ml-2 bg-purple-800 text-purple-300 text-[10px] px-1.5 py-0.5 rounded-full">{triggerVideos.length}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 콘텐츠 영역 */}
                    <div className="flex-1 overflow-y-auto">

                        {/* ── 기본 정보 탭 ── */}
                        {(activeTab === 'info' || selectedId === 'new') && (
                            <div className="max-w-2xl mx-auto p-6 space-y-6">

                                {/* 이름 + 직업 + 설명 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                                            이름 <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text" value={name} onChange={e => setName(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
                                            placeholder="예: 이서연"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">직업 / 역할</label>
                                        <input
                                            type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
                                            placeholder="예: 전문 번역가"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">짧은 설명</label>
                                    <input
                                        type="text" value={description} onChange={e => setDescription(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
                                        placeholder="예: 마케팅 카피와 전략을 기획합니다."
                                    />
                                </div>

                                {/* 아이콘 + 색상 + 프로필 이미지 */}
                                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-2">아이콘</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {AVAILABLE_ICONS.map(icon => (
                                                    <button key={icon} onClick={() => setIconName(icon)}
                                                        className={`p-2.5 rounded-xl border transition-all ${iconName === icon ? 'bg-gray-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                                                        <Icon name={icon} size={18} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-2">테마 색상</label>
                                            <div className="flex flex-wrap gap-2">
                                                {AVAILABLE_COLORS.map(color => (
                                                    <button key={color.value} onClick={() => setColorClass(color.value)} title={color.label}
                                                        className={`w-9 h-9 rounded-full border-2 transition-all bg-gradient-to-br ${color.value} ${colorClass === color.value ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105 opacity-70 hover:opacity-100'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 프로필 이미지 */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">사이드바 프로필 이미지</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center bg-gray-900 overflow-hidden relative group cursor-pointer shrink-0"
                                                onClick={() => fileInputRef.current?.click()}>
                                                {imageUrl ? (
                                                    <>
                                                        <img src={imageUrl} alt="Preview" className="w-full h-full object-contain p-0.5" />
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Icon name="Upload" size={16} className="text-white" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center text-gray-500">
                                                        <Icon name="ImageIcon" size={20} className="mb-0.5" />
                                                        <span className="text-[9px]">업로드</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                                                <p className="text-[11px] text-gray-500 mb-1">사이드바 하단에 표시됩니다. (5MB 이하)</p>
                                                {imageUrl && <button onClick={() => setImageUrl('')} className="text-[11px] text-red-400 hover:text-red-300">이미지 제거</button>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 행동 지침 */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-semibold text-gray-400">
                                            행동 지침 <span className="text-gray-500 font-normal">— 어떻게 행동할지</span>
                                            <span className="text-red-400 ml-1">*</span>
                                        </label>
                                        <button type="button" onClick={() => setShowInstructionExample(v => !v)}
                                            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                                            {showInstructionExample ? '예제 닫기 ▲' : '예제 보기 ▼'}
                                        </button>
                                    </div>
                                    {showInstructionExample && (
                                        <div className="mb-2 bg-gray-950 border border-blue-900/40 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[11px] font-medium text-blue-400">예제</span>
                                                <button type="button" onClick={() => { setInstruction(INSTRUCTION_EXAMPLE); setShowInstructionExample(false); }}
                                                    className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg transition-colors">
                                                    이 예제 사용하기
                                                </button>
                                            </div>
                                            <pre className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{INSTRUCTION_EXAMPLE}</pre>
                                        </div>
                                    )}
                                    <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={7}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none resize-y leading-relaxed"
                                        placeholder={`[역할]\n- 사용자의 질문에 친절하게 답변한다\n\n[말투]\n- 짧고 명확한 문장, 존댓말 사용`}
                                    />
                                </div>

                                {/* 정체성 */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-semibold text-gray-400">
                                            정체성 <span className="text-gray-500 font-normal">— 누구인지 (선택)</span>
                                        </label>
                                        <button type="button" onClick={() => setShowIdentityExample(v => !v)}
                                            className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors">
                                            {showIdentityExample ? '예제 닫기 ▲' : '예제 보기 ▼'}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mb-2">
                                        이미지 설명 위치에 <code className="bg-gray-700 px-1 rounded text-yellow-400">{'{imageDescription}'}</code>를 삽입하세요.
                                    </p>
                                    {showIdentityExample && (
                                        <div className="mb-2 bg-gray-950 border border-purple-900/40 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[11px] font-medium text-purple-400">예제</span>
                                                <button type="button" onClick={() => { setIdentityPrompt(IDENTITY_EXAMPLE); setShowIdentityExample(false); }}
                                                    className="text-[11px] bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg transition-colors">
                                                    이 예제 사용하기
                                                </button>
                                            </div>
                                            <pre className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{IDENTITY_EXAMPLE}</pre>
                                        </div>
                                    )}
                                    <textarea value={identityPrompt} onChange={e => setIdentityPrompt(e.target.value)} rows={4}
                                        className="w-full bg-gray-800 border border-purple-900/30 rounded-xl px-3.5 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:outline-none resize-y leading-relaxed"
                                        placeholder={`당신은 AI가 아닌 실제 인물입니다.\n{imageDescription}`}
                                    />
                                </div>

                                {/* 공개 여부 */}
                                <div className="flex items-center gap-3 p-3.5 bg-gray-800/40 rounded-xl border border-gray-700/50">
                                    <input type="checkbox" id="isVisible" checked={isVisible} onChange={e => setIsVisible(e.target.checked)}
                                        className="w-4 h-4 accent-blue-500 cursor-pointer" />
                                    <label htmlFor="isVisible" className="text-sm text-gray-300 cursor-pointer select-none">페르소나 목록에 표시</label>
                                    {!isVisible && <span className="text-xs text-yellow-500 ml-1">숨김 — 데이터 보존됨</span>}
                                </div>

                                {/* 저장 / 삭제 */}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                                    <div className="flex items-center gap-3">
                                        {selectedId !== 'new' && !isDefaultPersona && (
                                            <button onClick={handleDelete}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-4 py-2 rounded-xl transition-colors flex items-center text-sm font-medium">
                                                <Icon name="Trash2" size={15} className="mr-1.5" />삭제
                                            </button>
                                        )}
                                        {showSuccess && (
                                            <span className="text-emerald-400 flex items-center text-sm animate-in fade-in">
                                                <Icon name="Bot" size={15} className="mr-1.5" />저장되었습니다!
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={handleSave} disabled={isSaving}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium py-2 px-5 rounded-xl flex items-center transition-colors shadow-lg shadow-blue-900/20">
                                        <Icon name="Save" size={16} className="mr-2" />
                                        {isSaving ? '저장 중...' : selectedId === 'new' ? '새 AI 추가하기' : '변경사항 저장'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── 이미지 / 동영상 탭 ── */}
                        {activeTab === 'gallery' && selectedId !== 'new' && (
                            <div className="p-6">
                                {/* 업로드 폼 */}
                                <div className="flex gap-2 mb-5">
                                    <input type="text" value={imageDesc} onChange={e => setImageDesc(e.target.value)}
                                        placeholder="이미지 설명 (비워두면 AI가 자동 생성)"
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <button onClick={() => galleryInputRef.current?.click()} disabled={isUploadingImage}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shrink-0">
                                        <Icon name="Upload" size={14} />
                                        {isUploadingImage ? '업로드 중...' : '이미지 추가'}
                                    </button>
                                    <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={handleGalleryUpload} />
                                </div>

                                <div className="flex gap-5">
                                    {/* 이미지 그리드 */}
                                    <div className="flex-1 min-w-0">
                                        {images.length > 0 ? (
                                            <div className="grid grid-cols-4 gap-2">
                                                {images.map(img => (
                                                    <div key={img.id} onClick={() => handleSelectImage(img.id)}
                                                        className={`relative group rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                                                            selectedImageId === img.id ? 'border-blue-400 ring-2 ring-blue-400/30'
                                                            : img.isMain ? 'border-yellow-400' : 'border-gray-700 hover:border-gray-500'
                                                        }`}>
                                                        <img src={img.imageUrl} alt={img.description || ''} className="w-full aspect-square object-cover" />
                                                        {img.isMain && (
                                                            <span className="absolute top-1 left-1 bg-yellow-400 text-gray-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">대표</span>
                                                        )}
                                                        {selectedImageId === img.id && (
                                                            <span className="absolute top-1 right-1 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">선택</span>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                                            {!img.isMain && (
                                                                <button onClick={e => { e.stopPropagation(); handleSetMain(img.id); }}
                                                                    className="text-yellow-400 hover:text-yellow-300 text-[11px] font-medium bg-gray-900/80 px-2 py-1 rounded-lg">
                                                                    ★ 대표
                                                                </button>
                                                            )}
                                                            <button onClick={e => { e.stopPropagation(); handleDeleteImage(img.id); }}
                                                                className="text-red-400 hover:text-red-300 text-[11px] bg-gray-900/80 px-2 py-1 rounded-lg">
                                                                삭제
                                                            </button>
                                                            <div className="flex gap-1">
                                                                <button onClick={e => { e.stopPropagation(); handleReorderImage(img.id, 'left'); }}
                                                                    disabled={images.findIndex(i => i.id === img.id) === 0}
                                                                    className="text-gray-300 hover:text-white disabled:opacity-20 text-[11px] bg-gray-900/80 px-2 py-1 rounded-lg transition-colors">←</button>
                                                                <button onClick={e => { e.stopPropagation(); handleReorderImage(img.id, 'right'); }}
                                                                    disabled={images.findIndex(i => i.id === img.id) === images.length - 1}
                                                                    className="text-gray-300 hover:text-white disabled:opacity-20 text-[11px] bg-gray-900/80 px-2 py-1 rounded-lg transition-colors">→</button>
                                                            </div>
                                                        </div>
                                                        {img.description && (
                                                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] text-gray-300 px-1.5 py-1 truncate">
                                                                {img.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                                                <Icon name="ImageIcon" size={40} className="mb-3 opacity-30" />
                                                <p className="text-sm">등록된 이미지가 없습니다.</p>
                                                <p className="text-xs mt-1">위에서 이미지를 추가하세요.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* 동영상 패널 */}
                                    {selectedImageId && (
                                        <div className="w-56 shrink-0 bg-gray-800/50 border border-gray-700 rounded-2xl p-4 flex flex-col gap-3">
                                            <p className="text-xs font-semibold text-gray-300">선택된 이미지 설정</p>

                                            {/* 이미지 해제 단계 */}
                                            <div>
                                                <label className="text-[11px] text-gray-500 block mb-1">이미지 해제 단계</label>
                                                <select
                                                    value={pendingLevel}
                                                    onChange={e => { setPendingLevel(Number(e.target.value)); setSavedLevel(false); }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    {STAGES.map(s => <option key={s.stage} value={s.stage}>{s.stage}단계 · {s.name}</option>)}
                                                </select>
                                                <button
                                                    onClick={async () => {
                                                        if (!selectedImageId) return;
                                                        setSavingLevel(true);
                                                        try {
                                                            const updated = await personaImageApi.updateRequiredLevel(selectedId, selectedImageId, pendingLevel);
                                                            setImages(prev => prev.map(img => img.id === selectedImageId ? { ...img, requiredLevel: updated.requiredLevel } : img));
                                                            setSavedLevel(true);
                                                            setTimeout(() => setSavedLevel(false), 2000);
                                                        } catch (e: any) {
                                                            alert('저장 실패: ' + e.message);
                                                        } finally {
                                                            setSavingLevel(false);
                                                        }
                                                    }}
                                                    disabled={savingLevel || pendingLevel === (images.find(i => i.id === selectedImageId)?.requiredLevel ?? 1)}
                                                    className="mt-1.5 w-full text-xs py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white"
                                                >
                                                    {savingLevel ? '저장 중...' : savedLevel ? '✓ 저장됨' : '단계 저장'}
                                                </button>
                                            </div>

                                            <div className="border-t border-gray-700 pt-3">
                                                <p className="text-[11px] font-semibold text-blue-400 mb-2">연결된 동영상</p>

                                                {/* 동영상 추가 */}
                                                <div className="space-y-1.5 mb-2">
                                                    <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                                                        placeholder="동영상 URL (mp4)"
                                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                    />
                                                    <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)}
                                                        placeholder="제목 (선택)"
                                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                    />
                                                    <div className="flex gap-1">
                                                        <button onClick={handleAddVideo} disabled={isAddingVideo || !videoUrl.trim()}
                                                            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors">
                                                            <Icon name="Plus" size={11} />URL
                                                        </button>
                                                        <button onClick={() => videoFileInputRef.current?.click()} disabled={isAddingVideo}
                                                            className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors">
                                                            <Icon name="Upload" size={11} />파일
                                                        </button>
                                                        <input type="file" accept="video/*" className="hidden" ref={videoFileInputRef} onChange={handleVideoFileUpload} />
                                                    </div>
                                                    {isAddingVideo && <p className="text-[10px] text-blue-400 text-center">업로드 중...</p>}
                                                </div>

                                                {/* 동영상 목록 */}
                                                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-52">
                                                    {videos.length === 0 ? (
                                                        <p className="text-[11px] text-gray-600 text-center py-3">동영상 없음</p>
                                                    ) : videos.map(v => (
                                                        <div key={v.id} className="flex flex-col bg-gray-700/60 rounded-xl px-2.5 py-2 gap-1.5 group">
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    onClick={() => setPlayingVideo({ url: v.videoUrl, title: v.title || v.videoUrl.split('/').pop() })}
                                                                    className="flex items-center gap-1.5 flex-1 min-w-0 hover:text-blue-300 transition-colors text-left"
                                                                >
                                                                    <Icon name="Play" size={11} className="text-blue-400 shrink-0" />
                                                                    <span className="text-[11px] text-gray-300 flex-1 truncate" title={v.title || v.videoUrl}>
                                                                        {v.title || v.videoUrl.split('/').pop()}
                                                                    </span>
                                                                </button>
                                                                <button onClick={() => handleDeleteVideo(v.id)}
                                                                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                                    <Icon name="X" size={11} />
                                                                </button>
                                                            </div>
                                                            <select value={v.requiredLevel ?? 1}
                                                                onChange={async e => {
                                                                    const lv = Number(e.target.value);
                                                                    try {
                                                                        const updated = await personaVideoApi.update(v.id, { requiredLevel: lv });
                                                                        setVideos(prev => prev.map(vid => vid.id === v.id ? { ...vid, requiredLevel: updated.requiredLevel } : vid));
                                                                    } catch {}
                                                                }}
                                                                className="w-full bg-gray-600 border border-gray-500 rounded-lg px-1.5 py-0.5 text-[10px] text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                            >
                                                                {STAGES.map(s => <option key={s.stage} value={s.stage}>{s.stage}단계 · {s.name}</option>)}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── 지식 창고 탭 ── */}
                        {activeTab === 'knowledge' && selectedId !== 'new' && (
                            <div className="p-6 max-w-2xl mx-auto space-y-6">
                                {/* 업로드 폼 */}
                                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 space-y-4">
                                    <h3 className="text-sm font-bold text-white">텍스트 지식 추가</h3>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">제목 (선택)</label>
                                        <input
                                            type="text"
                                            value={knowledgeTitle}
                                            onChange={e => setKnowledgeTitle(e.target.value)}
                                            placeholder={(() => { const p = personas.find(x => x.id === selectedId); return p ? `${p.name}${p.jobTitle ? ` - ${p.jobTitle}` : ''}` : '제목 입력'; })()}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-semibold text-gray-400">내용 <span className="text-red-400">*</span></label>
                                            <label className="cursor-pointer flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                                .txt 파일 선택
                                                <input
                                                    type="file"
                                                    accept=".txt"
                                                    className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        if (!knowledgeTitle) setKnowledgeTitle(file.name.replace(/\.txt$/, ''));
                                                        const reader = new FileReader();
                                                        reader.onload = ev => setKnowledgeText(ev.target?.result as string ?? '');
                                                        reader.readAsText(file, 'UTF-8');
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        <textarea
                                            value={knowledgeText}
                                            onChange={e => setKnowledgeText(e.target.value)}
                                            placeholder="페르소나가 알아야 할 전문 지식을 입력하세요.&#10;&#10;문단을 빈 줄로 구분하면 자동으로 청크로 나뉩니다."
                                            rows={10}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">문단 기준 자동 청크 분할 (최대 600자 / 50자 오버랩)</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!knowledgeText.trim()) return;
                                            setIsUploadingKnowledge(true);
                                            try {
                                                const result = await knowledgeApi.upload(selectedId, knowledgeTitle, knowledgeText);
                                                setKnowledgeTitle('');
                                                setKnowledgeText('');
                                                const updated = await knowledgeApi.getAll(selectedId);
                                                setKnowledgeList(updated);
                                                alert(`저장 완료 — ${result.total}개 청크 생성`);
                                            } catch (e: any) {
                                                alert('저장 실패: ' + e.message);
                                            } finally {
                                                setIsUploadingKnowledge(false);
                                            }
                                        }}
                                        disabled={isUploadingKnowledge || !knowledgeText.trim()}
                                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                                    >
                                        {isUploadingKnowledge ? '처리 중...' : '저장'}
                                    </button>
                                </div>

                                {/* 저장된 문서 목록 */}
                                {knowledgeList.length > 0 ? (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold text-white">저장된 문서 ({knowledgeList.length}개)</h3>
                                        {knowledgeList.map(k => (
                                            <div key={k.sourceId ?? k.createdAt} className="bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        {k.title && <p className="text-xs font-semibold text-blue-400">{k.title}</p>}
                                                        <span className="text-[10px] text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded-full">{k.chunkCount}청크</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{k.preview}...</p>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(`"${k.title || '(제목 없음)'}" 문서 전체(${k.chunkCount}청크)를 삭제할까요?`)) return;
                                                        if (k.sourceId) {
                                                            await knowledgeApi.deleteSource(k.sourceId);
                                                        }
                                                        setKnowledgeList(prev => prev.filter(x => x.sourceId !== k.sourceId));
                                                    }}
                                                    className="shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-600 text-center py-8">아직 저장된 지식이 없습니다.</p>
                                )}
                            </div>
                        )}

                        {/* ── 트리거 영상 탭 ── */}
                        {activeTab === 'triggers' && selectedId !== 'new' && (
                            <div className="p-6 max-w-2xl mx-auto space-y-6">

                                {/* 업로드 폼 */}
                                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 space-y-4">
                                    <h3 className="text-sm font-bold text-white">트리거 영상 추가</h3>
                                    <p className="text-xs text-gray-500">채팅 중 키워드가 감지되면 자동으로 팝업 재생됩니다.</p>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">제목 <span className="text-red-400">*</span></label>
                                            <input
                                                type="text"
                                                value={tvTitle}
                                                onChange={e => setTvTitle(e.target.value)}
                                                placeholder="예: 아침 인사 반응"
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">태그 (상황/감정)</label>
                                            <input
                                                type="text"
                                                value={tvTag}
                                                onChange={e => setTvTag(e.target.value)}
                                                placeholder="예: 인사 / 밝음"
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">설명 (AI 키워드 추출에 활용)</label>
                                        <input
                                            type="text"
                                            value={tvDescription}
                                            onChange={e => setTvDescription(e.target.value)}
                                            placeholder="예: 아침 인사를 받았을 때 밝게 반응하는 영상"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-semibold text-gray-400">트리거 키워드 <span className="text-red-400">*</span></label>
                                            <button
                                                onClick={async () => {
                                                    if (!tvTitle.trim()) { alert('제목을 먼저 입력해주세요.'); return; }
                                                    setTvExtracting(true);
                                                    try {
                                                        const res = await triggerVideoApi.extractKeywords(tvTitle, tvDescription);
                                                        setTvKeywords(res.keywords.join(', '));
                                                    } catch (e: any) {
                                                        alert('키워드 추출 실패: ' + e.message);
                                                    } finally {
                                                        setTvExtracting(false);
                                                    }
                                                }}
                                                disabled={tvExtracting || !tvTitle.trim()}
                                                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
                                            >
                                                <Icon name="Bot" size={12} />
                                                {tvExtracting ? 'AI 추출 중...' : 'AI 자동 추출'}
                                            </button>
                                        </div>
                                        <textarea
                                            value={tvKeywords}
                                            onChange={e => setTvKeywords(e.target.value)}
                                            placeholder="안녕, 안녕하세요, 좋은아침, 방가워, 반가워&#10;쉼표로 구분. AI 자동 추출 후 수정 가능"
                                            rows={3}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">쉼표(,)로 구분. 직접 입력하거나 AI 자동 추출 후 수정하세요.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">영상 파일 <span className="text-red-400">*</span></label>
                                        <input ref={tvFileInputRef} type="file" accept="video/*" className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file || !tvTitle.trim() || !tvKeywords.trim()) {
                                                    alert('제목과 키워드를 먼저 입력해주세요.');
                                                    e.target.value = '';
                                                    return;
                                                }
                                                setTvUploading(true);
                                                try {
                                                    const { signedUrl, publicUrl } = await triggerVideoApi.getSignedUrl(file.type, file.name);
                                                    await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
                                                    const created = await triggerVideoApi.create({
                                                        personaId: selectedId,
                                                        videoUrl: publicUrl,
                                                        title: tvTitle.trim(),
                                                        description: tvDescription.trim() || undefined,
                                                        keywords: tvKeywords.trim(),
                                                        tag: tvTag.trim() || undefined,
                                                    });
                                                    setTriggerVideos(prev => [...prev, created]);
                                                    setTvTitle(''); setTvDescription(''); setTvKeywords(''); setTvTag('');
                                                } catch (err: any) {
                                                    alert('업로드 실패: ' + err.message);
                                                } finally {
                                                    setTvUploading(false);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => tvFileInputRef.current?.click()}
                                            disabled={tvUploading || !tvTitle.trim() || !tvKeywords.trim()}
                                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                                        >
                                            <Icon name="Upload" size={14} />
                                            {tvUploading ? '업로드 중...' : '영상 업로드 & 저장'}
                                        </button>
                                    </div>
                                </div>

                                {/* 저장된 목록 */}
                                {triggerVideos.length > 0 ? (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold text-white">등록된 트리거 영상 ({triggerVideos.length}개)</h3>
                                        {triggerVideos.map(tv => (
                                            <div key={tv.id} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 space-y-3">
                                                <div className="flex gap-3">
                                                    {/* 영상 미리보기 */}
                                                    <video
                                                        src={tv.videoUrl}
                                                        className="w-28 h-20 object-cover rounded-lg bg-black shrink-0 cursor-pointer"
                                                        onClick={e => { const v = e.currentTarget; v.paused ? v.play() : v.pause(); }}
                                                        title="클릭하여 재생/정지"
                                                        muted
                                                        preload="metadata"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-sm font-semibold text-white">{tv.title || '(제목 없음)'}</span>
                                                                    {tv.tag && <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full">{tv.tag}</span>}
                                                                </div>
                                                                {tv.description && <p className="text-xs text-gray-500 mt-0.5">{tv.description}</p>}
                                                                <p className="text-[10px] text-gray-600 mt-1 truncate">{tv.videoUrl.split('/').pop()}</p>
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    if (!confirm(`"${tv.title}" 트리거 영상을 삭제할까요?`)) return;
                                                                    await triggerVideoApi.delete(tv.id);
                                                                    setTriggerVideos(prev => prev.filter(x => x.id !== tv.id));
                                                                }}
                                                                className="shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                                                            >
                                                                <Icon name="Trash2" size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 키워드 편집 */}
                                                {tvEditingId === tv.id ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={tvEditKeywords}
                                                            onChange={e => setTvEditKeywords(e.target.value)}
                                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={tvEditTag}
                                                            onChange={e => setTvEditTag(e.target.value)}
                                                            placeholder="태그 (예: 인사 / 밝음)"
                                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={async () => {
                                                                    await triggerVideoApi.update(tv.id, { keywords: tvEditKeywords, tag: tvEditTag });
                                                                    setTriggerVideos(prev => prev.map(x => x.id === tv.id ? { ...x, keywords: tvEditKeywords, tag: tvEditTag } : x));
                                                                    setTvEditingId(null);
                                                                }}
                                                                className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                                                            >저장</button>
                                                            <button
                                                                onClick={() => setTvEditingId(null)}
                                                                className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                                                            >취소</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex flex-wrap gap-1 flex-1">
                                                            {tv.keywords.split(',').map(k => k.trim()).filter(Boolean).map((kw, i) => (
                                                                <span key={i} className="text-[10px] bg-gray-700/80 text-gray-300 px-2 py-0.5 rounded-full">{kw}</span>
                                                            ))}
                                                        </div>
                                                        <button
                                                            onClick={() => { setTvEditingId(tv.id); setTvEditKeywords(tv.keywords); setTvEditTag(tv.tag || ''); }}
                                                            className="shrink-0 text-xs text-gray-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                                                        >
                                                            <Icon name="PenLine" size={11} /> 수정
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-600 text-center py-8">등록된 트리거 영상이 없습니다.</p>
                                )}
                            </div>
                        )}

                    </div>
                </>}
                </div>
            </div>
        </div>
    );
};
