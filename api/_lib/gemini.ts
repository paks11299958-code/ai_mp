import { GoogleGenAI } from '@google/genai';

const MODEL_NAME = 'gemini-2.5-flash';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
    if (!aiInstance) {
        const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        if (!credsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set');
        const creds = JSON.parse(credsJson);
        aiInstance = new GoogleGenAI({
            vertexai: true,
            project: creds.project_id || process.env.VERTEX_PROJECT_ID,
            location: 'us-central1',
            googleAuthOptions: { credentials: creds },
        });
    }
    return aiInstance;
}

export async function extractMemories(userText: string, aiText: string): Promise<string[]> {
    const ai = getAI();
    const content = aiText
        ? `사용자: ${userText}\nAI: ${aiText}`
        : `대화 요약: ${userText}`;

    const prompt = `다음 대화에서 "사용자(인간)"에 대한 장기 기억으로 저장할 중요한 사실을 추출하세요.

[추출 대상]
사용자의 직업, 취미, 선호도, 목표, 가족, 거주지, 기술 스택 등 개인 정보

[절대 추출 금지]
- "AI:" 뒤에 나오는 내용 (AI 발화는 사용자 정보가 아님)
- AI 페르소나의 이름, 직업, 설정 (AI가 자신을 소개한 내용)
- 일반적인 대화 내용, 질문, 인사말
- 사용자가 명확히 언급하지 않은 추측성 정보

[주의]
반드시 "사용자:"가 직접 말한 내용만 추출하세요.

${content}

각 항목을 JSON 배열로 반환하세요. 추출할 내용이 없으면 빈 배열 []을 반환하세요.
반환 형식: ["사실1", "사실2"]`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const text = response.text?.trim() || '[]';
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) return [];
        return JSON.parse(match[0]) as string[];
    } catch {
        return [];
    }
}

export async function extractTriggerKeywords(title: string, description: string): Promise<string[]> {
    const ai = getAI();
    const prompt = `다음 영상의 제목과 설명을 보고, 채팅에서 이 영상을 재생할 때 사용할 트리거 키워드를 추출하세요.

제목: ${title}
설명: ${description || '(없음)'}

[추출 규칙]
- 사용자가 채팅에서 실제로 입력할 법한 짧은 단어/표현으로 추출
- 비슷한 표현을 여러 개 포함 (예: "안녕", "안녕하세요", "반가워", "방가워")
- 한국어 구어체 위주
- 10~20개 사이로 추출
- 쉼표 없이 JSON 배열로만 반환

반환 형식: ["키워드1", "키워드2", "키워드3"]`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const text = response.text?.trim() || '[]';
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) return [];
        return JSON.parse(match[0]) as string[];
    } catch {
        return [];
    }
}

export async function generateSummary(messages: { role: string; text: string }[]): Promise<string | null> {
    if (messages.length < 2) return null;
    const ai = getAI();

    const recent = messages.slice(-30);
    const conversation = recent
        .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.text}`)
        .join('\n');

    const prompt = `다음은 사용자와 AI의 대화입니다. 핵심 내용, 사용자의 주요 관심사, 중요한 결정사항을 4~6문장으로 간결하게 요약하세요. 한국어로 작성하세요.\n\n[대화]\n${conversation}\n\n[요약]`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        return response.text?.trim() || null;
    } catch (error) {
        console.error('[generateSummary]', error);
        return null;
    }
}
