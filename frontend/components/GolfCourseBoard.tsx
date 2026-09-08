import React, { useCallback, useEffect, useMemo, useState } from 'react';

// 설아 '내 주변 골프장' — 위치·지역으로 골프장을 찾고 설아가 코스를 브리핑한다.
//
// ★★무료 기능이다(2026-09-08 사장 결정). 포인트 차감 UI 를 넣지 말 것.
//
// 🔴★★**평점을 숫자로 보여주지 않는다.** 카카오·네이버·공공데이터 어디에도 평점 API 가 없다.
//   "4.3점"을 띄우면 회원은 우리가 집계한 값으로 믿는다 — 지어낸 별점은 골프장 명예훼손이 될 수 있다.
//   후기는 **카카오맵 상세페이지 링크**로 보낸다.
//
// 🔴★★**예약을 받지 않는다.** 제휴가 없어 예약 권한이 없다. 전화·예약처 링크까지만 안내한다.
//   "예약하기" 문구도 쓰지 않는다 — 우리가 잡아 주는 것으로 읽힌다("예약처 연결"로).

interface Course {
    id: string;
    name: string;
    address: string;
    phone: string | null;
    lat: number; lng: number;
    distanceM: number | null;
    distanceText: string | null;
    mapUrl: string;
}

interface Briefing {
    headline: string;
    tips: string[];
    priceHint: string | null;
    reputation: string | null;
    beginnerFriendly: string | null;
    sources: string[];
    ok: boolean;
}

interface RegionRow { name: string; full: string; districts: string[] }

interface Props {
    personaId?: string;
    onClose: () => void;
}

const CSS = `
.gf-root{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;
  background:#f7f8f6;color:#1d2b21;font-family:'Pretendard',system-ui,-apple-system,sans-serif}
.gf-hd{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#fff;
  border-bottom:1px solid #e3e8e2;flex-shrink:0}
.gf-ic{width:34px;height:34px;border-radius:10px;background:#e8f3ea;display:flex;
  align-items:center;justify-content:center;font-size:17px}
.gf-t{font-size:15px;font-weight:800;letter-spacing:-.01em}
.gf-s{font-size:11px;color:#6b7d70;margin-top:1px}
.gf-x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:1px solid #dbe3dc;
  background:transparent;color:#6b7d70;font-size:15px;cursor:pointer}

.gf-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.gf-inner{max-width:520px;margin:0 auto;padding:14px 14px 40px}

.gf-tabs{display:flex;gap:8px;margin-bottom:12px}
.gf-tab{flex:1;padding:11px 8px;border-radius:11px;border:1px solid #dbe3dc;background:#fff;
  font-size:13px;font-weight:700;color:#5c6f62;cursor:pointer;transition:.15s}
.gf-tab.on{background:#2f6b3f;border-color:#2f6b3f;color:#fff}

.gf-sel{display:flex;gap:8px;margin-bottom:12px}
.gf-sel select{flex:1;min-width:0;padding:11px 10px;border-radius:10px;border:1px solid #dbe3dc;
  background:#fff;font-size:13.5px;color:#1d2b21;font-family:inherit}
.gf-go{padding:11px 16px;border-radius:10px;border:0;background:#2f6b3f;color:#fff;
  font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.gf-go:disabled{background:#a9bdae;cursor:default}

.gf-gps{width:100%;padding:13px;border-radius:11px;border:0;background:#2f6b3f;color:#fff;
  font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px}
.gf-gps:disabled{background:#a9bdae;cursor:default}
.gf-hint{font-size:11.5px;color:#6b7d70;text-align:center;margin-bottom:12px;line-height:1.6}

.gf-msg{padding:16px;border-radius:12px;background:#fff;border:1px solid #e3e8e2;
  font-size:13px;color:#5c6f62;text-align:center;line-height:1.7}
.gf-msg b{color:#1d2b21}

.gf-card{background:#fff;border:1px solid #e3e8e2;border-radius:13px;padding:13px 14px;margin-bottom:10px}
.gf-cn{font-size:14.5px;font-weight:800;letter-spacing:-.01em;display:flex;align-items:baseline;gap:7px}
.gf-dist{font-size:11.5px;font-weight:700;color:#2f6b3f;background:#e8f3ea;
  padding:2px 7px;border-radius:20px;flex-shrink:0}
.gf-ad{font-size:12px;color:#6b7d70;margin-top:5px;line-height:1.5}
.gf-acts{display:flex;gap:7px;margin-top:11px;flex-wrap:wrap}
.gf-btn{flex:1;min-width:88px;padding:9px 6px;border-radius:9px;font-size:12.5px;font-weight:700;
  text-align:center;cursor:pointer;border:1px solid #dbe3dc;background:#fff;color:#3d5145;
  text-decoration:none;display:block}
.gf-btn.pri{background:#2f6b3f;border-color:#2f6b3f;color:#fff}

.gf-brief{margin-top:11px;padding-top:11px;border-top:1px dashed #e3e8e2}
.gf-bh{font-size:13px;font-weight:800;color:#2f6b3f;line-height:1.55;margin-bottom:8px}
.gf-brow{display:flex;gap:7px;font-size:12.5px;line-height:1.65;margin-bottom:6px}
.gf-bk{flex-shrink:0;font-weight:700;color:#3d5145;min-width:52px}
.gf-bv{color:#4a5c50}
.gf-tip{font-size:12.5px;line-height:1.7;color:#3d5145;padding-left:13px;position:relative;margin-bottom:5px}
.gf-tip:before{content:'·';position:absolute;left:4px;font-weight:800;color:#2f6b3f}
.gf-src{font-size:10.5px;color:#8c9a90;margin-top:8px}
.gf-src a{color:#6b8a74;margin-right:7px}
.gf-disc{font-size:11px;color:#8c7a4a;background:#fdf8ec;border:1px solid #f0e4c8;
  border-radius:9px;padding:9px 11px;margin-top:10px;line-height:1.6}
.gf-load{font-size:12.5px;color:#6b7d70;padding:9px 0}
.gf-note{font-size:11.5px;color:#6b7d70;text-align:center;padding:10px;line-height:1.7}
.gf-foot{font-size:11px;color:#8c9a90;text-align:center;margin-top:16px;line-height:1.7}
`;

