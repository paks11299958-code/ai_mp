import './sajuEntry.css';
import './dogyeolChat.css';
import { useDogyeolBirthGate, needsBirth } from './useDogyeolBirthGate';
import { DogyeolBirthForm } from './DogyeolBirthForm';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DOGYEOL_MENU, DOGYEOL_MENU_GROUPS, DOGYEOL_MENU_KEYS } from '../../lib/dogyeolMenu';
import type { PersonaEntryGuide, GuestGate } from '../PersonaEntrySheet';
import { guestNoticeForFeature } from '../../lib/guestFeatureGate';
import { SAJU_HERO_IMAGES, mountSajuHero, mountSajuLoadingSmoke, prefersReducedMotion } from './sajuHero';
import { usePersonaMenus, useSajuRunner, sheetMenuFor, inputKindFor, dreamPlaceholder, withPartner, withTwoPartners, type SajuInputKind, type SajuBirth } from './useSajuRunner';
// 2단계 — 기존 모달·결과 카드를 그대로 재사용한다(새로 만들지 않는다).
import { FaceReadingModal } from '../FaceReadingModal';
import { FaceReadingResultCard } from '../FaceReadingResultCard';
import { PalmReadingModal } from '../PalmReadingModal';
import { PalmReadingResultCard } from '../PalmReadingResultCard';
// 3단계 — 인연 궁합의 상대방 정보도 창 안에서 받는다(채팅 경로와 **같은 모달**).
import { DogyeolPartnerForm } from './DogyeolPartnerForm';
import type { FaceReadingResult, PalmReadingResult } from '../../types';

// 도결(道潔) 선생 전용 진입 화면 — "사주 사이트 같은 큰 랜딩".
//
// 왜 별도 화면인가(2026-08-26 사장 지시): 페르소나에 들어가면 채팅창이 먼저 보여
// **뭘 할 수 있는지 안 보이고 분위기도 안 산다**. 사주는 분위기 자체가 상품인데
// 일반 챗봇과 구분이 되지 않았다. 그래서 도결 선생만 랜딩을 먼저 띄운다.
//
// ★계약은 기존 시트와 똑같다 — onStart()=채팅, onFeature(key)=그 기능, onClose()=닫기.
//   App.tsx는 이 컴포넌트의 존재를 모른다(분기는 PersonaEntrySheet 안에서 한다).
//   ★★App.tsx를 건드리면 전 화면 백지 사고가 재발한다(2026-07-29 useCallback TDZ 실사고).
//
// ★히어로(묶음 B): 책 → 연기(상승) → 안개(가로 흐름) → 호랑이 를 Canvas 2D 한 장으로
//   그린다. 그리는 로직은 전부 sajuHero.ts에 있고 여기서는 canvas를 붙였다 떼기만 한다.
//   모션 감소 설정이면 **캔버스를 아예 만들지 않고** tiger.png를 정적으로 띄운다.


// 스타일은 Tailwind가 아니라 이 컴포넌트 전용 CSS로 둔다.
// 기존 사이트는 밝은 보라·핑크 톤이라 유틸리티 클래스를 쓰면 톤이 섞인다 —
// 먹색/금박은 여기서 닫아두고, 밖으로 새지 않게 전부 `sj-` 접두사를 붙인다.


interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    onInvite: () => void;
    /** 비로그인일 때만 들어온다(PersonaEntrySheet). 풀이는 창 안에서 유료 API(quick-menu-result)를
     *  직접 부르므로, 비로그인이면 실행하지 않고 안내 모달로 보낸다. 없으면 종전과 같다. */
    onGuestGate?: GuestGate;
}


