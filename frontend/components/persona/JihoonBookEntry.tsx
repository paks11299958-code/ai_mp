import React, { useEffect, useState } from 'react';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';

// 강지훈 전용 진입화면 — 승인된 별빛 책방 시안을 제품 계약에 맞춰 옮긴다.
// App.tsx는 건드리지 않는다. onFeature('ebook')=기존 전자책 보드,
// onStart()=기존 채팅, onClose()=원래 화면으로 복귀한다.

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    onInvite: () => void;
}

const BOOKS = {
    small: {
        title: '별빛 아래, 작은 가게를 엽니다',
        sub: '오래 기억되는 공간과 사람에 관한 에세이',
        chapters: [
            ['문을 열기 전', '왜 이 장소여야 했는지, 첫 마음을 기록합니다.'],
            ['손님이 머무는 이유', '작은 가게의 분위기와 관계를 살펴봅니다.'],
            ['내일도 불을 켜는 마음', '지속 가능한 일과 삶의 리듬을 정리합니다.'],
        ],
    },
    career: {
        title: '마흔, 다시 이름표를 씁니다',
        sub: '두 번째 직업을 시작한 사람의 현실적인 기록',
        chapters: [
            ['멈춘 자리에서', '변화를 결심하게 된 순간을 돌아봅니다.'],
            ['배우는 사람으로', '낯선 기술과 실패를 내 것으로 만드는 과정입니다.'],
            ['다시 일하는 방식', '경험을 버리지 않고 새 역할로 연결합니다.'],
        ],
    },
    record: {
        title: '당신의 계절을 기록합니다',
        sub: '부모님의 말과 사진으로 엮는 한 사람의 생애',
        chapters: [
            ['오래된 사진 한 장', '유년 시절과 가족의 풍경을 복원합니다.'],
            ['가장 빛나던 날들', '일, 사랑, 선택의 순간을 목소리로 남깁니다.'],
            ['우리에게 건넨 문장', '다음 세대에 전하고 싶은 마음을 모읍니다.'],
        ],
    },
} as const;

type BookKey = keyof typeof BOOKS;

