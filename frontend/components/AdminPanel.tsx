import React, { useState, useEffect, useRef } from 'react';
import { Persona, PersonaImage, PersonaVideo } from '../types';
import { personaImageApi, personaVideoApi } from '../services/apiService';
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

// 기본 제공되는 AI는 삭제하지 못하도록 보호
const DEFAULT_IDS = ['general', 'coder', 'writer', 'translator'];

export const AdminPanel: React.FC<AdminPanelProps> = ({ personas, onSave, onDelete, onClose, onImagesChanged }) => {
    const [selectedId, setSelectedId] = useState<string>(personas[0]?.id || '');
    
    // Form states
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [instruction, setInstruction] = useState('');
    const [identityPrompt, setIdentityPrompt] = useState('');
    const [iconName, setIconName] = useState('Bot');
    const [colorClass, setColorClass] = useState(AVAILABLE_COLORS[0].value);
    const [imageUrl, setImageUrl] = useState('');
    
    const [isVisible, setIsVisible] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 이미지 갤러리 상태
    const [images, setImages] = useState<PersonaImage[]>([]);
    const [imageDesc, setImageDesc] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // 동영상 상태
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
    const [videos, setVideos] = useState<PersonaVideo[]>([]);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [isAddingVideo, setIsAddingVideo] = useState(false);
    const videoFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (selectedId === 'new') {
            setName('');
            setDescription('');
            setInstruction('');
            setIdentityPrompt('');
            setIconName('Bot');
            setColorClass(AVAILABLE_COLORS[0].value);
            setImageUrl('');
            setIsVisible(true);
            setShowSuccess(false);
            setImages([]);
        } else {
            const p = personas.find(p => p.id === selectedId);
            if (p) {
                setName(p.name);
                setDescription(p.description || '');
                setInstruction(p.systemInstruction);
                setIdentityPrompt(p.identityPrompt || '');
                setIconName(p.iconName || 'Bot');
                setColorClass(p.colorClass || AVAILABLE_COLORS[0].value);
                setImageUrl(p.imageUrl || '');
                setIsVisible(p.isVisible !== false);
                setShowSuccess(false);
            }
            personaImageApi.getAll(selectedId).then(setImages).catch(() => setImages([]));
        }
    }, [selectedId, personas]);

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('5MB 이하 이미지만 업로드 가능합니다.'); return; }
        setIsUploadingImage(true);
        try {
            // AI 설명 생성 (base64 미리보기용으로만 사용)
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

            // Signed URL 발급 → GCS 직접 업로드
            const { signedUrl, publicUrl } = await personaImageApi.getSignedUrl(selectedId, file.type, file.name);
            await fetch(signedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file,
            });

            // DB에 URL 저장
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
                if (filtered.length > 0 && !filtered.some(img => img.isMain)) {
                    filtered[0] = { ...filtered[0], isMain: true };
                }
                return filtered;
            });
            onImagesChanged?.(selectedId);
        } catch (e: any) {
            alert('이미지 삭제 실패: ' + e.message);
        }
    };

    const handleSelectImage = async (imageId: number) => {
        if (selectedImageId === imageId) {
            setSelectedImageId(null);
            setVideos([]);
            return;
        }
        setSelectedImageId(imageId);
        try {
            const data = await personaVideoApi.getAll(imageId);
            setVideos(data);
        } catch {
            setVideos([]);
        }
    };

    const handleAddVideo = async () => {
        if (!selectedImageId || !videoUrl.trim()) return;
        setIsAddingVideo(true);
        try {
            const video = await personaVideoApi.create(selectedImageId, { videoUrl: videoUrl.trim(), title: videoTitle.trim() || undefined });
            setVideos(prev => [...prev, video]);
            setVideoUrl('');
            setVideoTitle('');
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
            // Signed URL 발급 → GCS 직접 업로드
            const { signedUrl, publicUrl } = await personaVideoApi.getSignedUrl(file.type, file.name);
            await fetch(signedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file,
            });

            // DB에 URL 저장
            const video = await personaVideoApi.create(selectedImageId, {
                videoUrl: publicUrl,
                title: videoTitle.trim() || file.name,
            });
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

    const [isSaving, setIsSaving] = useState(false);
    const [showInstructionExample, setShowInstructionExample] = useState(false);
    const [showIdentityExample, setShowIdentityExample] = useState(false);

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

    const handleSave = async () => {
        if (!name.trim() || !instruction.trim()) {
            alert('이름과 시스템 프롬프트를 입력해주세요.');
            return;
        }

        const isNew = selectedId === 'new';
        const idToSave = isNew ? `custom-${Date.now()}` : selectedId;

        setIsSaving(true);
        try {
            await onSave({
                id: idToSave,
                name,
                description,
                systemInstruction: instruction,
                identityPrompt: identityPrompt.trim() || undefined,
                iconName,
                colorClass,
                imageUrl,
                isVisible,
            });

            if (isNew) {
                setSelectedId(idToSave);
            }

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (window.confirm(`'${name}' AI를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            onDelete(selectedId);
            setSelectedId(personas[0]?.id || 'new');
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("이미지 크기는 5MB 이하로 업로드해주세요.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const isDefaultPersona = DEFAULT_IDS.includes(selectedId);

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-900 z-40 relative animate-in fade-in duration-200">
            <header className="h-16 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-6 shrink-0">
                <h2 className="text-xl font-bold text-white flex items-center">
                    <Icon name="Settings" className="mr-3 text-blue-400" /> 
                    관리자 설정 (데이터베이스 연동됨)
                </h2>
                <button 
                    onClick={onClose} 
                    className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
                    title="닫기"
                >
                    <Icon name="X" size={20} />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                    
                    {/* AI Selector Tabs */}
                    <div className="mb-8">
                        <label className="block text-sm font-medium text-gray-400 mb-3">편집할 AI 선택 또는 새 AI 추가</label>
                        <div className="flex flex-wrap gap-2">
                            {personas.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedId(p.id)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center
                                        ${selectedId === p.id 
                                            ? `bg-gradient-to-r ${p.colorClass} text-white shadow-md` 
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700'
                                        }
                                    `}
                                >
                                    <Icon name={p.iconName} size={16} className="mr-2" />
                                    {p.name}
                                </button>
                            ))}
                            <button
                                onClick={() => setSelectedId('new')}
                                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center border border-dashed
                                    ${selectedId === 'new' 
                                        ? 'bg-gray-800 text-white border-blue-500 shadow-md' 
                                        : 'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-gray-600'
                                    }
                                `}
                            >
                                <Icon name="Plus" size={16} className="mr-2" />
                                새 AI 추가
                            </button>
                        </div>
                    </div>

                    {/* Edit Form */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    페르소나 이름 <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all"
                                    placeholder="예: 마케팅 전문가"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    짧은 설명
                                </label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all"
                                    placeholder="예: 마케팅 카피와 전략을 기획합니다."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    아이콘 선택
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => setIconName(icon)}
                                            className={`p-3 rounded-xl border transition-all ${
                                                iconName === icon 
                                                ? 'bg-gray-700 border-blue-500 text-white' 
                                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                                            }`}
                                        >
                                            <Icon name={icon} size={20} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    테마 색상
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => setColorClass(color.value)}
                                            className={`w-10 h-10 rounded-full border-2 transition-all bg-gradient-to-br ${color.value} ${
                                                colorClass === color.value 
                                                ? 'border-white scale-110 shadow-lg' 
                                                : 'border-transparent hover:scale-105 opacity-70 hover:opacity-100'
                                            }`}
                                            title={color.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Image Upload Section */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                AI 프로필 이미지 (선택사항)
                            </label>
                            <div className="flex items-start gap-4">
                                <div 
                                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center bg-gray-900 overflow-hidden relative group cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {imageUrl ? (
                                        <>
                                            {/* object-cover 대신 object-contain을 사용하여 이미지가 잘리지 않게 함 */}
                                            <img src={imageUrl} alt="Preview" className="w-full h-full object-contain p-1" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Icon name="Upload" size={20} className="text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center text-gray-500">
                                            <Icon name="ImageIcon" size={24} className="mb-1" />
                                            <span className="text-[10px]">업로드</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                    />
                                    <p className="text-xs text-gray-500 mb-2">
                                        AI를 대표하는 이미지를 업로드하세요. 이 이미지는 사이드바 하단에 표시됩니다. (권장: 5MB 이하)
                                    </p>
                                    {imageUrl && (
                                        <button 
                                            onClick={() => setImageUrl('')}
                                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            이미지 제거
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 이미지 갤러리 관리 */}
                        {selectedId !== 'new' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                AI 이미지 갤러리
                            </label>
                            <p className="text-xs text-gray-500 mb-3">
                                이미지를 클릭하면 연결된 동영상을 관리할 수 있습니다. 별표(★)로 대표 이미지를 설정하세요.
                            </p>

                            {/* 업로드 폼 */}
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={imageDesc}
                                    onChange={e => setImageDesc(e.target.value)}
                                    placeholder="이미지 설명 (AI에게 전달됨)"
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <button
                                    onClick={() => galleryInputRef.current?.click()}
                                    disabled={isUploadingImage}
                                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                    <Icon name="Upload" size={14} />
                                    {isUploadingImage ? '업로드 중...' : '이미지 추가'}
                                </button>
                                <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={handleGalleryUpload} />
                            </div>

                            <div className="flex gap-4">
                                {/* 이미지 목록 */}
                                <div className="flex-1">
                                    {images.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {images.map(img => (
                                                <div
                                                    key={img.id}
                                                    onClick={() => handleSelectImage(img.id)}
                                                    className={`relative group rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                                                        selectedImageId === img.id
                                                            ? 'border-blue-400 ring-2 ring-blue-400/30'
                                                            : img.isMain ? 'border-yellow-400' : 'border-gray-700 hover:border-gray-500'
                                                    }`}
                                                >
                                                    <img src={img.imageUrl} alt={img.description || ''} className="w-full aspect-square object-cover" />
                                                    {img.isMain && (
                                                        <span className="absolute top-1 left-1 bg-yellow-400 text-gray-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">대표</span>
                                                    )}
                                                    {selectedImageId === img.id && (
                                                        <span className="absolute top-1 right-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">선택됨</span>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                                        {!img.isMain && (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleSetMain(img.id); }}
                                                                className="text-yellow-400 hover:text-yellow-300 text-xs font-medium bg-gray-900/80 px-2 py-1 rounded-lg"
                                                            >
                                                                ★ 대표 설정
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleDeleteImage(img.id); }}
                                                            className="text-red-400 hover:text-red-300 text-xs bg-gray-900/80 px-2 py-1 rounded-lg"
                                                        >
                                                            삭제
                                                        </button>
                                                        {/* 순서 변경 */}
                                                        <div className="flex gap-1 mt-0.5">
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleReorderImage(img.id, 'left'); }}
                                                                disabled={images.findIndex(i => i.id === img.id) === 0}
                                                                className="text-gray-300 hover:text-white disabled:opacity-20 text-xs bg-gray-900/80 px-2 py-1 rounded-lg transition-colors"
                                                            >
                                                                ←
                                                            </button>
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleReorderImage(img.id, 'right'); }}
                                                                disabled={images.findIndex(i => i.id === img.id) === images.length - 1}
                                                                className="text-gray-300 hover:text-white disabled:opacity-20 text-xs bg-gray-900/80 px-2 py-1 rounded-lg transition-colors"
                                                            >
                                                                →
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {img.description && (
                                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-gray-300 px-1.5 py-1 truncate">
                                                            {img.description}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-600 text-center py-4">등록된 이미지가 없습니다.</p>
                                    )}
                                </div>

                                {/* 동영상 패널 */}
                                {selectedImageId && (
                                    <div className="w-52 shrink-0 bg-gray-900/60 border border-gray-700 rounded-xl p-3 flex flex-col gap-2">
                                        {/* 이미지 해제 단계 설정 */}
                                        <div className="pb-2 border-b border-gray-700">
                                            <span className="text-[11px] text-gray-400 block mb-1">이미지 해제 단계</span>
                                            <select
                                                value={images.find(i => i.id === selectedImageId)?.requiredLevel ?? 1}
                                                onChange={async e => {
                                                    const lv = Number(e.target.value);
                                                    try {
                                                        const updated = await personaImageApi.updateRequiredLevel(selectedId, selectedImageId, lv);
                                                        setImages(prev => prev.map(img => img.id === selectedImageId ? { ...img, requiredLevel: updated.requiredLevel } : img));
                                                    } catch {}
                                                }}
                                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                            >
                                                {STAGES.map(s => (
                                                    <option key={s.stage} value={s.stage}>{s.stage}단계 · {s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs font-medium text-blue-400">연결된 동영상</p>

                                        {/* 동영상 추가 폼 */}
                                        <input
                                            type="text"
                                            value={videoUrl}
                                            onChange={e => setVideoUrl(e.target.value)}
                                            placeholder="동영상 URL (mp4)"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            value={videoTitle}
                                            onChange={e => setVideoTitle(e.target.value)}
                                            placeholder="제목 (선택)"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                onClick={handleAddVideo}
                                                disabled={isAddingVideo || !videoUrl.trim()}
                                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Icon name="Plus" size={12} />
                                                URL 추가
                                            </button>
                                            <button
                                                onClick={() => videoFileInputRef.current?.click()}
                                                disabled={isAddingVideo}
                                                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Icon name="Upload" size={12} />
                                                파일 업로드
                                            </button>
                                            <input type="file" accept="video/*" className="hidden" ref={videoFileInputRef} onChange={handleVideoFileUpload} />
                                        </div>
                                        {isAddingVideo && <p className="text-[10px] text-blue-400 text-center">업로드 중...</p>}

                                        {/* 동영상 목록 */}
                                        <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto max-h-48">
                                            {videos.length === 0 ? (
                                                <p className="text-[11px] text-gray-600 text-center py-2">동영상 없음</p>
                                            ) : (
                                                videos.map(v => (
                                                    <div key={v.id} className="flex flex-col bg-gray-800 rounded-lg px-2 py-1.5 gap-1 group">
                                                        <div className="flex items-center gap-1.5">
                                                            <Icon name="Play" size={12} className="text-blue-400 shrink-0" />
                                                            <span className="text-[11px] text-gray-300 flex-1 truncate" title={v.title || v.videoUrl}>
                                                                {v.title || v.videoUrl.split('/').pop()}
                                                            </span>
                                                            <button
                                                                onClick={() => handleDeleteVideo(v.id)}
                                                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                                            >
                                                                <Icon name="X" size={12} />
                                                            </button>
                                                        </div>
                                                        <select
                                                            value={v.requiredLevel ?? 1}
                                                            onChange={async e => {
                                                                const lv = Number(e.target.value);
                                                                try {
                                                                    const updated = await personaVideoApi.update(v.id, { requiredLevel: lv });
                                                                    setVideos(prev => prev.map(vid => vid.id === v.id ? { ...vid, requiredLevel: updated.requiredLevel } : vid));
                                                                } catch {}
                                                            }}
                                                            className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-[10px] text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                        >
                                                            {STAGES.map(s => (
                                                                <option key={s.stage} value={s.stage}>{s.stage}단계 · {s.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        {/* 행동 지침 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">
                                    행동 지침 <span className="text-gray-500 font-normal">— 어떻게 행동할지</span>
                                    <span className="text-red-400 ml-1">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowInstructionExample(v => !v)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {showInstructionExample ? '예제 닫기 ▲' : '예제 보기 ▼'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">
                                역할, 말투, 응답 방식, 금지 사항 등 <strong className="text-gray-400">행동과 성격</strong>을 정의합니다.
                                "당신은 AI입니다" 같은 정체성 표현은 아래 정체성 항목에 입력하세요.
                            </p>
                            {showInstructionExample && (
                                <div className="mb-3 bg-gray-950 border border-blue-900/40 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-blue-400">예제</span>
                                        <button
                                            type="button"
                                            onClick={() => { setInstruction(INSTRUCTION_EXAMPLE); setShowInstructionExample(false); }}
                                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition-colors"
                                        >
                                            이 예제 사용하기
                                        </button>
                                    </div>
                                    <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{INSTRUCTION_EXAMPLE}</pre>
                                </div>
                            )}
                            <textarea
                                value={instruction}
                                onChange={e => setInstruction(e.target.value)}
                                rows={7}
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none resize-y transition-all leading-relaxed"
                                placeholder={`[역할]\n- 사용자의 질문에 친절하게 답변한다\n\n[말투]\n- 짧고 명확한 문장, 존댓말 사용\n\n[금지]\n- 장황한 설명 금지`}
                            />
                        </div>

                        {/* 정체성 프롬프트 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">
                                    정체성 <span className="text-gray-500 font-normal">— 누구인지</span>
                                    <span className="text-gray-500 font-normal ml-2">(선택사항)</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowIdentityExample(v => !v)}
                                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                    {showIdentityExample ? '예제 닫기 ▲' : '예제 보기 ▼'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">
                                AI가 <strong className="text-gray-400">자신을 어떤 존재로 인식</strong>할지 정의합니다.
                                이미지 설명 위치에 <code className="bg-gray-700 px-1 rounded text-yellow-400">{'{imageDescription}'}</code>를 삽입하세요.
                                비워두면 이미지가 있을 때 기본 정체성 규칙이 자동 적용됩니다.
                            </p>
                            {showIdentityExample && (
                                <div className="mb-3 bg-gray-950 border border-purple-900/40 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-purple-400">예제</span>
                                        <button
                                            type="button"
                                            onClick={() => { setIdentityPrompt(IDENTITY_EXAMPLE); setShowIdentityExample(false); }}
                                            className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-lg transition-colors"
                                        >
                                            이 예제 사용하기
                                        </button>
                                    </div>
                                    <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{IDENTITY_EXAMPLE}</pre>
                                </div>
                            )}
                            <textarea
                                value={identityPrompt}
                                onChange={e => setIdentityPrompt(e.target.value)}
                                rows={5}
                                className="w-full bg-gray-900 border border-purple-900/30 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:outline-none resize-y transition-all leading-relaxed"
                                placeholder={`당신은 AI가 아닌 실제 인물입니다.\n당신은 '이름'이라는 직업의 사람입니다.\n{imageDescription}\n"저는 AI입니다"라는 말은 절대 하지 마세요.`}
                            />
                        </div>

                        {/* 공개 여부 */}
                        <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-xl border border-gray-700/50">
                            <input
                                type="checkbox"
                                id="isVisible"
                                checked={isVisible}
                                onChange={e => setIsVisible(e.target.checked)}
                                className="w-4 h-4 accent-blue-500 cursor-pointer"
                            />
                            <label htmlFor="isVisible" className="text-sm text-gray-300 cursor-pointer select-none">
                                페르소나 목록에 표시
                            </label>
                            {!isVisible && (
                                <span className="text-xs text-yellow-500 ml-1">숨김 — 대화 데이터는 보존됩니다</span>
                            )}
                        </div>

                        <div className="pt-4 flex items-center justify-between border-t border-gray-700/50">
                            <div className="flex items-center gap-4">
                                {selectedId !== 'new' && !isDefaultPersona && (
                                    <button
                                        onClick={handleDelete}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-4 py-2.5 rounded-xl transition-colors flex items-center text-sm font-medium"
                                    >
                                        <Icon name="Trash2" size={16} className="mr-1.5" />
                                        삭제
                                    </button>
                                )}
                                {showSuccess && (
                                    <span className="text-emerald-400 flex items-center text-sm animate-in fade-in slide-in-from-left-2">
                                        <Icon name="Bot" size={16} className="mr-1.5" />
                                        DB에 저장되었습니다!
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 px-6 rounded-xl flex items-center transition-colors shadow-lg shadow-blue-900/20"
                            >
                                <Icon name="Save" size={18} className="mr-2" />
                                {isSaving ? '저장 중...' : (selectedId === 'new' ? '새 AI 추가하기' : '변경사항 저장')}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
