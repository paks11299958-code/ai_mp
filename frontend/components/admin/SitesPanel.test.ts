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
