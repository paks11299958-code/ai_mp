// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { entryUrl, esc, renderCardHtml, renderNotFoundHtml, safeOccasion, scriptJson } from '../../api/card-share';

// api/card-share.ts(카드 받는 사람 페이지 /c/:id)의 순수 함수 검증.
// ★테스트가 api/ 밑에 있으면 Vercel 이 함수로 배포하므로 frontend 테스트 쪽에 둔다.

const CARD = {
    id: 'Abc123Def456', occasion: 'pass', toName: '민지', fromName: '준호',
    message: '민지야, 시험 붙었다니 정말 축하해! 🌸\n오늘은 마음껏 자랑해도 돼!', refCode: 'REF123', createdAt: '2026-09-28T00:00:00Z',
};
const XSS = '<script>alert(1)</script>';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const meta = (doc: Document, key: string) =>
    doc.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content');

describe('card-share 렌더링', () => {
    it('OG·title 값이 사양대로 나온다', () => {
        const doc = parse(renderCardHtml(CARD));
        expect(doc.title).toBe('💌 민지에게 은비가 카드를 전해요');
        expect(meta(doc, 'og:title')).toBe('💌 민지에게 은비가 카드를 전해요');
        expect(meta(doc, 'og:description')).toBe('준호님이 보낸 합격·시험 카드 · 눌러서 열어 보세요');
        expect(meta(doc, 'og:image')).toBe('https://aichat.dbzone.kr/eunbi/card_pass.jpg');
        expect(meta(doc, 'og:image:width')).toBe('720');
        expect(meta(doc, 'og:image:height')).toBe('894');
        expect(meta(doc, 'og:url')).toBe('https://aichat.dbzone.kr/c/Abc123Def456');
        expect(meta(doc, 'twitter:card')).toBe('summary_large_image');
    });

    it('받는 사람 화면: 이름·문구·버튼·안내가 서버 데이터로 들어가고 호칭을 다시 붙이지 않는다', () => {
        const doc = parse(renderCardHtml(CARD));
        expect(doc.getElementById('fromLine')!.textContent).toBe('준호님이 은비를 통해 카드를 보냈어요');
        expect(doc.getElementById('toLine')!.textContent).toBe('To. 민지');
        expect(doc.getElementById('sign')!.textContent).toBe('From. 준호 · 은비가 대신 전해요');
        expect(doc.getElementById('body')!.textContent).toBe(CARD.message);
        expect(doc.getElementById('artImg')!.getAttribute('src')).toBe('/eunbi/card_pass.jpg');
        expect(doc.getElementById('ribbon')!.textContent).toBe('축하해!');
        const reply = doc.getElementById('reply') as HTMLAnchorElement;
        const visit = doc.getElementById('visit') as HTMLAnchorElement;
        expect(reply.tagName).toBe('A');
        expect(reply.textContent).toBe('은비랑 답장 카드 보내기');
        expect(visit.textContent).toBe('나도 은비랑 놀러 가기');
        expect(reply.getAttribute('href')).toBe('https://aichat.dbzone.kr/?p=cmoogeutq000004ifpx8r9xv2&ref=REF123');
        expect(visit.getAttribute('href')).toBe(reply.getAttribute('href'));
        expect(doc.body.textContent).toContain('이 카드 링크로 가입하면 두 분 모두 +1,000P');
        expect(doc.getElementById('replay')!.textContent).toBe('처음부터 다시 보기');
        // 시안 전용 요소는 없다
        expect(doc.querySelector('.tabs, .chips, .memo, .demo-tag, #send')).toBeNull();
        expect(doc.body.textContent).not.toContain('민지야아');
    });

    it('refCode 가 없으면 ref 없는 진입 링크', () => {
        for (const refCode of [null, undefined, '']) {
            const doc = parse(renderCardHtml({ ...CARD, refCode }));
            expect(doc.getElementById('reply')!.getAttribute('href')).toBe('https://aichat.dbzone.kr/?p=cmoogeutq000004ifpx8r9xv2');
        }
        expect(entryUrl('a&b=c')).toBe('https://aichat.dbzone.kr/?p=cmoogeutq000004ifpx8r9xv2&ref=a%26b%3Dc');
    });

    it('잘못된 occasion 은 birthday 로 대체한다', () => {
        expect(safeOccasion('pass')).toBe('pass');
        for (const bad of ['../../etc', 'x" onerror="alert(1)', '', null, 'BIRTHDAY']) expect(safeOccasion(bad)).toBe('birthday');
        const html = renderCardHtml({ ...CARD, occasion: '"><script>alert(1)</script>' });
        const doc = parse(html);
        expect(meta(doc, 'og:image')).toBe('https://aichat.dbzone.kr/eunbi/card_birthday.jpg');
        expect(doc.getElementById('artImg')!.getAttribute('src')).toBe('/eunbi/card_birthday.jpg');
        expect(meta(doc, 'og:description')).toContain('생일 카드');
        expect(html).not.toContain('alert(1)');
    });

    it('XSS: 이름·문구의 <script> 는 실행 가능한 태그로 나오지 않는다', () => {
        const evil = { ...CARD, toName: XSS, fromName: `"'><img src=x onerror=alert(2)>`, message: `${XSS}</script><script>alert(3)</script>\u2028끝`, refCode: `"><script>alert(4)</script>` };
        const html = renderCardHtml(evil);
        const doc = parse(html);
        // 스크립트 태그는 우리가 넣은 2개(데이터·연출)뿐, 이미지도 카드 그림 1개뿐
        const scripts = Array.from(doc.querySelectorAll('script'));
        expect(scripts).toHaveLength(2);
        scripts.forEach(s => expect(s.textContent).not.toMatch(/<\/?script|<img/i));
        expect(doc.querySelectorAll('img')).toHaveLength(1);
        expect(doc.querySelector('[onerror]')).toBeNull();
        // 값은 글자 그대로 보인다
        expect(doc.getElementById('toLine')!.textContent).toBe(`To. ${XSS}`);
        expect(doc.title).toBe(`💌 ${XSS}에게 은비가 카드를 전해요`);
        expect(meta(doc, 'og:description')).toBe(`"'><img src=x onerror=alert(2)>님이 보낸 합격·시험 카드 · 눌러서 열어 보세요`);
        // 데이터 스크립트를 실행하면 원래 문구가 그대로 복원된다
        const D = new Function(`${scripts[0].textContent}; return D;`)() as { occasion: string; message: string };
        expect(D).toEqual({ occasion: 'pass', message: evil.message });
        expect(scripts[0].textContent).not.toContain('\u2028');
        // 링크 href 에 따옴표·태그가 새지 않는다
        expect(doc.getElementById('reply')!.getAttribute('href')).toBe(
            'https://aichat.dbzone.kr/?p=cmoogeutq000004ifpx8r9xv2&ref=%22%3E%3Cscript%3Ealert(4)%3C%2Fscript%3E');
    });

    it('연출 스크립트는 사용자 값을 innerHTML 에 쓰지 않는다', () => {
        const scripts = parse(renderCardHtml(CARD)).querySelectorAll('script');
        expect(scripts[1].textContent).not.toContain('innerHTML');
        expect(scripts[1].textContent).toContain('D.message');
    });

    it('esc·scriptJson', () => {
        expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
        expect(scriptJson({ a: '</script>&\u2029' })).toBe('{"a":"\\u003c/script\\u003e\\u0026\\u2029"}');
    });

    it('찾을 수 없는 카드 안내 페이지', () => {
        const doc = parse(renderNotFoundHtml());
        expect(doc.querySelector('h1')!.textContent).toBe('카드를 찾을 수 없어요');
        const a = doc.querySelector('a')!;
        expect(a.textContent).toBe('은비 만나러 가기');
        expect(a.getAttribute('href')).toBe('https://aichat.dbzone.kr/?p=cmoogeutq000004ifpx8r9xv2');
        expect(doc.querySelectorAll('script')).toHaveLength(0);
    });

    it('레이아웃: 100vh 를 쓰지 않고 뷰포트 메타가 있다', () => {
        const html = renderCardHtml(CARD);
        expect(html).not.toMatch(/100vh/);
        expect(html).toContain('name="viewport"');
        expect(html).toContain('prefers-reduced-motion');
        expect(html).toContain('family=Jua&family=Gowun+Dodum&family=Nanum+Pen+Script');
    });
});
