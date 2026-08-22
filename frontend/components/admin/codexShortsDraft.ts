export type CodexShortsStatus = 'draft' | 'awaiting_assets' | 'ready';

export interface CodexShortsAssetMeta {
    name: string;
    type: string;
    size: number;
}

export interface CodexShortsSegmentDraft {
    id: string;
    caption: string;
    narration: string;
    direction: string;
    speaker: string;
    imagePrompt: string;
    image?: CodexShortsAssetMeta;
    audio?: CodexShortsAssetMeta;
}

export interface CodexShortsDraft {
    version: 1;
    id: string;
    title: string;
    brand: string;
    characterBible: string;
    sourceScript: string;
    segments: CodexShortsSegmentDraft[];
    status: CodexShortsStatus;
    createdAt: string;
    updatedAt: string;
}

export interface LayoutEstimate {
    safe: boolean;
    captionLines: number;
    narrationLines: number;
    cardHeight: number;
    gap: number;
}

const FIELD_RE = /^\s*(화면\s*연출|연출|화면\s*자막|자막|내레이션|나레이션|image\s*prompt|이미지\s*프롬프트)(?:\s*\(([^)]+)\))?\s*[:：]\s*(.*)$/i;
const SCENE_RE = /^\s*\[?\s*(?:장면|씬|scene)\s*[_#-]?\s*(\d+)\s*\]?[^\n]*$/gim;

const cleanValue = (value: string): string => value
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim();

const widthUnits = (value: string): number => Array.from(value).reduce((sum, char) => {
    if (/\s/.test(char)) return sum + 0.35;
    return sum + (char.charCodeAt(0) <= 0x7f ? 0.55 : 1);
}, 0);

const estimateLines = (value: string, maxUnits: number): number => {
    const paragraphs = value.split(/\r?\n/);
    return Math.max(1, paragraphs.reduce((sum, row) => sum + Math.max(1, Math.ceil(widthUnits(row) / maxUnits)), 0));
};

const makeSegmentId = (index: number): string => `scene-${index + 1}`;

function parseSceneBlock(block: string, index: number): CodexShortsSegmentDraft {
    const fields: Record<string, string[]> = { direction: [], caption: [], narration: [], imagePrompt: [] };
    let current: keyof typeof fields | null = null;
    let speaker = '';
    const leftovers: string[] = [];

    for (const rawLine of block.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const match = line.match(FIELD_RE);
        if (match) {
            const label = match[1].replace(/\s/g, '').toLowerCase();
            current = label.includes('자막') ? 'caption'
                : label.includes('레이션') ? 'narration'
                    : label.includes('프롬프트') || label.includes('prompt') ? 'imagePrompt'
                        : 'direction';
            if (current === 'narration' && match[2]) speaker = cleanValue(match[2]);
            if (match[3]) fields[current].push(match[3]);
            continue;
        }
        if (current) fields[current].push(line);
        else leftovers.push(line);
    }

    const narration = cleanValue(fields.narration.join(' ') || leftovers.join(' '));
    const direction = cleanValue(fields.direction.join(' '));
    const fallbackCaption = direction || narration || `장면 ${index + 1}`;
    const caption = cleanValue(fields.caption.join(' ') || fallbackCaption.slice(0, 34));
    const imagePrompt = cleanValue(fields.imagePrompt.join(' ') || direction);

    return {
        id: makeSegmentId(index),
        caption,
        narration,
        direction,
        speaker,
        imagePrompt,
    };
}

export function parseCodexShortsScript(source: string): CodexShortsSegmentDraft[] {
    const text = source.replace(/\r\n/g, '\n').trim();
    if (!text) return [];

    const matches = Array.from(text.matchAll(SCENE_RE));
    let blocks: string[];
    if (matches.length) {
        blocks = matches.map((match, index) => {
            const start = (match.index ?? 0) + match[0].length;
            const end = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length;
            return text.slice(start, end).trim();
        });
    } else {
        blocks = text.split(/\n\s*\n+/).map(row => row.trim()).filter(Boolean);
    }

    return blocks.slice(0, 10).map(parseSceneBlock).filter(row => row.caption && row.narration);
}

export function estimateSegmentLayout(segment: Pick<CodexShortsSegmentDraft, 'caption' | 'narration'>): LayoutEstimate {
    const captionLines = estimateLines(segment.caption, 12.5);
    const narrationLines = estimateLines(segment.narration, 15.5);
    const narrationTop = 1740 - (narrationLines * 76 + 20);
    const titleDrivenHeight = 940 - (captionLines - 1) * 104;
    const spaceDrivenHeight = narrationTop - 24 - 280 - 88 - captionLines * 104;
    const cardHeight = Math.min(940, titleDrivenHeight, spaceDrivenHeight);
    const captionBottom = 280 + cardHeight + 88 + captionLines * 104;
    const gap = narrationTop - captionBottom;
    return { safe: cardHeight >= 560 && gap >= 24, captionLines, narrationLines, cardHeight, gap };
}

export function deriveDraftStatus(segments: CodexShortsSegmentDraft[]): CodexShortsStatus {
    if (!segments.length) return 'draft';
    return segments.every(row => row.image && row.audio) ? 'ready' : 'awaiting_assets';
}

export function createCodexShortsDraft(now = new Date()): CodexShortsDraft {
    const iso = now.toISOString();
    const id = `codex-shorts-${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 19).replace(/:/g, '')}-${iso.slice(20, 23)}`;
    return {
        version: 1,
        id,
        title: '새 쇼츠',
        brand: 'AI 놀이터 · aichat.dbzone.kr',
        characterBible: '',
        sourceScript: '',
        segments: [],
        status: 'draft',
        createdAt: iso,
        updatedAt: iso,
    };
}

export function toRendererJob(draft: CodexShortsDraft): object {
    const imageExtension = (meta?: CodexShortsAssetMeta): string => {
        if (meta?.type === 'image/jpeg') return 'jpg';
        if (meta?.type === 'image/webp') return 'webp';
        return 'png';
    };
    return {
        id: draft.id,
        title: draft.title,
        brand: draft.brand,
        characterBible: draft.characterBible,
        segments: draft.segments.map((segment, index) => ({
            caption: segment.caption,
            text: segment.narration,
            image: `assets/scene${index + 1}.${imageExtension(segment.image)}`,
            audio: `audio/scene${index + 1}.mp3`,
            imagePrompt: segment.imagePrompt || segment.direction,
            tailPadding: 0.85,
        })),
    };
}

export function toImageTasks(draft: CodexShortsDraft): object[] {
    return draft.segments.flatMap((segment, index) => segment.image ? [] : [{
        segment: index,
        output: `assets/scene${index + 1}.png`,
        prompt: segment.imagePrompt || segment.direction,
        characterBible: draft.characterBible,
        caption: segment.caption,
        sceneNumber: index + 1,
    }]);
}
