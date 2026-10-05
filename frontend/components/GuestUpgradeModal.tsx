import React from 'react';
import { toChargeLayer } from '../lib/chargeLayer';
import type { User } from '../types';
import { RegistrationForm } from './RegistrationForm';
import './auth-v2.css';
interface GuestUpgradeModalProps {
    onSuccess: (user: User, token: string) => void;
    onClose: () => void;
    headline?: { title: string; body: string } | null;
}
export const GuestUpgradeModal: React.FC<GuestUpgradeModalProps> = ({ onSuccess, onClose, headline }) => {
    // Keep body portal and the existing charge-layer contract in both main/chat charging paths.
    return toChargeLayer(
        <div className="fixed inset-0 auth-v2 auth-overlay z-[9000]" style={{ zIndex: 9000 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="auth-content"><section className="auth-card" role="dialog" aria-modal="true" aria-label="체험 계정 정식가입">
                <button className="auth-close auth-link" type="button" aria-label="닫기" onClick={onClose}>✕</button>
                <p className="auth-brand">AI 놀이터</p><RegistrationForm upgrade onSuccess={onSuccess} headline={headline} />
                <button className="auth-link" type="button" onClick={onClose}>체험으로 돌아가기</button>
            </section></div>
        </div>
    );
};