export const SajuEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature, onInvite, onGuestGate }) => {
    const heroRef = useRef<HTMLCanvasElement | null>(null);

    // ★창 안에서 풀이까지 끝낸다 — 채팅으로 나가지 않는다(2026-08-27 사장 지시).
    //   퀵메뉴·명부는 DB 정본을 그대로 읽고, 실행도 채팅이 쓰던 같은 API 를 부른다.
    const { id: personaId, menus, useBirthInfo } = usePersonaMenus(guide.personaName || guide.title);
    const birthGate = useDogyeolBirthGate(!onGuestGate);
    const { birth } = birthGate;   // 비로그인이면 명부(로그인 전용)를 읽지 않는다
    const runner = useSajuRunner(personaId, birth);
    /** 기능 클릭 — 창 안에서 돌릴 수 있으면 여기서 풀고, 아니면 기존 채팅 경로로 넘긴다.
     *  ★해몽(텍스트)·관상/손금(사진)은 입력 UI 가 따로 필요해 아직 채팅으로 보낸다. */
    const handleFeature = (featureKey: string) => {
        // ★비로그인(2026-09-28) — 풀이·해몽·관상·궁합은 전부 이 아래에서 유료 API 로 이어진다.
        //   실행하지 않고 안내 모달로 보낸다. 회원이면 onGuestGate 가 undefined 라 종전 그대로.
        if (onGuestGate) { onGuestGate(guestNoticeForFeature(featureKey), featureKey); return; }
        const menu = sheetMenuFor(menus, featureKey);
        if (menu) { birthGate.requireBirth(needsBirth(featureKey, menu, useBirthInfo), saved => runner.select(menu, saved)); return; }
        // 2단계 — 입력이 필요한 기능도 창 안에서 받는다(2026-08-27).
        const kind = inputKindFor(menus, featureKey);
        if (kind) { setInputKind(kind); setDream(''); return; }
        onFeature(featureKey);              // 그래도 못 하는 건 기존 채팅 경로로
    };
    /** 풀이 판이 히어로를 덮고 있는가 */
    const panelOpen = !!(runner.picking || runner.loading || runner.result || runner.error);

    const smokeRef = useRef<HTMLCanvasElement | null>(null);

    // 2단계 — 사진 업로드(관상·손금)와 텍스트(꿈해몽)를 창 안에서 받는다.
    // ★관상·손금은 **기존 모달·결과 카드를 그대로** 쓴다(독립 컴포넌트라 personaId 만 주면 된다).
    //   새로 만들면 그쪽에 이미 있는 연출(손금 봉인→플립 등)을 잃는다.
    const [inputKind, setInputKind] = useState<SajuInputKind | null>(null);
    const [dream, setDream] = useState('');
    // 3단계 — 인연 궁합. 상대방 정보를 받는 동안 어떤 항목이었는지 붙들어 둔다.
    // ★모달이 뜬 사이 `runner.picking` 은 그대로 두어야 취소했을 때 항목 목록으로 돌아간다.
    const [partnerFor, setPartnerFor] = useState<{ label: string; prompt: string } | null>(null);
    // 친구 둘 궁합 — 같은 모달을 친구1 → 친구2 로 두 번 받는다(채팅 경로와 동일).
    const [twoFor, setTwoFor] = useState<{ label: string; prompt: string } | null>(null);
    const [twoStep, setTwoStep] = useState(0);            // 0=닫힘, 1=친구1, 2=친구2
    const [firstFriend, setFirstFriend] = useState<SajuBirth | null>(null);
    const [faceResult, setFaceResult] = useState<FaceReadingResult | null>(null);
    const [palmResult, setPalmResult] = useState<{ result: PalmReadingResult; imageUrl: string | null; hand: 'left' | 'right' } | null>(null);

    // ★한 번만 판단해 렌더 내내 고정한다 — 렌더마다 matchMedia를 부르면 canvas가
    //   붙었다 떨어졌다 하며 연출이 처음부터 다시 재생될 수 있다.
    const [reduced] = useState(prefersReducedMotion);

    useEffect(() => {
        if (reduced) return;                 // 정적 대체 — 캔버스 자체가 없다
        const el = heroRef.current;
        if (!el) return;
        const hero = mountSajuHero(el);
        return () => hero.destroy();         // rAF·옵저버까지 전부 걷어낸다
    }, [reduced]);

    // 기다리는 동안 향 연기를 피운다(2026-08-27 사장 지시 "기다리는 화면이 밋밋하다").
    // ★로딩이 끝나면 canvas 가 언마운트되므로 정리 함수가 rAF·옵저버를 걷어낸다.
    // ★★`reduced` 선언 **뒤에** 둔다 — 앞에 두면 TDZ 로 터진다(2026-07-29 전 화면 백지 사고).
    useEffect(() => {
        if (reduced || !runner.loading) return;
        const el = smokeRef.current;
        if (!el) return;
        const smoke = mountSajuLoadingSmoke(el);
        return () => smoke.destroy();
    }, [reduced, runner.loading]);

    // ★★위에 모달이 떠 있는가(2026-09-07). 아래 Esc 훅과 배경 클릭이 함께 쓴다.
    //   ★훅의 의존성 배열에 들어가므로 **그 훅보다 위**에 선언한다(TDZ 백지 사고 예방).
    //   `sj-root` 는 자식 클릭을 전부 `onClose` 로 받는데, 모달들은 `sj-sheet` **밖**에
    //   렌더돼 `stopPropagation` 우산 아래가 없다. 그대로 두면 모달 안의 버튼을 누르는
    //   순간 이벤트가 루트까지 올라가 **진입화면이 통째로 닫히고 메인으로 튕긴다.**
    //   ★궁합만의 문제가 아니었다 — 실측하니 **관상·손금(2026-08-27 작업)도 깨져 있었다.**
    //     개별 모달에 stopPropagation 을 붙이는 대신 닫기 판단을 한곳에서 막는다.
    const modalUp = birthGate.open || !!(inputKind || partnerFor || twoStep > 0 || faceResult || palmResult);

    // ✕·Esc·배경 클릭 — 풀이 패널(고르기·결과·오류)이 열려 있으면 진입화면을 닫지 않고 차례 메뉴로 돌아간다
    //   (2026-10-06 사장 지적 "창 닫기 누르면 진입화면이 나와야지"). 풀이 중에는 runner.reset 이 무시돼 그대로 머문다.
    const closeOrBack = useCallback(() => {
        if (panelOpen) runner.reset();
        else onClose();
    }, [panelOpen, runner, onClose]);

    // Esc로 닫기 — 전체를 덮는 화면이라 출구가 하나(✕)뿐이면 갇힌 느낌이 든다.
    // ★모달이 위에 있으면 진입화면까지 닫지 않는다 — 모달은 자기 취소 버튼으로 닫는다.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !modalUp) closeOrBack(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [closeOrBack, modalUp]);

    // ★DB(FEATURES_GRID)에서 온 것만 쓴다. 없는 기능을 지어내지 않는다.
    const features = guide.features ?? [];

    return (
        // 배경 클릭 = 닫기. 내용은 max-width로 묶여 있어 넓은 화면의 양옆이 배경이 된다.
        <div className="sj-root" onClick={() => { if (!modalUp) closeOrBack(); }}>

            <div
                className="sj-sheet"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${guide.title} 소개`}
            >
                <button className="sj-close" onClick={closeOrBack} aria-label={panelOpen ? '차례로 돌아가기' : '닫기'}>✕</button>

                <header className="sj-header">道潔 선생의 서재</header>
                <div className="sj-top">
                    <section className="sj-left">
                        <div className="sj-identity"><img src="/dogyeol/portrait.webp" alt="남색 한복을 입은 도결 선생"/><div><span className="sj-badge">57년 내공</span><h2 className="sj-title sj-serif">{guide.title}</h2><p className="sj-desc">{guide.desc}</p></div></div>
                    <div className="sj-hero">
                        {reduced
                            ? <img src={SAJU_HERO_IMAGES.tiger} alt="" aria-hidden="true" />
                            : <canvas ref={heroRef} aria-hidden="true" />}
                        <div className="sj-heroveil" aria-hidden="true" />

                        {panelOpen && (
                            <div className={`sj-panel${runner.loading ? ' is-waiting' : ''}`} role="region" aria-live="polite"
                                 aria-label={runner.picking?.label || runner.result?.title || '풀이'}>
                                <div className="sj-panelhead">
                                    <span className="sj-panelname sj-serif">
                                        {runner.result?.title || runner.picking?.label || '풀이 중'}
                                    </span>
                                    <button className="sj-panelback" onClick={runner.reset} aria-label="닫고 처음으로">
                                        ✕
                                    </button>
                                </div>

                                <div className="sj-panelbody">
                                    {/* ① 서브메뉴 — 무엇을 볼지 고른다 */}
                                    {runner.picking && (
                                        <>
                                            {runner.picking.subMenu?.dialog && (
                                                <p className="sj-dialog sj-serif">{runner.picking.subMenu.dialog}</p>
                                            )}
                                            <div className="sj-picks">
                                                {(runner.picking.subMenu?.items ?? []).map(it => (
                                                    <button key={it.label} className="sj-pick"
                                                        onClick={() => {
                                                            // 상대 정보가 필요한 항목도 창 안에서 받는다(2026-09-07).
                                                            // ★★`twoPartnerModal` 을 빠뜨리면 상대 정보 없이 실행돼
                                                            //   포인트만 나간다 — 실제로 그런 상태였다.
                                                            if (it.twoPartnerModal) {
                                                                setTwoFor({ label: it.label, prompt: it.prompt });
                                                                setFirstFriend(null);
                                                                setTwoStep(1);
                                                                return;
                                                            }
                                                            if (it.partnerModal) {
                                                                setPartnerFor({ label: it.label, prompt: it.prompt });
                                                                return;
                                                            }
                                                            runner.pick(it.label, it.prompt);
                                                        }}>
                                                        {it.label}
                                                        {(it.partnerModal || it.twoPartnerModal) &&
                                                            <em className="sj-pickhint">
                                                                {it.twoPartnerModal ? '두 사람 정보 필요' : '상대 정보 필요'}
                                                            </em>}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {/* ② 실행 중 — 향 연기가 계속 피어오른다(2026-08-27 사장 지시
                                        "기다리는 화면이 밋밋하다"). 히어로 연출은 6초 타임라인이라
                                        풀이가 더 걸리면 정지해 버려서, 연기만 무한 루프로 돌린다. */}
                                    {runner.loading && (
                                        <div className="sj-loading">
                                            {!reduced && <canvas ref={smokeRef} className="sj-smoke" aria-hidden="true" />}
                                            <div className="sj-loadinner">
                                                <span className="sj-loaddots">
                                                    <span className="sj-dot" /><span className="sj-dot" /><span className="sj-dot" />
                                                </span>
                                                <p>도결 선생이 이야기를 살피는 중입니다…</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* ③ 결과 — 창 안에서 그대로 읽는다 */}
                                    {runner.result && (
                                        <article className="sj-result"><div className="sj-author"><img src="/dogyeol/portrait.webp" alt=""/>도결 선생의 글</div><p>{runner.result.body}</p><p className="sj-signature">도결 선생 드림</p></article>
                                    )}

                                    {/* ④ 오류 */}
                                    {runner.error && <p className="sj-err">{runner.error}</p>}
                                </div>

                                {(runner.result || runner.error) && (
                                    <div className="sj-panelfoot">
                                        <button className="sj-cta2" onClick={runner.reset}>다른 것도 보기</button>
                                        <button className="sj-cta2" onClick={() => onStart()}>도결 선생에게 더 묻기</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                        <div className="sj-ctas"><button className="sj-cta" onClick={() => onStart(guide.autoRunFeatureKey)}>도결 선생과 대화하기</button></div>
                        {guide.usesBirthInfo && <p className="sj-note">명부가 필요한 풀이는 먼저 정보를 여쭙니다.</p>}
                    </section>
                    <section className="sj-right" aria-label="상담 메뉴">
                        <div className="sj-bookhead"><h3>어떤 이야기가 궁금하세요?</h3><p>그림을 눌러 골라주세요</p></div>
                        {DOGYEOL_MENU_GROUPS.map(group => {
                            const items = group.keys.map(key => features.find(f => f.key === key)).filter((f): f is NonNullable<typeof f> => !!f);
                            return items.length > 0 && <section className="sj-group" key={group.title}>
                                <h4>{group.title}</h4><div className="sj-cards">{items.map(f => {
                                    const display = DOGYEOL_MENU[f.key as keyof typeof DOGYEOL_MENU];
                                    return <button key={f.key} className="sj-feat" aria-label={display.name} onClick={() => handleFeature(f.key)}>
                                        <img src={display.image} alt="" width={400} height={400}/>
                                        <span className="sj-cardtext"><strong>{display.name}</strong><small>{display.description}</small></span>
                                        <span className="sj-arrow" aria-hidden="true">↗</span>
                                    </button>;
                                })}</div>
                            </section>;
                        })}
                        {features.filter(f => !DOGYEOL_MENU_KEYS.some(key => key === f.key)).map(f => <button className="sj-feat" key={f.key} onClick={() => handleFeature(f.key)}>{f.name}</button>)}
                    </section>
                </div>
                <footer className="sj-links"><button onClick={() => { if (onGuestGate) onGuestGate('paid'); else birthGate.edit(); }}>내 명부 살펴보기</button><button onClick={onInvite}>🎁 친구 초대 +1000P</button></footer>
            </div>

            {birthGate.open && <div className="sj-birthwrap" onClick={e => e.stopPropagation()}><DogyeolBirthForm initial={birth} saving={birthGate.saving} error={birthGate.error} onSave={birthGate.save} onCancel={birthGate.cancel}/></div>}
            <div className="sj-child dg-child" hidden={!modalUp || birthGate.open} onClick={e => e.stopPropagation()}>
            {/* ── 2단계: 입력이 필요한 기능 ──────────────────────────────
                ★관상·손금은 **기존 모달과 결과 카드를 그대로** 띄운다. 이 창 위에
                  얹히므로 여전히 채팅으로 나가지 않는다. */}
            {inputKind === 'face' && personaId && (
                <FaceReadingModal
                    personaId={personaId}
                    onResult={r => { setFaceResult(r); setInputKind(null); }}
                    onClose={() => setInputKind(null)}
                />
            )}
            {faceResult && (
                <FaceReadingResultCard
                    result={faceResult}
                    personaName={guide.personaName || guide.title}
                    onClose={() => setFaceResult(null)}
                />
            )}

            {inputKind === 'palm' && personaId && (
                <PalmReadingModal
                    personaId={personaId}
                    onResult={(result, imageUrl, hand) => { setPalmResult({ result, imageUrl, hand }); setInputKind(null); }}
                    onClose={() => setInputKind(null)}
                />
            )}
            {palmResult && (
                <PalmReadingResultCard
                    result={palmResult.result}
                    imageUrl={palmResult.imageUrl}
                    hand={palmResult.hand}
                    personaName={guide.personaName || guide.title}
                    onClose={() => setPalmResult(null)}
                />
            )}

            {/* 꿈해몽 — 입력창이 없던 유일한 기능이라 창 안에 둔다.
                ★차감은 `/quick-menu-result` 가 서버에서 처리한다(실패 시 환불까지).
                  채팅 경로의 activate(50P 선차감)를 쓰면 이중과금이 된다. */}
            {inputKind === 'dream' && (
                <div className="sj-dreamwrap" role="dialog" aria-modal="true" aria-label="꿈해몽">
                    <div className="sj-dream">
                        <div className="sj-panelhead">
                            <span className="sj-panelname sj-serif">🌙 해몽</span>
                            <button className="sj-panelback" onClick={() => setInputKind(null)} aria-label="닫기">✕</button>
                        </div>
                        <div className="sj-dreambody">
                            <textarea
                                className="sj-dreaminput"
                                value={dream}
                                onChange={e => setDream(e.target.value)}
                                placeholder={dreamPlaceholder(menus)}
                                rows={6}
                                autoFocus
                            />
                            <button
                                className="sj-cta"
                                disabled={!dream.trim()}
                                onClick={() => {
                                    const m = menus.find(x => x.label === '🌙 해몽');
                                    runner.run('🌙 해몽', `${m?.prompt ? m.prompt + '\n\n' : ''}${dream.trim()}`);
                                    setInputKind(null);
                                }}>
                                도결 선생께 여쭙기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 3단계: 궁합 — 상대방 정보(2026-09-07, 10-04 한지 양식 `DogyeolPartnerForm`) ──
                상대 명부는 이번 궁합에만 쓰고 저장하지 않는다. 프롬프트 조립(`withPartner`)은 채팅과 같다.
                ★★차감은 `/quick-menu-result` 한 번뿐이다 — 채팅 경로의 activate 를
                  흉내내면 **두 번 차감**된다(꿈해몽에서 겪은 함정). */}
            {partnerFor && (
                <DogyeolPartnerForm
                    friendship={partnerFor.label === '나와 친구 궁합'}
                    onComplete={p => {
                        // 내 명부는 붙이지 않는다 — `run()` 의 `withBirth()` 가 붙인다(중복 방지).
                        runner.run(partnerFor.label, withPartner(partnerFor.prompt, p));
                        setPartnerFor(null);
                    }}
                    onClose={() => setPartnerFor(null)}
                />
            )}

            {/* 친구 둘 궁합 — 같은 모달을 친구1 → 친구2 로 두 번 받는다.
                ★`key` 로 단계가 바뀔 때 입력을 초기화한다(안 하면 친구1 값이 그대로 남는다). */}
            {twoStep > 0 && twoFor && (
                <DogyeolPartnerForm
                    key={twoStep}
                    step={twoStep}
                    onComplete={info => {
                        if (twoStep === 1) { setFirstFriend(info); setTwoStep(2); return; }
                        if (firstFriend) runner.run(twoFor.label, withTwoPartners(twoFor.prompt, firstFriend, info));
                        setTwoStep(0); setFirstFriend(null); setTwoFor(null);
                    }}
                    onClose={() => { setTwoStep(0); setFirstFriend(null); setTwoFor(null); }}
                />
            )}
            </div>
        </div>
    );
};
