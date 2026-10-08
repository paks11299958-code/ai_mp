import React, { useEffect } from 'react';

/** 기본 시트의 Esc 닫기 — 폰 뒤로가기도 Esc 로 들어온다(useBackButtonLayer, 2026-10-08).
 *  ★PersonaEntrySheet 에 두지 않는 이유: 그 파일은 훅 0개가 규약이다(조기 return 분기, entryReturn.test). */
export const EscToClose: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return null;
};
