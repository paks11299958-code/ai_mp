import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTokenFromRequest, verifyToken } from './_lib/auth.js';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// TTS 사용량 기록 — 2026-07-22: 숏츠 만들기(회원용) 도입으로 TTS 호출이 급증할 수 있는데,
// ai_cost_guard.py(rag/, 매일 아침 비용 감시)는 지금까지 Gemini/OpenAI 종량제만 보고 TTS는
// 전혀 추적하지 않았음(무료 티어 월 100만자 초과 시 자동 유료 전환, 눈에 안 보이는 사각지대).
// Chirp3-HD 단가 $30/100만자(문자 과금) — AiUsageLog는 토큰 스키마라 embedding과 동일하게
// 문자수/4를 promptTokens로 근사하고 costUsd는 직접 계산해 넣는다.
// 이 함수는 shared-api(서버1 Express)가 아니라 Vercel 함수라 Prisma를 못 쓰므로 pg로 직결.
const TTS_COST_PER_CHAR = 30 / 1_000_000;
let _pool: Pool | null = null;
function getPool(): Pool {
    if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    return _pool;
}
async function logTtsUsage(charCount: number, userId: number | null): Promise<void> {
    try {
        const costUsd = charCount * TTS_COST_PER_CHAR;
        const approxTokens = Math.round(charCount / 4);
        await getPool().query(
            `INSERT INTO "AiUsageLog" (service, model, feature, "promptTokens", "completionTokens", "totalTokens", "costUsd", "userId", "createdAt")
             VALUES ($1, $2, $3, $4, 0, $4, $5, $6, NOW())`,
            ['google-tts', 'chirp3-hd', 'shorts-tts', approxTokens, costUsd, userId]);
    } catch (e: any) {
        console.error('[TTS] 사용량 로그 실패(무해):', e.message);
    }
}

function mdToPlain(text: string): string {
    return text
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`{1,3}/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[-*+]\s/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// 숏츠 만들기(이아린) 다국어 지원 — Chirp3-HD가 5개 언어 모두 지원 확인됨(2026-07-22).
// 대본 자체를 해당 언어로 생성하므로 여기선 voice만 언어에 맞게 고르면 됨(번역 X).
const VOICE_BY_LANG: Record<string, string> = {
    ko: 'ko-KR-Chirp3-HD-Leda',
    zh: 'cmn-CN-Chirp3-HD-Achernar',
    ja: 'ja-JP-Chirp3-HD-Achernar',
    en: 'en-US-Chirp3-HD-Achernar',
    vi: 'vi-VN-Chirp3-HD-Achernar',
};
const LANG_CODE: Record<string, string> = { ko: 'ko-KR', zh: 'cmn-CN', ja: 'ja-JP', en: 'en-US', vi: 'vi-VN' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
    let userId: number | null = null;
    try { ({ userId } = verifyToken(token)); } catch { return res.status(401).json({ error: '유효하지 않은 토큰입니다.' }); }

    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: '텍스트가 필요합니다.' });
    if (text.length > 4800) return res.status(400).json({ error: '텍스트가 너무 깁니다.' });

    const lang = String(req.body?.language || 'ko');
    const category = String(req.body?.category || '').trim();
    const languageCode = LANG_CODE[lang] || LANG_CODE.ko;
    const requestedVoice = String(req.body?.voiceName || '').trim();
    // 우선순위(2026-08-03 확장): ①회원이 신청 시 직접 고른 목소리 → ②카테고리별 어드민
    // 지정 → ③언어 전역 어드민 지정 → ④하드코딩 기본값. 회원 선택이 최우선인 이유는
    // "고르게 해달라"는 요청 자체가 그 요청 1건에 한정된 의사결정이라, 어드민의 전역/
    // 카테고리 기본값보다 구체적이기 때문. AppConfig 키: shorts_voice_{lang}(전역) /
    // shorts_voice_{lang}_{category}(카테고리별).
    let voiceName = VOICE_BY_LANG[lang] || VOICE_BY_LANG.ko;
    // 언어 접두사가 맞는 것만 채택 — 잘못된 값이 그대로 외부 API로 나가지 않게(회원 선택도 예외 없음).
    if (requestedVoice && requestedVoice.startsWith(languageCode + '-')) {
        voiceName = requestedVoice;
    } else {
        try {
            const keys = category ? [`shorts_voice_${lang}_${category}`, `shorts_voice_${lang}`] : [`shorts_voice_${lang}`];
            const r = await getPool().query(
                'SELECT key, value FROM "AppConfig" WHERE key = ANY($1)', [keys]);
            const byKey = new Map<string, string>(r.rows.map((row: any) => [row.key, row.value]));
            const picked = (keys.map(k => byKey.get(k)).find(v => v) || '').trim();
            if (picked && picked.startsWith(languageCode + '-')) voiceName = picked;
        } catch { /* 기본 목소리로 진행 */ }
    }

    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) return res.status(500).json({ error: 'Google TTS 설정이 없습니다.' });

    let tmpFile: string | null = null;
    try {
        // 임시 파일로 credentials 저장
        tmpFile = path.join(os.tmpdir(), `gcp-tts-${Date.now()}.json`);
        fs.writeFileSync(tmpFile, credsJson, 'utf8');
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpFile;

        const client = new TextToSpeechClient();
        const plain = mdToPlain(text).slice(0, 4800);

        const [response] = await client.synthesizeSpeech({
            input: { text: plain },
            voice: {
                languageCode,
                name: voiceName,
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.05,
            },
        });

        void logTtsUsage(plain.length, userId);   // fire-and-forget — 응답 지연 없음

        const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.send(audioBuffer);
    } catch (e: any) {
        console.error('[TTS] Google TTS 오류:', e.message);
        return res.status(500).json({ error: `TTS 오류: ${e.message}` });
    } finally {
        if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
}