const CSS = `
.jb-root{--jb-ink:#13283a;--jb-ink2:#091722;--jb-paper:#f7f3e9;--jb-teal:#6fb7aa;
  --jb-wine:#a85c68;--jb-gold:#d7b86d;position:fixed;inset:0;z-index:85;overflow-y:auto;
  overflow-x:hidden;background:var(--jb-ink2);color:#fff;font-family:Pretendard,"Apple SD Gothic Neo",
  "Noto Sans KR",sans-serif;-webkit-font-smoothing:antialiased}
.jb-root *{box-sizing:border-box}.jb-root button{font:inherit;touch-action:manipulation}
.jb-hero{min-height:min(820px,92svh);position:relative;display:grid;align-items:end;overflow:hidden;
  background:#0b1721 url('/jihoon/starlit-book-studio-v1.png') center/cover no-repeat}
.jb-hero::before{content:'';position:absolute;inset:0;background:
  linear-gradient(90deg,rgba(6,18,28,.94) 0%,rgba(6,18,28,.76) 34%,rgba(6,18,28,.18) 68%,rgba(6,18,28,.05)),
  linear-gradient(0deg,rgba(6,18,28,.86),transparent 48%)}
@media(min-width:761px){.jb-hero::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 84% 24%,rgba(255,196,105,.5) 0,rgba(255,184,83,.2) 15%,transparent 34%),
  radial-gradient(circle at 54% 15%,rgba(255,222,154,.34) 0,rgba(255,198,110,.12) 13%,transparent 29%);
  mix-blend-mode:screen;opacity:.12;animation:jb-studio-lights 6.4s ease-in-out infinite}
  @keyframes jb-studio-lights{0%,100%{opacity:.08;filter:brightness(.72)}44%,58%{opacity:.72;filter:brightness(1.2)}72%{opacity:.2;filter:brightness(.84)}}}
.jb-top{position:absolute;z-index:3;top:0;left:0;right:0;display:flex;align-items:center;
  justify-content:space-between;padding:20px clamp(20px,5vw,72px)}
.jb-brand{display:flex;align-items:center;gap:10px;font:15px Georgia,"Noto Serif KR",serif}
.jb-mark{width:27px;height:32px;border:1px solid rgba(255,255,255,.72);border-radius:2px 7px 7px 2px;position:relative}
.jb-mark::after{content:'';position:absolute;left:5px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.38)}
.jb-close{width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.18);
  background:rgba(8,20,30,.55);color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(8px)}
.jb-copy{position:relative;z-index:2;width:min(650px,calc(100% - 40px));
  margin:0 0 clamp(54px,8vh,94px) clamp(20px,7vw,104px)}
.jb-eyebrow{display:flex;align-items:center;gap:9px;color:#d9e3e7;font-size:12px;font-weight:700}
.jb-eyebrow::before{content:'';width:36px;border-top:1px solid var(--jb-gold)}
.jb-copy h1{font:500 clamp(43px,7vw,82px)/1.08 Georgia,"Noto Serif KR",serif;margin:18px 0 20px}
.jb-star{color:var(--jb-gold)}.jb-lead{max-width:38ch;color:#d8e2e5;font-size:clamp(16px,2vw,20px);line-height:1.75;margin:0}.jb-lead strong{color:#fff}
.jb-actions{display:flex;gap:11px;flex-wrap:wrap;margin-top:30px}.jb-primary,.jb-secondary{min-height:50px;border-radius:4px;padding:0 22px;font-weight:800;cursor:pointer}
.jb-primary{border:0;background:var(--jb-paper);color:var(--jb-ink)}.jb-secondary{border:1px solid rgba(255,255,255,.35);background:rgba(6,18,28,.38);color:#fff;backdrop-filter:blur(8px)}
.jb-disclosure{margin-top:18px;color:#aebec5;font-size:11px}.jb-scroll{position:absolute;z-index:2;right:clamp(20px,5vw,72px);bottom:34px;color:#d7e0e3;font-size:11px;writing-mode:vertical-rl;display:flex;align-items:center;gap:9px}.jb-scroll::after{content:'';height:44px;border-left:1px solid rgba(255,255,255,.55)}
.jb-process{background:var(--jb-paper);color:var(--jb-ink);padding:clamp(62px,9vw,112px) clamp(20px,7vw,104px)}
.jb-section-head{display:grid;grid-template-columns:minmax(0,.8fr) minmax(280px,1.2fr);gap:42px;align-items:end;max-width:1180px;margin:auto}.jb-kicker{color:#57747d;font-size:12px;font-weight:800}.jb-section-head h2{font:500 clamp(32px,4.4vw,54px)/1.23 Georgia,"Noto Serif KR",serif;margin:12px 0 0}.jb-section-head p{font-size:15px;line-height:1.8;color:#52646b;margin:0;max-width:54ch}
.jb-steps{max-width:1180px;margin:54px auto 0;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #c8c5bc}.jb-step{padding:28px 30px 16px 0;min-height:230px;border-right:1px solid #d6d1c7}.jb-step+.jb-step{padding-left:30px}.jb-step:last-child{border-right:0}.jb-num{font:italic 24px Georgia,serif;color:var(--jb-wine)}.jb-step h3{font:600 22px Georgia,"Noto Serif KR",serif;margin:40px 0 10px}.jb-step p{color:#617177;font-size:13px;line-height:1.75;margin:0}.jb-step-tag{display:inline-block;margin-top:20px;border-bottom:1px solid var(--jb-teal);padding-bottom:3px;color:#315b58;font-size:11px;font-weight:800}
.jb-workbench{background:#112938;color:#fff;padding:clamp(62px,9vw,108px) clamp(20px,7vw,104px)}.jb-bench-inner{max-width:1180px;margin:auto;display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.2fr);gap:clamp(34px,7vw,90px);align-items:start}.jb-bench-copy{position:sticky;top:36px}.jb-bench-copy h2{font:500 clamp(31px,4vw,50px)/1.25 Georgia,"Noto Serif KR",serif;margin:14px 0}.jb-bench-copy p{color:#c1d0d5;line-height:1.8;font-size:14px}.jb-examples{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.jb-example{border:1px solid rgba(255,255,255,.22);background:transparent;color:#e7eef0;padding:10px 13px;border-radius:3px;cursor:pointer;font-size:12px}.jb-example[aria-pressed='true']{background:var(--jb-teal);border-color:var(--jb-teal);color:#08202b;font-weight:800}
.jb-book{background:#f7f3e9;color:#18303c;min-height:520px;border-radius:6px;padding:clamp(26px,5vw,54px);box-shadow:0 30px 80px rgba(0,0,0,.28)}.jb-book::before{content:'[예시] 책 설계 미리보기';display:block;color:#7b5260;font-size:10px;font-weight:800}.jb-book-title{font:500 clamp(28px,4vw,44px)/1.25 Georgia,"Noto Serif KR",serif;margin:26px 0 8px;max-width:13ch}.jb-book-sub{color:#637178;font-size:13px;margin-bottom:38px}.jb-toc{border-top:1px solid #bfc5c2}.jb-chapter{display:grid;grid-template-columns:54px 1fr;gap:15px;padding:18px 0;border-bottom:1px solid #d4d5cf}.jb-chapter b{font:italic 18px Georgia,serif;color:#a85c68}.jb-chapter h4{margin:0 0 6px;font-size:14px}.jb-chapter p{margin:0;color:#69777c;font-size:12px;line-height:1.65}.jb-note{margin-top:24px;color:#7b8588;font-size:10px;line-height:1.6}.jb-book-action{margin-top:24px;border:0;border-radius:4px;background:var(--jb-wine);color:#fff;padding:13px 17px;font-weight:800;cursor:pointer}
.jb-final{background:#e8ece8;color:var(--jb-ink);padding:60px 20px;text-align:center}.jb-final p{margin:0 0 16px;color:#52646b;font-size:13px}.jb-final strong{display:block;font:500 clamp(25px,4vw,38px) Georgia,"Noto Serif KR",serif;margin-bottom:24px}
.jb-root :focus-visible{outline:3px solid #f3c96f;outline-offset:3px}
@media(prefers-reduced-motion:reduce){.jb-hero::after{animation:none;opacity:.3;filter:none}.jb-root{scroll-behavior:auto}}
@media(max-width:760px){.jb-hero{min-height:88svh;background-position:62% center}.jb-hero::before{background:linear-gradient(0deg,rgba(6,18,28,.97) 0%,rgba(6,18,28,.76) 56%,rgba(6,18,28,.2) 100%)}.jb-top{padding:16px}.jb-brand span:last-child{display:none}.jb-copy{margin:0 20px 54px;width:auto}.jb-copy h1{font-size:43px}.jb-lead{font-size:15px}.jb-actions>*{flex:1 1 100%}.jb-scroll{display:none}.jb-section-head,.jb-bench-inner{grid-template-columns:1fr}.jb-steps{grid-template-columns:1fr}.jb-step,.jb-step+.jb-step{padding:24px 0;border-right:0;border-bottom:1px solid #d6d1c7;min-height:0}.jb-step:last-child{border-bottom:0}.jb-step h3{margin:18px 0 8px}.jb-bench-copy{position:static}.jb-book{min-height:0}}
`;

