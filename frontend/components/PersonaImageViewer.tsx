import React from 'react';
import { PersonaImage } from '../types';

interface PersonaImageViewerProps {
    images: PersonaImage[];
    onSelectMain: (image: PersonaImage) => void;
}

export const PersonaImageViewer: React.FC<PersonaImageViewerProps> = ({ images, onSelectMain }) => {
    if (images.length === 0) return null;

    const mainImage = images.find(img => img.isMain) || images[0];

    return (
        <div className="flex gap-2 px-3 py-2 bg-gray-900/50 border-b border-gray-800 overflow-x-auto">
            {images.map(img => (
                <button
                    key={img.id}
                    onClick={() => onSelectMain(img)}
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
                        }`}
                    />
                </button>
            ))}
        </div>
    );
};
