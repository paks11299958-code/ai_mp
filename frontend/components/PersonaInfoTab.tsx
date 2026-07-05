import React, { useState, useEffect, useRef } from 'react';
import { Persona, Category } from '../types';
import { personaApi, adminApi, categoryApi } from '../services/apiService';
import { Icon } from './Icons';
import { FEATURE_REGISTRY } from '../personaFeatures';

interface PersonaInfoTabProps {
    selectedId: string;
    personas: Persona[];
    categories: Category[];
    isDefaultPersona: boolean;
    onSave: (persona: Persona) => Promise<void>;
    onDelete: (id: string) => void;
    onSelectId: (id: string) => void;
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

export const PersonaInfoTab: React.FC<PersonaInfoTabProps> = ({
    selectedId,
    personas,
    categories,
    isDefaultPersona,
    onSave,
    onDelete,
    onSelectId,
}) => {
    const [name, setName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instruction, setInstruction] = useState('');
    const [identityPrompt, setIdentityPrompt] = useState('');
    const [quickMenuJson, setQuickMenuJson] = useState('');
    const [iconName, setIconName] = useState('Bot');
    const [colorClass, setColorClass] = useState(AVAILABLE_COLORS[0].value);
    const [imageUrl, setImageUrl] = useState('');
    const [introVideoUrl, setIntroVideoUrl] = useState('');
    const [isUploadingIntroVideo, setIsUploadingIntroVideo] = useState(false);
    const introVideoInputRef = useRef<HTMLInputElement>(null);
    const [starVideoUrl, setStarVideoUrl] = useState('');
    const [isUploadingStarVideo, setIsUploadingStarVideo] = useState(false);
    const starVideoInputRef = useRef<HTMLInputElement>(null);
    const [faceReadingBgUrl, setFaceReadingBgUrl] = useState('');
    const [isUploadingFaceReadingBg, setIsUploadingFaceReadingBg] = useState(false);
    const faceReadingBgInputRef = useRef<HTMLInputElement>(null);
    const [chatBgUrls, setChatBgUrls] = useState<string[]>([]);
    const [isUploadingChatBg, setIsUploadingChatBg] = useState(false);
    const chatBgInputRef = useRef<HTMLInputElement>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [useGrounding, setUseGrounding] = useState(false);
    const [features, setFeatures] = useState<string[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showInstructionExample, setShowInstructionExample] = useState(false);
    const [showIdentityExample, setShowIdentityExample] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // 페르소나 반자동 생성
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [generateNote, setGenerateNote] = useState<string | null>(null);
    // AI 추천 카테고리(미지정 생성 시) + 이 화면에서 방금 만든 카테고리(부모 목록 갱신 전 표시용)
    const [suggestedCat, setSuggestedCat] = useState<{ name: string; isNew: boolean } | null>(null);
    const [localCat, setLocalCat] = useState<Category | null>(null);

    const handleAutoGenerate = async () => {
        if (!name.trim()) { setGenerateError('먼저 페르소나 이름을 입력해 주세요.'); return; }
        setIsGenerating(true); setGenerateError(null); setGenerateNote(null);
        try {
            const r = await adminApi.generatePersona({ name: name.trim(), jobTitle: jobTitle.trim() || undefined, categoryId: selectedCategoryId });
            if (r.description) setDescription(r.description);
            if (r.systemInstruction) setInstruction(r.systemInstruction);
            if (r.identityPrompt) setIdentityPrompt(r.identityPrompt);
            if (r.iconName) setIconName(r.iconName);
            if (r.colorClass) setColorClass(r.colorClass);
            const ex = r.usedExamples?.length ? ` (참고: ${r.usedExamples.join(', ')})` : '';
            setGenerateNote(`✨ AI가 채웠어요. 항목별로 검토·수정 후 저장하세요.${ex}`);
            // 카테고리 미지정이었으면 AI 추천 표시(기존이면 바로 선택, 신규면 버튼으로 생성)
            if (r.suggestedCategory) {
                const existing = categories.find(c => c.name === r.suggestedCategory);
                if (existing) { setSelectedCategoryId(existing.id); setSuggestedCat(null); }
                else setSuggestedCat({ name: r.suggestedCategory, isNew: !!r.suggestedCategoryIsNew });
            }
        } catch (e: any) {
            setGenerateError(e?.message || 'AI 생성에 실패했어요. 다시 시도해 주세요.');
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (selectedId === 'new') {
            setName(''); setJobTitle(''); setDescription(''); setInstruction(''); setIdentityPrompt('');
            setIconName('Bot'); setColorClass(AVAILABLE_COLORS[0].value);
            setImageUrl(''); setIntroVideoUrl(''); setStarVideoUrl(''); setFaceReadingBgUrl('');
            setChatBgUrls([]); setQuickMenuJson(''); setIsVisible(true); setUseGrounding(false);
            setFeatures([]);
            setSelectedCategoryId(null); setShowSuccess(false);
        } else {
            const p = personas.find(p => p.id === selectedId);
            if (p) {
                setName(p.name); setJobTitle(p.jobTitle || ''); setDescription(p.description || '');
                setInstruction(p.systemInstruction); setIdentityPrompt(p.identityPrompt || '');
                setIconName(p.iconName || 'Bot'); setColorClass(p.colorClass || AVAILABLE_COLORS[0].value);
                setImageUrl(p.imageUrl || ''); setIntroVideoUrl(p.introVideoUrl || '');
                setStarVideoUrl(p.starVideoUrl || ''); setFaceReadingBgUrl(p.faceReadingBgUrl || '');
                try { setChatBgUrls(p.chatBgUrl ? (p.chatBgUrl.startsWith('[') ? JSON.parse(p.chatBgUrl) : [p.chatBgUrl]) : []); }
                catch { setChatBgUrls(p.chatBgUrl ? [p.chatBgUrl] : []); }
                setQuickMenuJson(p.quickMenuJson || ''); setIsVisible(p.isVisible !== false); setUseGrounding(p.useGrounding ?? false);
                try { const f = p.features ? JSON.parse(p.features) : []; setFeatures(Array.isArray(f) ? f : []); } catch { setFeatures([]); }
                setSelectedCategoryId(p.categoryId ?? null); setShowSuccess(false);
            }
        }
    }, [selectedId, personas]);

    const handleSave = async () => {
        if (!name.trim() || !instruction.trim()) { alert('이름과 시스템 프롬프트를 입력해주세요.'); return; }
        const isNew = selectedId === 'new';
        const idToSave = isNew ? `custom-${Date.now()}` : selectedId;
        setIsSaving(true); setSaveError(null);
        try {
            const chatBgUrlValue = chatBgUrls.length ? JSON.stringify(chatBgUrls) : undefined;
            await onSave({ id: idToSave, name, jobTitle: jobTitle.trim() || undefined, description, systemInstruction: instruction, identityPrompt: identityPrompt.trim() || undefined, iconName, colorClass, imageUrl, introVideoUrl: introVideoUrl.trim() || undefined, starVideoUrl: starVideoUrl.trim() || undefined, faceReadingBgUrl: faceReadingBgUrl.trim() || undefined, chatBgUrl: chatBgUrlValue, quickMenuJson: quickMenuJson.trim() || undefined, isVisible, useGrounding, features: JSON.stringify(features), categoryId: selectedCategoryId });
            localStorage.removeItem('personas_cache');
            if (isNew) onSelectId(idToSave);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (e: any) {
            setSaveError(e.message || '저장 중 오류가 발생했습니다.');
            setTimeout(() => setSaveError(null), 4000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (window.confirm(`'${name}' AI를 정말 삭제하시겠습니까?`)) {
            onDelete(selectedId);
        }
    };

    const handleIntroVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 200 * 1024 * 1024) { alert('영상 크기는 200MB 이하로 업로드해주세요.'); return; }
        if (selectedId === 'new') { alert('먼저 페르소나를 저장한 후 영상을 업로드해주세요.'); return; }
        setIsUploadingIntroVideo(true);
        try {
            const { signedUrl, publicUrl } = await personaApi.getIntroVideoUploadUrl(selectedId, file.type);
            const putRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            if (!putRes.ok) throw new Error(`GCS 업로드 실패 (${putRes.status})`);
            const saved = await personaApi.saveIntroVideoUrl(selectedId, publicUrl);
            setIntroVideoUrl(saved.introVideoUrl || '');
            alert('영상 업로드가 완료됐습니다.');
        } catch { alert('영상 업로드에 실패했습니다.'); }
        finally { setIsUploadingIntroVideo(false); }
    };

    const handleRemoveIntroVideo = async () => {
        if (!window.confirm('인트로 영상을 삭제하시겠습니까?')) return;
        try { await personaApi.deleteIntroVideo(selectedId); setIntroVideoUrl(''); }
        catch { alert('삭제에 실패했습니다.'); }
    };

    const handleStarVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 200 * 1024 * 1024) { alert('영상 크기는 200MB 이하로 업로드해주세요.'); return; }
        if (selectedId === 'new') { alert('먼저 페르소나를 저장한 후 영상을 업로드해주세요.'); return; }
        setIsUploadingStarVideo(true);
        try {
            const { signedUrl, publicUrl } = await personaApi.getStarVideoUploadUrl(selectedId, file.type);
            const putRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            if (!putRes.ok) throw new Error(`GCS 업로드 실패 (${putRes.status})`);
            const saved = await personaApi.saveStarVideoUrl(selectedId, publicUrl);
            setStarVideoUrl(saved.starVideoUrl || '');
            alert('영상 업로드가 완료됐습니다.');
        } catch { alert('영상 업로드에 실패했습니다.'); }
        finally { setIsUploadingStarVideo(false); }
    };

