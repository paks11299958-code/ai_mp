import React, { useState } from 'react';
import { DogyeolBirthForm } from './DogyeolBirthForm';
import { validBirth } from './useDogyeolBirthGate';
import type { SajuBirth } from './useSajuRunner';

// 상대 명부는 이 궁합의 콜백으로만 전달한다. 프로필 저장은 하지 않는다.
export const DogyeolPartnerForm = ({ friendship = false, step, onComplete, onClose }: {
    friendship?: boolean; step?: number; onComplete: (birth: SajuBirth) => void; onClose: () => void;
}) => {
    const [error, setError] = useState('');
    return <DogyeolBirthForm initial={null} saving={false} error={error}
        inputPrefix={step ? `dg-friend-${step}` : 'dg-partner'}
        eyebrow={step ? `친구 둘 궁합 · ${step}/2` : friendship ? '우정 궁합 · 친구 정보' : '인연 궁합 · 상대 정보'}
        title={step ? `${step === 1 ? '첫' : '두'} 번째 친구의 명부` : friendship ? '친구의 명부' : '상대의 명부'}
        desc="두 사람의 흐름을 함께 살펴보겠습니다."
        submitLabel={step === 1 ? '다음 친구 적기' : '정보 확인 후 풀이 시작'}
        note="태어난 시를 모르시면 '모름'을 선택하세요. 상대 정보는 이번 궁합에만 사용합니다."
        onCancel={onClose} onSave={birth => {
            if (!validBirth(birth)) { setError('이름과 생년월일을 다시 확인해 주세요.'); return; }
            setError(''); onComplete(birth);
        }}/>;
};
