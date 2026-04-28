import React, { useState, useEffect, useRef } from 'react';
import { PersonaImage, PersonaVideo } from '../types';
import { personaVideoApi } from '../services/apiService';
import { Icon } from './Icons';
import { getStage, STAGES } from '../utils/level';

interface PersonaImageViewerProps {
    images: PersonaImage[];
    onSelectMain: (image: PersonaImage) => void;
    userXp: number;
}

export const PersonaImageViewer: React.FC<PersonaImageViewerProps> = ({ images, onSelectMain, userXp }) => {
    const [videosByImage, setVideosByImage] = useState<Record<number, PersonaVideo[]>>({});
    const [playingVideo, setPlayingVideo] = useState<PersonaVideo | null>(null);
    const [previewImage, setPreviewImage] = useState<PersonaImage | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const loadedImageIdsRef = useRef<Set<number>>(new Set());

    const userStage = getStage(userXp).stage;
    const mainImage = images.find(img => img.isMain) || images[0];

    // 잠금 해제된 이미지의 동영상 미리 로드
    useEffect(() => {
        const unlockedImages = images.filter(img => userStage >= img.requiredLevel && (img._count?.videos ?? 0) > 0);
        unlockedImages.forEach(img => {
            if (!loadedImageIdsRef.current.has(img.id)) {
                loadedImageIdsRef.current.add(img.id);
                personaVideoApi.getAll(img.id)
                    .then(vids => setVideosByImage(prev => ({ ...prev, [img.id]: vids })))
                    .catch(() => loadedImageIdsRef.current.delete(img.id));
            }
        });
    }, [images, userStage]);

    const handleImageClick = (img: PersonaImage) => {
        if (userStage < img.requiredLevel) return;
        onSelectMain(img);
        setPreviewImage(img);
    };

    const handleVideoCircleClick = (video: PersonaVideo) => {
        setPlayingVideo(video);
    };

    if (images.length === 0) return null;

    return (
        <>
            <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-800">
                <div className="flex gap-2 overflow-x-auto">
                    {images.map(img => {
                        const isLocked = userStage < img.requiredLevel;
                        const reqStageName = STAGES[img.requiredLevel - 1]?.name ?? `${img.requiredLevel}단계`;
                        const videoCount = img._count?.videos ?? 0;
                        return (
                            <div key={img.id} className="flex flex-col items-center gap-1 shrink-0">
                                {/* 이미지 썸네일 */}
                                <button
                                    onClick={() => handleImageClick(img)}
                                    className={`relative group ${isLocked ? 'cursor-not-allowed' : ''}`}
                                    title={isLocked ? `${img.requiredLevel}단계 "${reqStageName}" 달성 시 해제` : (img.description || '')}
                                >
                                    <img
                                        src={img.imageUrl}
                                        alt={img.description || ''}
                                        className={`w-14 h-14 rounded-lg object-cover border-2 transition-all ${
                                            isLocked
                                                ? 'border-gray-700 opacity-30 blur-[2px]'
                                                : img.id === mainImage?.id
                                                    ? 'border-blue-400 opacity-100'
                                                    : 'border-transparent opacity-60 group-hover:opacity-90 group-hover:border-gray-500'
                                        }`}
                                    />
                                    {/* 잠금 오버레이 */}
                                    {isLocked && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-gray-900/60">
                                            <Icon name="Lock" size={14} className="text-gray-400" />
                                            <span className="text-[9px] text-gray-400 mt-0.5">{img.requiredLevel}단계</span>
                                        </div>
                                    )}
                                </button>
                                {/* 동영상 숫자 동그라미 */}
                                {!isLocked && videoCount > 0 && (
                                    <div className="flex gap-1">
                                        {(videosByImage[img.id] ?? Array.from({ length: videoCount }, (_, i) => ({ id: `ph-${img.id}-${i}`, requiredLevel: 1 } as any))).map((v: PersonaVideo, i: number) => {
                                            const videoLocked = userStage < v.requiredLevel;
                                            return videoLocked ? (
                                                <div
                                                    key={v.id}
                                                    title={`${v.requiredLevel}단계 달성 시 해제`}
                                                    className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center opacity-40 cursor-not-allowed"
                                                >
                                                    <Icon name="Lock" size={8} className="text-gray-400" />
                                                </div>
                                            ) : (
                                                <button
                                                    key={v.id}
                                                    onClick={() => handleVideoCircleClick(v)}
                                                    className="w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-500 border-2 border-blue-500 hover:border-blue-400 flex items-center justify-center gap-0.5 transition-all shadow"
                                                    title={`동영상 ${i + 1} 재생`}
                                                >
                                                    <Icon name="Play" size={7} className="text-white ml-0.5" />
                                                    <span className="text-[9px] font-bold text-white leading-none">{i + 1}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 이미지 전체보기 모달 */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
                    onClick={() => setPreviewImage(null)}
                >
                    <img
                        src={previewImage.imageUrl}
                        alt={previewImage.description || ''}
                        className="max-w-[92vw] max-h-[88vh] rounded-2xl object-contain shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                    <button
                        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
                        onClick={() => setPreviewImage(null)}
                    >
                        <Icon name="X" size={20} />
                    </button>
                </div>
            )}

            {/* 동영상 재생 모달 */}
            {playingVideo && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setPlayingVideo(null)}
                >
                    <div
                        className="relative w-full max-w-2xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                            <span className="text-sm font-medium text-white">{playingVideo.title || '동영상'}</span>
                            <button
                                onClick={() => setPlayingVideo(null)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <Icon name="X" size={20} />
                            </button>
                        </div>
                        <video
                            ref={videoRef}
                            src={playingVideo.videoUrl}
                            controls
                            autoPlay
                            className="w-full max-h-[70vh] bg-black"
                        />
                    </div>
                </div>
            )}
        </>
    );
};
