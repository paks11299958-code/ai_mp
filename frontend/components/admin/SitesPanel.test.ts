import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from './SitesPanel';

describe('resolveSiteUrl', () => {
    it('keeps a standalone absolute domain unchanged', () => {
        expect(resolveSiteUrl('https://aiworld.dbzone.kr/')).toBe('https://aiworld.dbzone.kr/');
    });

    it('resolves a repository site path against the main domain', () => {
        expect(resolveSiteUrl('/sites/widget-demo/')).toBe('https://aichat.dbzone.kr/sites/widget-demo/');
    });
});
