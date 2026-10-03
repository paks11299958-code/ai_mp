import { useEffect, useRef, useState } from 'react';
import { userProfileApi } from '../../services/apiService';
import { useSavedBirth, type SajuBirth, type SajuMenu } from './useSajuRunner';

export const validBirth = (b: SajuBirth): boolean => {
    if (!b || typeof b.name !== 'string') return false;
    const y = Number(b.year), m = Number(b.month), d = Number(b.day);
    if (!b.name.trim() || !/^\d{4}$/.test(b.year) || !/^\d{1,2}$/.test(b.month) || !/^\d{1,2}$/.test(b.day) || y < 1900 || y > new Date().getFullYear() || m < 1 || m > 12 || d < 1) return false;
    if (b.lunar) return d <= 30; // 기존 JSON은 윤달 필드 없음: 음력 변환 계약은 서버에 유지.
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};
export const needsBirth = (key: string, menu: SajuMenu | undefined, policy?: boolean): boolean => {
    // 꿈/사진은 생년월일 API를 사용하지 않는다. 나머지는 DB 메뉴/페르소나 flag 우선.
    if (['dream', 'gwansang', 'palm'].includes(key)) return false;
    return menu?.useBirthInfo ?? policy ?? ['siwoon', 'wealth', 'yeonn', 'rebirth', 'friendship'].includes(key);
};
type Continue = (birth: SajuBirth | null) => void;
export const useDogyeolBirthGate = (enabled = true) => {
    const [birth, updateBirth] = useSavedBirth(enabled);
    const [open, setOpen] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
    const continuation = useRef<Continue | null>(null), busy = useRef(false), alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; continuation.current = null; }; }, []);
    const requireBirth = (needed: boolean, next: Continue) => {
        if (!enabled || busy.current || open) return;
        if (!needed || (birth && validBirth(birth))) { next(birth); return; }
        continuation.current = next; setError(''); setOpen(true);
    };
    const edit = () => { if (!enabled || busy.current || open) return; continuation.current = null; setError(''); setOpen(true); };
    const cancel = () => { if (busy.current) return; continuation.current = null; setOpen(false); setError(''); };
    const save = async (b: SajuBirth) => {
        if (busy.current || !alive.current) return;
        if (!validBirth(b)) { setError('이름과 생년월일을 다시 확인해 주세요.'); return; }
        busy.current = true; setSaving(true); setError('');
        try {
            const response = await userProfileApi.saveBirthInfo(JSON.stringify(b));
            if (!response.ok) throw new Error('명부를 저장하지 못했습니다.');
            if (!alive.current) return;
            // 새 값을 직접 전달: setState 뒤 구 명부 closure로 generate하는 순서 버그 방지.
            updateBirth(b);
            const next = continuation.current; continuation.current = null; setOpen(false); next?.(b);
        } catch { if (alive.current) setError('명부를 저장하지 못했습니다. 다시 시도해 주세요.'); }
        finally { busy.current = false; if (alive.current) setSaving(false); }
    };
    return { birth, open, saving, error, requireBirth, edit, cancel, save };
};
