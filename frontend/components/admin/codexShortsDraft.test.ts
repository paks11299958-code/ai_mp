import { describe, expect, it } from 'vitest';
import {
    createCodexShortsDraft,
    deriveDraftStatus,
    estimateSegmentLayout,
    parseCodexShortsScript,
    toRendererJob,
} from './codexShortsDraft';

describe('Codex 쇼츠 공장 초안', () => {
    it('장면형 대본에서 연출·자막·화자·내레이션을 보존한다', () => {
        const rows = parseCodexShortsScript(`
[장면 1]
화면 연출: 저녁 식탁에서 휴대폰을 보는 한국인 아내
화면 자막: 가지 말라고 하자니 치사하고
내레이션 (지은): "보내주자니 마음이 씁쓸해요."

[장면 2]
화면 연출: 남편이 조심스럽게 대화를 건다
화면 자막: 마음을 말해 보세요
나레이션 (민수): 서운함은 순위의 문제가 아닙니다.
        `);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            caption: '가지 말라고 하자니 치사하고',
            narration: '보내주자니 마음이 씁쓸해요.',
            speaker: '지은',
        });
        expect(rows[1].direction).toContain('남편');
    });

    it('장면 표지가 없으면 문단을 장면으로 사용한다', () => {
        const rows = parseCodexShortsScript('첫 장면의 이야기입니다.\n\n두 번째 장면의 이야기입니다.');
        expect(rows).toHaveLength(2);
        expect(rows[0].narration).toBe('첫 장면의 이야기입니다.');
    });

    it('긴 제목과 내레이션은 안전영역 실패로 판정한다', () => {
        const estimate = estimateSegmentLayout({
            caption: '아주 긴 제목을 여러 줄로 표시해야 하는 장면입니다 정말 길어요',
            narration: '내레이션도 아주 길어서 화면 아래 영역을 많이 차지합니다. '.repeat(8),
        });
        expect(estimate.safe).toBe(false);
    });

    it('이미지와 음성이 모두 있어야 렌더 준비 상태가 된다', () => {
        const rows = parseCodexShortsScript('[장면 1]\n자막: 시작\n내레이션: 이야기');
        expect(deriveDraftStatus(rows)).toBe('awaiting_assets');
        rows[0].image = { name: 'a.png', type: 'image/png', size: 1 };
        rows[0].audio = { name: 'a.mp3', type: 'audio/mpeg', size: 1 };
        expect(deriveDraftStatus(rows)).toBe('ready');
    });

    it('v2 렌더러가 읽는 작업 JSON으로 내보낸다', () => {
        const draft = createCodexShortsDraft(new Date('2026-08-22T12:34:56Z'));
        draft.segments = parseCodexShortsScript('[장면 1]\n화면 연출: 식탁\n자막: 시작\n내레이션: 이야기');
        const job = toRendererJob(draft) as any;
        expect(job.id).toBe('codex-shorts-20260822-123456-000');
        expect(job.segments[0]).toMatchObject({ image: 'assets/scene1.png', audio: 'audio/scene1.mp3' });
    });
});
