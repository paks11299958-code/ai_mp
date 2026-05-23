import React, { useState, useEffect, useRef } from 'react';
import { PersonaImage, PersonaVideo } from '../types';
import { personaImageApi, personaVideoApi } from '../services/apiService';
import { STAGES } from '../utils/level';
import { generateImageDescription } from '../services/geminiService';
import { Icon } from './Icons';

interface PersonaGalleryTabProps {
    personaId: string;
    onImagesChanged?: (personaId: string) => void;
}

export const PersonaGalleryTab: React.FC<PersonaGalleryTabProps> = ({ personaId, onImagesChanged }) => {
    const [images, setImages] = useState<PersonaImage[]>([]);
    const [imageDesc, setImageDesc] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
    const [pendingLevel, setPendingLevel] = useState(1);
    const [savingLevel, setSavingLevel] = useState(false);
    const [savedLevel, setSavedLevel] = useState(false);
    const [videos, setVideos] = useState<PersonaVideo[]>([]);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [isAddingVideo, setIsAddingVideo] = useState(false);
    const videoFileInputRef = useRef<HTMLInputElement>(null);
    const [playingVideo, setPlayingVideo] = useState<{ url: string; title?: string } | null>(null);

    useEffect(() => {
        setSelectedImageId(null);
        setVideos([]);
        personaImageApi.getAll(personaId).then(setImages).catch(() => setImages([]));
    }, [personaId]);

    useEffect(() => {
        const lv = images.find(i => i.id === selectedImageId)?.requiredLevel ?? 1;
        setPendingLevel(lv);
        setSavedLevel(false);
    }, [selectedImageId]);

    useEffect(() => {
        if (!selectedImageId) return;
        const lv = images.find(i => i.id === selectedImageId)?.requiredLevel ?? 1;
        setPendingLevel(lv);
    }, [images]);

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
            const { signedUrl, publicUrl } = await personaImageApi.getSignedUrl(personaId, file.type, file.name);
            await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            const isFirst = images.length === 0;
            const newImage = await personaImageApi.create(personaId, publicUrl, desc, isFirst);
            setImages(prev => isFirst ? [{ ...newImage, isMain: true }, ...prev] : [...prev, newImage]);
            setImageDesc('');
            if (galleryInputRef.current) galleryInputRef.current.value = '';
            onImagesChanged?.(personaId);
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
                personaImageApi.updateOrder(personaId, newImages[idx].id, idx),
                personaImageApi.updateOrder(personaId, newImages[swapIdx].id, swapIdx),
            ]);
        } catch (e: any) { alert('순서 변경 실패: ' + e.message); }
    };

    const handleSetMain = async (imageId: number) => {
        try {
            await personaImageApi.setMain(personaId, imageId);
            setImages(prev => prev.map(img => ({ ...img, isMain: img.id === imageId })));
        } catch (e: any) { alert('대표 이미지 설정 실패: ' + e.message); }
    };

    const handleDeleteImage = async (imageId: number) => {
        if (!window.confirm('이미지를 삭제하시겠습니까?')) return;
        try {
            await personaImageApi.delete(personaId, imageId);
            setImages(prev => {
                const filtered = prev.filter(img => img.id !== imageId);
                if (filtered.length > 0 && !filtered.some(img => img.isMain)) filtered[0] = { ...filtered[0], isMain: true };
                return filtered;
            });
            if (selectedImageId === imageId) { setSelectedImageId(null); setVideos([]); }
            onImagesChanged?.(personaId);
        } catch (e: any) { alert('이미지 삭제 실패: ' + e.message); }
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
            onImagesChanged?.(personaId);
        } catch (e: any) { alert('동영상 추가 실패: ' + e.message); }
        finally { setIsAddingVideo(false); }
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
            onImagesChanged?.(personaId);
        } catch (e: any) { alert('동영상 업로드 실패: ' + e.message); }
        finally { setIsAddingVideo(false); }
    };

    const handleDeleteVideo = async (videoId: number) => {
        if (!window.confirm('동영상을 삭제하시겠습니까?')) return;
        try {
            await personaVideoApi.delete(videoId);
            setVideos(prev => prev.filter(v => v.id !== videoId));
            onImagesChanged?.(personaId);
        } catch (e: any) { alert('동영상 삭제 실패: ' + e.message); }
    };

    return (
        <div className="p-6">
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
                        <video src={playingVideo.url} controls autoPlay className="w-full rounded-xl bg-black max-h-[70vh]" />
                    </div>
                </div>
            )}

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
                                        const updated = await personaImageApi.updateRequiredLevel(personaId, selectedImageId, pendingLevel);
                                        setImages(prev => prev.map(img => img.id === selectedImageId ? { ...img, requiredLevel: updated.requiredLevel } : img));
                                        setSavedLevel(true);
                                        onImagesChanged?.(personaId);
                                        setTimeout(() => setSavedLevel(false), 2000);
                                    } catch (e: any) { alert('저장 실패: ' + e.message); }
                                    finally { setSavingLevel(false); }
                                }}
                                disabled={savingLevel || pendingLevel === (images.find(i => i.id === selectedImageId)?.requiredLevel ?? 1)}
                                className="mt-1.5 w-full text-xs py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white"
                            >
                                {savingLevel ? '저장 중...' : savedLevel ? '✓ 저장됨' : '단계 저장'}
                            </button>
                        </div>

                        <div className="border-t border-gray-700 pt-3">
                            <p className="text-[11px] font-semibold text-blue-400 mb-2">연결된 동영상</p>
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
    );
};
