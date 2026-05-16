import React from 'react';
import { Coins } from 'lucide-react';

interface PointDisplayProps {
    paidPoints: number;
    bonusPoints: number;
    cost?: number;
    onClick?: () => void;
}

export const PointDisplay: React.FC<PointDisplayProps> = ({ paidPoints, bonusPoints, cost, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-yellow-900/40 bg-gray-900/80 text-sm font-medium transition-all hover:border-yellow-800/60"
            style={{ letterSpacing: '-0.02em' }}
        >
            <Coins size={13} className="text-yellow-600 flex-shrink-0" />
            <span style={{ color: '#c9a84c' }}>유료 <span className="font-bold">{paidPoints.toLocaleString()}</span></span>
            <span className="text-gray-700 text-xs font-light">/</span>
            <span style={{ color: '#a07c30' }}>무료 <span className="font-bold">{bonusPoints.toLocaleString()}</span></span>
            {cost !== undefined && <span className="text-xs text-gray-600 font-normal">−{cost}</span>}
        </button>
    );
};