    const handleRemoveStarVideo = async () => {
        if (!window.confirm('별스타 감사 영상을 삭제하시겠습니까?')) return;
        try { await personaApi.deleteStarVideo(selectedId); setStarVideoUrl(''); }
        catch { alert('삭제에 실패했습니다.'); }
    };

    const handleFaceReadingBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드할 수 있습니다.'); return; }
        if (file.size > 10 * 1024 * 1024) { alert('배경 이미지는 10MB 이하로 업로드해주세요.'); return; }
        if (selectedId === 'new') { alert('먼저 페르소나를 저장한 후 업로드해주세요.'); return; }
        setIsUploadingFaceReadingBg(true);
        try {
            const { signedUrl, publicUrl } = await personaApi.getFaceReadingBgUploadUrl(selectedId, file.type);
            const putRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            if (!putRes.ok) throw new Error('업로드 실패');
            const saved = await personaApi.saveFaceReadingBgUrl(selectedId, publicUrl);
            setFaceReadingBgUrl(saved.faceReadingBgUrl || '');
        } catch { alert('업로드에 실패했습니다.'); }
        finally { setIsUploadingFaceReadingBg(false); e.target.value = ''; }
    };

    const handleRemoveFaceReadingBg = async () => {
        if (!window.confirm('관상 보고서 배경 이미지를 삭제하시겠습니까?')) return;
        try { await personaApi.deleteFaceReadingBg(selectedId); setFaceReadingBgUrl(''); }
        catch { alert('삭제에 실패했습니다.'); }
    };

    const handleChatBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert('배경 이미지는 10MB 이하로 업로드해주세요.'); return; }
        if (selectedId === 'new') { alert('먼저 페르소나를 저장한 후 업로드해주세요.'); return; }
        if (chatBgUrls.length >= 5) { alert('배경 이미지는 최대 5개까지 등록할 수 있습니다.'); return; }
        setIsUploadingChatBg(true);
        try {
            const { signedUrl, publicUrl } = await personaApi.getChatBgUploadUrl(selectedId, file.type);
            const putRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            if (!putRes.ok) throw new Error(`GCS 업로드 실패 (${putRes.status})`);
            const newUrls = [...chatBgUrls, publicUrl];
            await personaApi.saveChatBgUrl(selectedId, JSON.stringify(newUrls));
            setChatBgUrls(newUrls);
        } catch { alert('배경 이미지 업로드에 실패했습니다.'); }
        finally { setIsUploadingChatBg(false); if (chatBgInputRef.current) chatBgInputRef.current.value = ''; }
    };

    const handleRemoveChatBgItem = async (url: string) => {
        if (!window.confirm('이 배경 이미지를 삭제하시겠습니까?')) return;
        try {
            const updated = await personaApi.removeChatBgItem(selectedId, url);
            try { setChatBgUrls(updated.chatBgUrl ? (updated.chatBgUrl.startsWith('[') ? JSON.parse(updated.chatBgUrl) : [updated.chatBgUrl]) : []); }
            catch { setChatBgUrls([]); }
        } catch { alert('삭제에 실패했습니다.'); }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('이미지 크기는 5MB 이하로 업로드해주세요.'); return; }
        const reader = new FileReader();
        reader.onloadend = () => setImageUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    return (
        <>
            {showSuccess && (
                <div className="fixed top-5 right-5 z-[200] bg-gray-900 border border-emerald-600 rounded-xl px-4 py-3 flex items-center gap-2 shadow-2xl">
                    <Icon name="CheckCircle" size={16} className="text-emerald-400" />
                    <span className="text-white text-sm font-semibold">저장되었습니다!</span>
                </div>
            )}
            {saveError && (
                <div className="fixed top-5 right-5 z-[200] bg-gray-900 border border-red-500 rounded-xl px-4 py-3 flex items-center gap-2 shadow-2xl">
                    <Icon name="AlertCircle" size={16} className="text-red-400" />
                    <span className="text-white text-sm font-semibold">저장 실패: {saveError}</span>
                </div>
            )}

            <div className="max-w-2xl mx-auto p-6 space-y-6">

                {/* 이름 + 직업 */}
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

                {/* 카테고리 */}
                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">카테고리</label>
                    <select
                        value={selectedCategoryId ?? ''}
                        onChange={e => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
                    >
                        <option value="">미분류</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                        {localCat && !categories.some(c => c.id === localCat.id) && (
                            <option value={localCat.id}>{localCat.name}</option>
                        )}
                    </select>
                    {suggestedCat && (
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-purple-300">🤖 AI 추천 카테고리: {suggestedCat.name}</span>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const created = await categoryApi.create(suggestedCat.name);
                                        setLocalCat(created);
                                        setSelectedCategoryId(created.id);
                                        setSuggestedCat(null);
                                    } catch { setGenerateError('카테고리 생성에 실패했어요.'); }
                                }}
                                className="text-[11px] px-2 py-0.5 rounded bg-purple-600 text-white hover:bg-purple-700"
                            >
                                ➕ 만들고 선택
                            </button>
                        </div>
                    )}
                </div>

                {/* AI 반자동 생성 — 이름·직업·카테고리만 넣고 누르면 아래 텍스트 필드를 AI가 채움 */}
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/40 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-purple-200">✨ AI로 채우기</div>
                            <div className="text-xs text-gray-400 mt-0.5">이름·직업·카테고리를 넣고 누르면 소개·시스템 프롬프트·정체성·아이콘/색상을 AI가 만들어요. (이미지·퀵메뉴는 직접)</div>
                        </div>
                        <button
                            type="button"
                            onClick={handleAutoGenerate}
                            disabled={isGenerating}
                            className="shrink-0 inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all"
                        >
                            {isGenerating ? '✨ 생성 중…' : '✨ AI로 채우기'}
                        </button>
                    </div>
                    {generateNote && <div className="text-xs text-emerald-300 mt-2.5">{generateNote}</div>}
                    {generateError && <div className="text-xs text-red-400 mt-2.5">⚠ {generateError}</div>}
                </div>

                {/* 짧은 설명 */}
                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">짧은 설명</label>
                    <input
                        type="text" value={description} onChange={e => setDescription(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
                        placeholder="예: 마케팅 카피와 전략을 기획합니다."
                    />
                </div>

                {/* 아이콘 + 색상 + 미디어 */}
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

                    {/* 인트로 영상 */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2">인트로 영상</label>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center bg-gray-900 overflow-hidden relative group cursor-pointer shrink-0"
                                onClick={() => !isUploadingIntroVideo && introVideoInputRef.current?.click()}
                            >
                                {isUploadingIntroVideo ? (
                                    <Icon name="Loader" size={20} className="text-gray-400 animate-spin" />
                                ) : introVideoUrl ? (
                                    <>
                                        <Icon name="Video" size={20} className="text-blue-400" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Icon name="Upload" size={16} className="text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500">
                                        <Icon name="Video" size={20} className="mb-0.5" />
                                        <span className="text-[9px]">업로드</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <input type="file" accept="video/*" className="hidden" ref={introVideoInputRef} onChange={handleIntroVideoUpload} />
                                <p className="text-[11px] text-gray-500 mb-1">채팅 진입 전 영상이 먼저 표시됩니다. (200MB 이하)</p>
                                {introVideoUrl && (
                                    <div className="flex flex-col gap-1">
                                        <a href={introVideoUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-[10px] text-gray-500 hover:text-blue-400 break-all max-w-[200px] line-clamp-2 transition-colors">{introVideoUrl}</a>
                                        <button onClick={handleRemoveIntroVideo} className="text-[11px] text-red-400 hover:text-red-300 text-left">영상 제거</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 별스타 감사 영상 */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2">별스타 감사 영상 <span className="text-gray-600 font-normal">(100개 이상 전송 시 재생)</span></label>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-16 h-16 rounded-xl border-2 border-dashed border-yellow-600/50 flex items-center justify-center bg-gray-900 overflow-hidden relative group cursor-pointer shrink-0"
                                onClick={() => !isUploadingStarVideo && starVideoInputRef.current?.click()}
                            >
                                {isUploadingStarVideo ? (
                                    <Icon name="Loader" size={20} className="text-gray-400 animate-spin" />
                                ) : starVideoUrl ? (
                                    <>
                                        <Icon name="Star" size={20} className="text-yellow-400" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Icon name="Upload" size={16} className="text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500">
                                        <Icon name="Star" size={20} className="mb-0.5" />
                                        <span className="text-[9px]">업로드</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <input type="file" accept="video/*" className="hidden" ref={starVideoInputRef} onChange={handleStarVideoUpload} />
                                <p className="text-[11px] text-gray-500 mb-1">별스타 100개 이상 전송 시 전체화면으로 재생됩니다. (200MB 이하)</p>
                                {starVideoUrl && (
                                    <div className="flex flex-col gap-1">
                                        <a href={starVideoUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-[10px] text-gray-500 hover:text-yellow-400 break-all max-w-[200px] line-clamp-2 transition-colors">{starVideoUrl}</a>
                                        <button onClick={handleRemoveStarVideo} className="text-[11px] text-red-400 hover:text-red-300 text-left">영상 제거</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 관상 보고서 배경 이미지 */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2">
                            관상 보고서 배경 이미지 <span className="text-gray-600 font-normal">(관상 분석 결과 카드 배경)</span>
                        </label>
                        <div className="flex items-start gap-3">
                            <div
                                className="relative w-24 h-16 rounded-xl border border-gray-600 overflow-hidden cursor-pointer group flex items-center justify-center bg-gray-800"
                                style={faceReadingBgUrl ? { backgroundImage: `url(${faceReadingBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                                onClick={() => !isUploadingFaceReadingBg && faceReadingBgInputRef.current?.click()}
                            >
                                {isUploadingFaceReadingBg ? (
                                    <div className="w-4 h-4 border-2 border-amber-400/60 border-t-amber-400 rounded-full animate-spin" />
                                ) : faceReadingBgUrl ? (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Icon name="Upload" size={16} className="text-white" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500">
                                        <Icon name="Image" size={20} className="mb-0.5" />
                                        <span className="text-[9px]">업로드</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <input type="file" accept="image/*" className="hidden" ref={faceReadingBgInputRef} onChange={handleFaceReadingBgUpload} />
                                <p className="text-[11px] text-gray-500 mb-1">관상 분석 결과 카드의 배경으로 사용됩니다. (10MB 이하)</p>
                                {faceReadingBgUrl && (
                                    <div className="flex flex-col gap-1">
                                        <a href={faceReadingBgUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-[10px] text-gray-500 hover:text-amber-400 break-all max-w-[200px] line-clamp-2 transition-colors">{faceReadingBgUrl}</a>
                                        <button onClick={handleRemoveFaceReadingBg} className="text-[11px] text-red-400 hover:text-red-300 text-left">배경 제거</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 채팅 배경 이미지 */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2">
                            채팅 배경 이미지 <span className="text-gray-600 font-normal">({chatBgUrls.length}/5 · 채팅 진입 시 랜덤 적용)</span>
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {chatBgUrls.map((url, idx) => (
                                <div key={idx} className="relative w-16 h-16 rounded-xl border border-gray-600 overflow-hidden group">
                                    <img src={url} alt={`bg-${idx + 1}`} className="w-full h-full object-cover" />
                                    <button onClick={() => handleRemoveChatBgItem(url)}
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Icon name="Trash2" size={16} className="text-red-400" />
                                    </button>
                                </div>
                            ))}
                            {chatBgUrls.length < 5 && (
                                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center bg-gray-900 cursor-pointer hover:border-gray-400 transition-colors"
                                    onClick={() => !isUploadingChatBg && chatBgInputRef.current?.click()}>
                                    {isUploadingChatBg ? (
                                        <span className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                                    ) : (
                                        <div className="flex flex-col items-center text-gray-500">
                                            <Icon name="Plus" size={20} />
                                            <span className="text-[9px] mt-0.5">추가</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <input type="file" accept="image/*" className="hidden" ref={chatBgInputRef} onChange={handleChatBgUpload} />
                        <p className="text-[10px] text-gray-600 mt-2">10MB 이하 · 이미지 위에 마우스를 올리면 제거 버튼이 표시됩니다.</p>
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

                {/* 퀵 메뉴 */}
                <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                        퀵 메뉴 설정 <span className="text-gray-500 font-normal">— 채팅 입력창 위 버튼 (선택)</span>
                    </label>
                    <textarea value={quickMenuJson} onChange={e => setQuickMenuJson(e.target.value)} rows={6}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-3 text-xs text-gray-300 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none resize-y leading-relaxed"
                        placeholder={`{\n  "menus": [\n    { "label": "💰 금전/사업", "prompt": "금전/사업 운을 봐주세요." },\n    { "label": "❤️ 연애/궁합", "prompt": "연애/궁합을 봐주세요." }\n  ],\n  "useBirthInfo": true\n}`}
                    />
                    <p className="text-[11px] text-gray-500 mt-1">useBirthInfo: true 이면 메뉴 클릭 시 이름/생년월일/태어난시 입력 폼이 표시됩니다.</p>
                </div>

                {/* 공개 여부 */}
                <div className="flex items-center gap-3 p-3.5 bg-gray-800/40 rounded-xl border border-gray-700/50">
                    <input type="checkbox" id="isVisible" checked={isVisible} onChange={e => setIsVisible(e.target.checked)}
                        className="w-4 h-4 accent-blue-500 cursor-pointer" />
                    <label htmlFor="isVisible" className="text-sm text-gray-300 cursor-pointer select-none">페르소나 목록에 표시</label>
                    {!isVisible && <span className="text-xs text-yellow-500 ml-1">숨김 — 데이터 보존됨</span>}
                </div>

                {/* Google Search Grounding */}
                <div className="flex items-center gap-3 p-3.5 bg-gray-800/40 rounded-xl border border-gray-700/50">
                    <input type="checkbox" id="useGrounding" checked={useGrounding} onChange={e => setUseGrounding(e.target.checked)}
                        className="w-4 h-4 accent-green-500 cursor-pointer" />
                    <label htmlFor="useGrounding" className="text-sm text-gray-300 cursor-pointer select-none">Google Search Grounding 사용</label>
                    {useGrounding && <span className="text-xs text-green-400 ml-1">실시간 검색 활성화</span>}
                </div>

                {/* 활성 기능 (채팅 화면 기능 버튼) */}
                <div className="p-3.5 bg-gray-800/40 rounded-xl border border-gray-700/50">
                    <div className="text-sm text-gray-300 mb-1">활성 기능</div>
                    <div className="text-xs text-gray-500 mb-3">이 페르소나의 채팅 화면에 표시할 기능 버튼을 선택하세요. (이름과 무관하게 동작)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {FEATURE_REGISTRY.map(feat => {
                            const checked = features.includes(feat.key);
                            return (
                                <label key={feat.key}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${checked ? 'bg-blue-500/15 border-blue-500/50 text-blue-300' : 'bg-gray-900/30 border-gray-700/50 text-gray-400 hover:border-gray-600'}`}>
                                    <input type="checkbox" checked={checked}
                                        onChange={e => setFeatures(prev => e.target.checked ? [...prev, feat.key] : prev.filter(k => k !== feat.key))}
                                        className="w-4 h-4 accent-blue-500 cursor-pointer" />
                                    <span className="select-none">{feat.label}</span>
                                </label>
                            );
                        })}
                    </div>
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
                    </div>
                    <button onClick={handleSave} disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium py-2 px-5 rounded-xl flex items-center transition-colors shadow-lg shadow-blue-900/20">
                        <Icon name="Save" size={16} className="mr-2" />
                        {isSaving ? '저장 중...' : selectedId === 'new' ? '새 AI 추가하기' : '변경사항 저장'}
                    </button>
                </div>
            </div>
        </>
    );
};
