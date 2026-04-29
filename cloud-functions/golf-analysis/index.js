'use strict';

const { GoogleGenAI } = require('@google/genai');
const { Storage } = require('@google-cloud/storage');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const BUCKET = 'ai-mp-media';

const GOLF_PROMPT = `당신은 엄격한 기준을 가진 전문 골프 티칭 프로입니다. 이 골프 스윙 영상을 분석하고 아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

채점 기준 (반드시 엄격하게 적용):
- 90~100: 투어 프로 수준 (극히 드묾)
- 80~89: 싱글 핸디캡, 상위 5% 아마추어
- 65~79: 보기 플레이어 수준 (평균 아마추어)
- 50~64: 기초는 있으나 다수 개선 필요
- 35~49: 기본기부터 전면 교정 필요
- 35 미만: 전반적 재교육 필요
대부분의 일반 아마추어는 50~68점대입니다. 점수에 인색하게 채점하여 개선 동기를 부여하세요.

{
  "overallScore": 0~100 사이 정수,
  "overallComment": "전반적인 스윙 평가 2~3문장 (한국어)",
  "sections": [
    {
      "name": "어드레스 & 셋업",
      "score": 0~100 정수,
      "comment": "이 구간 평가 1~2문장",
      "good": ["잘된 점1", "잘된 점2"],
      "improve": ["개선점1", "개선점2"]
    },
    { "name": "백스윙", "score": 0, "comment": "", "good": [], "improve": [] },
    { "name": "다운스윙", "score": 0, "comment": "", "good": [], "improve": [] },
    { "name": "임팩트", "score": 0, "comment": "", "good": [], "improve": [] },
    { "name": "팔로우스루", "score": 0, "comment": "", "good": [], "improve": [] }
  ],
  "topPriorities": ["가장 중요한 개선점1", "개선점2", "개선점3"],
  "recommendedDrills": ["추천 드릴1", "추천 드릴2", "추천 드릴3"]
}`;

exports.analyzeGolfSwing = async (req, res) => {
  // CORS — JWT 인증으로 보호하므로 오리진 제한 불필요
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // JWT 인증
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }

  const { videoUrl, personaId, mimeType, fileName } = req.body || {};
  if (!videoUrl || !personaId) return res.status(400).json({ error: '필수 항목 누락' });

  try {
    const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const gcsUri = videoUrl.replace(`https://storage.googleapis.com/${BUCKET}/`, `gs://${BUCKET}/`);

    // Gemini Vertex AI 분석
    const ai = new GoogleGenAI({
      vertexai: true,
      project: creds.project_id,
      location: 'us-central1',
      googleAuthOptions: { credentials: creds },
    });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [
        { fileData: { mimeType: mimeType || 'video/mp4', fileUri: gcsUri } },
        { text: GOLF_PROMPT },
      ]}],
    });
    const text = response.text?.trim() || '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('분석 결과 JSON 파싱 실패');
    const analysis = JSON.parse(match[0]);

    // GCS 영상 즉시 삭제 (개인정보 보호)
    const filePath = videoUrl.replace(`https://storage.googleapis.com/${BUCKET}/`, '');
    const storage = new Storage({ credentials: creds, projectId: creds.project_id });
    await storage.bucket(BUCKET).file(filePath).delete().catch(() => {});

    // DB 저장 (raw SQL)
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      `INSERT INTO "UserSwingAnalysis" ("userId", "personaId", "fileName", "analysisJson", "createdAt")
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id, "createdAt"`,
      [userId, personaId, fileName || null, JSON.stringify(analysis)]
    );
    await pool.end();

    return res.status(200).json({
      id: result.rows[0].id,
      analysis,
      createdAt: result.rows[0].createdAt,
    });
  } catch (e) {
    console.error('[analyzeGolfSwing]', e);
    return res.status(500).json({ error: '분석 실패: ' + (e.message || '알 수 없는 오류') });
  }
};