export const JihoonBookEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature }) => {
    const [selected, setSelected] = useState<BookKey>('small');
    const book = BOOKS[selected];

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({
            behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
    };

    return (
        <div className="jb-root" role="dialog" aria-modal="true" aria-label={`${guide.title} 별빛 책방`}>
            <style>{CSS}</style>
            <section className="jb-hero" id="jihoon-hero" aria-labelledby="jihoon-title">
                <header className="jb-top">
                    <div className="jb-brand"><span className="jb-mark" aria-hidden="true" /><span>강지훈의 편집실</span></div>
                    <button className="jb-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
                </header>
                <div className="jb-copy">
                    <div className="jb-eyebrow">AI WRITER · EDITOR · BOOKMAKER</div>
                    <h1 id="jihoon-title">당신의 이야기가<br /><span className="jb-star">한 권의 별</span>이 되는 곳</h1>
                    <p className="jb-lead">주제 한 줄이면 충분해요. <strong>강지훈 작가</strong>가 목차를 설계하고, 자료를 모아, 읽히는 원고로 함께 엮어드립니다.</p>
                    <div className="jb-actions">
                        <button className="jb-primary" type="button" onClick={() => onFeature('ebook')}>내 책 구상하기</button>
                        <button className="jb-secondary" type="button" onClick={() => onStart()}>강지훈과 대화하기</button>
                    </div>
                    <div className="jb-disclosure">화면의 책 내용은 예시이며, 선택하기 전에는 생성·저장되지 않습니다.</div>
                </div>
                <div className="jb-scroll" aria-hidden="true">BOOKMAKING PROCESS</div>
            </section>

            <section className="jb-process" aria-labelledby="jihoon-process-title">
                <div className="jb-section-head">
                    <div><div className="jb-kicker">FROM IDEA TO BOOK</div><h2 id="jihoon-process-title">생각을 원고로,<br />원고를 책으로</h2></div>
                    <p>복잡한 출판 과정을 세 개의 작업대로 나눴습니다. 지금 가진 것이 제목 하나뿐이어도 괜찮습니다. 각 단계에서 강지훈이 다음 질문을 건넵니다.</p>
                </div>
                <div className="jb-steps">
                    {[
                        ['01', '제목과 목차', '누가 읽을 책인지, 무엇을 남길지 정리해 책의 중심과 장별 흐름을 잡습니다.', '구조 설계'],
                        ['02', '자료와 문장', '필요한 근거와 사례를 모으고, 내 말투를 살려 각 장의 초안을 발전시킵니다.', '자료 정리'],
                        ['03', '편집과 완성', '제목, 본문, 표지 방향을 한 번 더 다듬어 실제 책으로 이어질 원고를 준비합니다.', '출판 원고'],
                    ].map(([num, title, body, tag]) => (
                        <article className="jb-step" key={num}><div className="jb-num">{num}</div><h3>{title}</h3><p>{body}</p><span className="jb-step-tag">{tag}</span></article>
                    ))}
                </div>
            </section>

            <section className="jb-workbench" id="jihoon-workbench" aria-labelledby="jihoon-bench-title">
                <div className="jb-bench-inner">
                    <div className="jb-bench-copy">
                        <div className="jb-kicker">[예시] EDITOR&apos;S DESK</div>
                        <h2 id="jihoon-bench-title">오늘은 어떤 책을<br />만들어볼까요?</h2>
                        <p>가까운 주제를 하나 골라보세요. 실제 생성 없이 책의 첫 구조가 어떻게 보일지 미리 펼쳐드립니다.</p>
                        <div className="jb-examples" role="group" aria-label="예시 주제">
                            {([['small', '작은 가게 이야기'], ['career', '나의 두 번째 직업'], ['record', '부모님의 생애 기록']] as [BookKey, string][]).map(([key, label]) => (
                                <button key={key} className="jb-example" type="button" aria-pressed={selected === key} onClick={() => setSelected(key)}>{label}</button>
                            ))}
                        </div>
                    </div>
                    <article className="jb-book" aria-live="polite">
                        <div className="jb-book-title">{book.title}</div><div className="jb-book-sub">{book.sub}</div>
                        <div className="jb-toc">
                            {book.chapters.map(([title, body], index) => (
                                <div className="jb-chapter" key={title}><b>0{index + 1}</b><div><h4>{title}</h4><p>{body}</p></div></div>
                            ))}
                        </div>
                        <div className="jb-note">이 내용은 화면 구성을 보여주기 위한 예시이며 선택하기 전에는 저장되거나 외부로 전송되지 않습니다.</div>
                        <button className="jb-book-action" type="button" onClick={() => onFeature('ebook')}>이 목차로 시작하기</button>
                    </article>
                </div>
            </section>
            <section className="jb-final"><p>강지훈의 별빛 책방</p><strong>한 줄의 생각이 책이 되는 밤</strong><button className="jb-primary" type="button" onClick={() => scrollTo('jihoon-hero')}>처음부터 다시 보기</button></section>
        </div>
    );
};
