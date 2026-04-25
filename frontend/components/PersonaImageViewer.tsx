import React, { useState, useEffect, useRef } from 'react';
import { PersonaImage, PersonaVideo } from '../types';
import { personaVideoApi } from '../services/apiService';
import { Icon } from './Icons';

interface PersonaImageViewerProps {
    images: PersonaImage[];
    onSelectMain: (image: PersonaImage) => void;
}

export const PersonaImageViewer: React.FC<PersonaImageViewerProps> = ({ images, onSelectMain }) => {
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
    const [videos, setVideos] = useState<PersonaVideo[]>([]);
    const [playingVideo, setPlayingVideo] = useState<PersonaVideo | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const mainImage = images.find(img => img.isMain) || images[0];

    // 이미지 선택 시 동영상 로드
    useEffect(() => {
        if (!selectedImageId) { setVideos([]); return; }
        personaVideoApi.getAll(selectedImageId).then(setVideos).catch(() => setVideos([]));
    }, [selectedImageId]);

    // 메인 이미지 바뀌면 선택 초기화
    useEffect(() => {
        setSelectedImageId(null);
        setVideos([]);
    }, [mainImage?.id]);

    const handleImageClick = (img: PersonaImage) => {
        onSelectMain(img);
        setSelectedImageId(prev => prev === img.id ? null : img.id);
    };

    if (images.length === 0) return null;

    return (
        <>
            <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-800">
                {/* 이미지 썸네일 */}
                <div className="flex gap-2 overflow-x-auto">
                    {images.map(img => (
                        <button
                            key={img.id}
                            onClick={() => handleImageClick(img)}
                            className="relative shrink-0 group"
                            title={img.description || ''}
                        >
                            <img
                                src={img.imageUrl}
                                alt={img.description || ''}
                                className={`w-14 h-14 rounded-lg object-cover border-2 transition-all ${
                                    img.id === mainImage.id
                                        ? 'border-blue-400 opacity-100'
                                        : 'border-transparent opacity-60 group-hover:opacity-90 group-hover:border-gray-500'
                                } ${selectedImageId === img.id ? 'ring-2 ring-blue-400/50' : ''}`}
                            />
                            {/* 동영상 있음 표시 */}
                            {(img._count?.videos ?? 0) > 0 && (
                                <span className="absolute -top-1 -right-1 bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center shadow">
                                    <Icon name="Play" size={8} className="text-white ml-0.5" />
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* 동영상 목록 */}
                {selectedImageId && videos.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {videos.map(v => (
                            <button
                                key={v.id}
                                onClick={() => setPlayingVideo(v)}
                                className="shrink-0 flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-lg px-3 py-1.5 transition-all group"
                            >
                                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                    <Icon name="Play" size={10} className="text-white ml-0.5" />
                                </div>
                                <span className="text-xs text-gray-300 group-hover:text-white max-w-[120px] truncate">
                                    {v.title || '동영상'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

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
