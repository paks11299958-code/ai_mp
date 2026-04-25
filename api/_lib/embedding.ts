import { GoogleGenAI } from '@google/genai';

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

export async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const ai = getAI();
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: text,
        });
        return response.embeddings?.[0]?.values ?? null;
    } catch (error) {
        console.error('[embedding]', error);
        return null;
    }
}