const api = (u: string) => fetch(u).then(r => r.json());

export const GolfCourseBoard: React.FC<Props> = ({ onClose }) => {
    const [mode, setMode] = useState<'near' | 'region'>('near');
    const [regions, setRegions] = useState<RegionRow[]>([]);
    const [sido, setSido] = useState('');
    const [district, setDistrict] = useState('');
    const [courses, setCourses] = useState<Course[] | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    /** 골프장별 브리핑 — 펼친 것만 부른다(전부 부르면 AI 호출이 카드 수만큼 난다). */
    const [briefs, setBriefs] = useState<Record<string, Briefing | 'loading'>>({});
    const [disclaimer, setDisclaimer] = useState('');

    useEffect(() => {
        api('/api/golf/regions').then(d => setRegions(d.regions || [])).catch(() => {});
    }, []);

    // Esc 로 닫기 — 전체를 덮는 화면이라 출구가 하나뿐이면 갇힌 느낌이 든다.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const districts = useMemo(
        () => regions.find(r => r.name === sido)?.districts ?? [], [regions, sido]);

    const load = useCallback(async (url: string) => {
        setBusy(true); setErr(null); setNote(null); setBriefs({});
        try {
            const d = await api(url);
            if (!d.ok && d.reason) { setErr(d.reason); setCourses([]); return; }
            setCourses(d.courses || []);
            setNote(d.note || null);
        } catch {
            setErr('골프장을 불러오지 못했어요. 잠시 후 다시 시도해 주세요');
            setCourses([]);
        } finally { setBusy(false); }
    }, []);

    const findNear = useCallback(() => {
        if (!navigator.geolocation) { setErr('이 기기에서는 위치를 사용할 수 없어요'); return; }
        setBusy(true); setErr(null);
        navigator.geolocation.getCurrentPosition(
            pos => load(`/api/golf/courses?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radius=20000`),
            e => {
                setBusy(false);
                // ★거부와 실패를 구분해서 말해 준다 — "실패"만 뜨면 뭘 해야 할지 모른다.
                setErr(e.code === e.PERMISSION_DENIED
                    ? '위치 권한이 꺼져 있어요. 아래에서 지역을 선택해 찾아보세요'
                    : '위치를 찾지 못했어요. 지역 선택으로 찾아보세요');
            },
            { timeout: 10000, maximumAge: 60000 },
        );
    }, [load]);

    const openBrief = useCallback(async (c: Course) => {
        if (briefs[c.id]) return;                       // 이미 열었으면 다시 부르지 않는다
        setBriefs(b => ({ ...b, [c.id]: 'loading' }));
        try {
            const d = await api(`/api/golf/briefing?name=${encodeURIComponent(c.name)}&address=${encodeURIComponent(c.address)}`);
            if (d.disclaimer) setDisclaimer(d.disclaimer);
            setBriefs(b => ({ ...b, [c.id]: d.briefing as Briefing }));
        } catch {
            setBriefs(b => ({ ...b, [c.id]: { headline: '', tips: [], priceHint: null,
                reputation: null, beginnerFriendly: null, sources: [], ok: false } }));
        }
    }, [briefs]);

    return (
        <div className="gf-root">
            <style>{CSS}</style>
            <div className="gf-hd">
                <div className="gf-ic">⛳</div>
                <div>
                    <div className="gf-t">내 주변 골프장</div>
                    <div className="gf-s">설아가 코스를 읽어드려요</div>
                </div>
                <button className="gf-x" onClick={onClose} aria-label="닫기">✕</button>
            </div>

            <div className="gf-body">
                <div className="gf-inner">
                    <div className="gf-tabs">
                        <button className={`gf-tab${mode === 'near' ? ' on' : ''}`}
                                onClick={() => { setMode('near'); setCourses(null); setErr(null); }}>
                            📍 내 주변
                        </button>
                        <button className={`gf-tab${mode === 'region' ? ' on' : ''}`}
                                onClick={() => { setMode('region'); setCourses(null); setErr(null); }}>
                            🗺️ 지역 선택
                        </button>
                    </div>

                    {mode === 'near' ? (
                        <>
                            <button className="gf-gps" onClick={findNear} disabled={busy}>
                                {busy ? '찾는 중…' : '내 위치로 골프장 찾기'}
                            </button>
                            <div className="gf-hint">위치를 켜면 20km 안의 골프장을 가까운 순으로 보여드려요</div>
                        </>
                    ) : (
                        <div className="gf-sel">
                            <select value={sido} onChange={e => { setSido(e.target.value); setDistrict(''); }}>
                                <option value="">시·도</option>
                                {regions.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                            </select>
                            <select value={district} onChange={e => setDistrict(e.target.value)} disabled={!sido}>
                                <option value="">전체</option>
                                {districts.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <button className="gf-go" disabled={!sido || busy}
                                    onClick={() => load(`/api/golf/courses?sido=${encodeURIComponent(sido)}&district=${encodeURIComponent(district)}`)}>
                                {busy ? '…' : '찾기'}
                            </button>
                        </div>
                    )}

                    {err && <div className="gf-msg">{err}</div>}
                    {note && !err && <div className="gf-note">{note}</div>}

                    {courses?.map(c => {
                        const b = briefs[c.id];
                        return (
                            <div className="gf-card" key={c.id}>
                                <div className="gf-cn">
                                    <span>{c.name}</span>
                                    {c.distanceText && <span className="gf-dist">{c.distanceText}</span>}
                                </div>
                                <div className="gf-ad">{c.address}</div>

                                <div className="gf-acts">
                                    {!b && (
                                        {/* ★버튼은 '코스 브리핑'으로만 둔다(2026-09-08 사장 지시).
                                            설아 화면이라는 건 헤더가 이미 말하고 있어 이름이 겹친다. */}
                                        <button className="gf-btn pri" onClick={() => openBrief(c)}>
                                            코스 브리핑
                                        </button>
                                    )}
                                    {c.phone && <a className="gf-btn" href={`tel:${c.phone}`}>전화 {c.phone}</a>}
                                    {/* ★"예약하기"가 아니다 — 우리가 잡아 주는 것으로 읽히면 안 된다. */}
                                    <a className="gf-btn" href={c.mapUrl} target="_blank" rel="noopener noreferrer">
                                        후기·예약처
                                    </a>
                                </div>

                                {b === 'loading' && <div className="gf-load">설아가 코스를 살펴보는 중…</div>}
                                {b && b !== 'loading' && (
                                    b.ok ? (
                                        <div className="gf-brief">
                                            {b.headline && <div className="gf-bh">{b.headline}</div>}
                                            {b.tips.map((t, i) => <div className="gf-tip" key={i}>{t}</div>)}
                                            {b.priceHint && (
                                                <div className="gf-brow" style={{ marginTop: 8 }}>
                                                    <span className="gf-bk">그린피</span>
                                                    <span className="gf-bv">{b.priceHint}</span>
                                                </div>
                                            )}
                                            {/* ★평점이 아니라 '후기 경향'이다. 숫자는 서버가 걸러 낸다. */}
                                            {b.reputation && (
                                                <div className="gf-brow">
                                                    <span className="gf-bk">후기</span>
                                                    <span className="gf-bv">{b.reputation}</span>
                                                </div>
                                            )}
                                            {b.beginnerFriendly && (
                                                <div className="gf-brow">
                                                    <span className="gf-bk">초보자</span>
                                                    <span className="gf-bv">{b.beginnerFriendly}</span>
                                                </div>
                                            )}
                                            {b.sources.length > 0 && (
                                                <div className="gf-src">
                                                    출처{' '}
                                                    {b.sources.map((s, i) => (
                                                        <a key={i} href={s} target="_blank" rel="noopener noreferrer">[{i + 1}]</a>
                                                    ))}
                                                </div>
                                            )}
                                            {disclaimer && <div className="gf-disc">{disclaimer}</div>}
                                        </div>
                                    ) : (
                                        <div className="gf-load">코스 정보를 찾지 못했어요. 골프장에 직접 확인해 주세요.</div>
                                    )
                                )}
                            </div>
                        );
                    })}

                    {courses && courses.length > 0 && (
                        <div className="gf-foot">
                            골프장 정보는 카카오맵 기준이에요.<br />
                            예약과 정확한 요금은 골프장에 확인해 주세요.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
