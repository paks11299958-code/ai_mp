import { describe, expect, it } from 'vitest';
import { resolveSiteUrl, siteThumbUrl } from './SitesPanel';

describe('resolveSiteUrl', () => {
    it('keeps a standalone absolute domain unchanged', () => {
        expect(resolveSiteUrl('https://aiworld.dbzone.kr/')).toBe('https://aiworld.dbzone.kr/');
    });

    it('resolves a repository site path against the main domain', () => {
        expect(resolveSiteUrl('/sites/widget-demo/')).toBe('https://aichat.dbzone.kr/sites/widget-demo/');
    });
});

describe('siteThumbUrl', () => {
    it('공개 사이트는 sites/_thumbs/<이름>.webp', () => {
        expect(siteThumbUrl({ name: 'rentalfit-v2', url: '/sites/rentalfit-v2/' })).toBe('https://aichat.dbzone.kr/sites/_thumbs/rentalfit-v2.webp');
        expect(siteThumbUrl({ name: 'ainara-cube', url: 'https://aiworld.dbzone.kr/' })).toBe('https://aichat.dbzone.kr/sites/_thumbs/ainara-cube.webp');
    });
    it('비공개 사이트는 같은 비공개 경로의 thumb.webp(공개 폴더에 두지 않음)', () => {
        expect(siteThumbUrl({ name: 'ansem', url: '/api/admin/private-sites/ansem/index.html' })).toBe('https://aichat.dbzone.kr/api/admin/private-sites/ansem/thumb.webp');
    });
});

// 2026-10-10 사장 지시 "리스트 옆에 어드민 로그인 안 해도 볼 수 있는 체크".
describe('siteView — 로그인 없이 보기 체크 상태', () => {
    it('서버가 준 값을 그대로 쓴다(비공개 폴더 + 공개 켬 = /p/ 주소)', async () => {
        const { siteView } = await import('./SitesPanel');
        const v = siteView({ name: 'ansem', url: '/api/admin/private-sites/ansem/index.html', desc: '', storage: 'private', isPublic: true, canToggle: true, viewUrl: '/p/ansem/index.html', thumbUrl: '/api/admin/private-sites/ansem/thumb.webp' });
        expect(v).toEqual({ storage: 'private', isPublic: true, canToggle: true, viewUrl: 'https://aichat.dbzone.kr/p/ansem/index.html', thumbUrl: 'https://aichat.dbzone.kr/api/admin/private-sites/ansem/thumb.webp' });
    });
    it('옛 서버 응답(필드 없음)이면 주소로 미루어 채운다', async () => {
        const { siteView } = await import('./SitesPanel');
        expect(siteView({ name: 'rentalfit', url: '/sites/rentalfit/', desc: '' })).toMatchObject({ storage: 'git', isPublic: true, canToggle: true });
        expect(siteView({ name: 'ansem', url: '/api/admin/private-sites/ansem/index.html', desc: '' })).toMatchObject({ storage: 'private', isPublic: false, canToggle: true });
        expect(siteView({ name: 'cube', url: 'https://aiworld.dbzone.kr/', desc: '' })).toMatchObject({ storage: 'external', isPublic: true, canToggle: false });
    });
});
