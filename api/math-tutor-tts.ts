import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTokenFromRequest, verifyToken } from './_lib/auth.js';

const ARIA_VOICE_ID = '9BWtsMINqrJLrRacOk9x';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
    try { verifyToken(token); } catch { return res.status(401).json({ error: '유효하지 않은 토큰입니다.' }); }

    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: '텍스트가 필요합니다.' });
    if (text.length > 2000) return res.status(400).json({ error: '텍스트가 너무 깁니다.' });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    console.log('[TTS] apiKey exists:', !!apiKey, 'prefix:', apiKey?.slice(0, 8));

    if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ARIA_VOICE_ID}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8,
                    style: 0.3,
                    use_speaker_boost: true,
                },
            }),
        });

        console.log('[TTS] ElevenLabs status:', response.status);

        if (!response.ok) {
            const err = await response.text();
            console.error('[TTS] ElevenLabs error:', err);
            return res.status(500).json({ error: `ElevenLabs ${response.status}: ${err}` });
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.send(buffer);
    } catch (e: any) {
        console.error('[TTS] 예외:', e.message);
        return res.status(500).json({ error: `서버 예외: ${e.message}` });
    }
}
