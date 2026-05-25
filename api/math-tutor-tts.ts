import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTokenFromRequest, verifyToken } from './_lib/auth.js';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
    try { verifyToken(token); } catch { return res.status(401).json({ error: '유효하지 않은 토큰입니다.' }); }

    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: '텍스트가 필요합니다.' });
    if (text.length > 4800) return res.status(400).json({ error: '텍스트가 너무 깁니다.' });

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
                languageCode: 'ko-KR',
                name: 'ko-KR-Chirp3-HD-Leda',
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.05,
            },
        });

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
