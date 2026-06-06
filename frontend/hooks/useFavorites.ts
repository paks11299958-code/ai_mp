import { useState, useEffect, useCallback, useRef } from 'react';
import { userProfileApi } from '../services/apiService';

/**
 * 즐겨찾기(자주가는 메뉴) 상태 훅.
 * - 로그인 시 서버에서 즐겨찾기 키 목록을 불러온다.
 * - toggle 시 낙관적 업데이트 후 서버에 저장(실패하면 롤백).
 * 저장 형식: 기능 키 문자열 배열의 JSON (예: '["news","stock"]').
 */
export function useFavorites(isLoggedIn: boolean) {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const savingRef = useRef(false);

    useEffect(() => {
        if (!isLoggedIn) { setFavorites([]); setLoaded(false); return; }
        let alive = true;
        userProfileApi.getFavorites()
            .then(({ favoritesJson }) => {
                if (!alive) return;
                try {
                    const arr = favoritesJson ? JSON.parse(favoritesJson) : [];
                    setFavorites(Array.isArray(arr) ? arr.filter(k => typeof k === 'string') : []);
                } catch { setFavorites([]); }
                setLoaded(true);
            })
            .catch(() => { if (alive) setLoaded(true); });
        return () => { alive = false; };
    }, [isLoggedIn]);

    const persist = useCallback(async (next: string[], prev: string[]) => {
        if (savingRef.current) return;
        savingRef.current = true;
        try {
            await userProfileApi.saveFavorites(JSON.stringify(next));
        } catch {
            setFavorites(prev); // 실패 시 롤백
        } finally {
            savingRef.current = false;
        }
    }, []);

    const toggleFavorite = useCallback((key: string) => {
        setFavorites(prev => {
            const exists = prev.includes(key);
            const next = exists ? prev.filter(k => k !== key) : [...prev, key];
            if (next.length > 20) return prev; // 최대 20개
            persist(next, prev);
            return next;
        });
    }, [persist]);

    const isFavorite = useCallback((key: string) => favorites.includes(key), [favorites]);

    return { favorites, isFavorite, toggleFavorite, favoritesLoaded: loaded };
}
