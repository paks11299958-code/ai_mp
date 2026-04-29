export type Role = 'user' | 'model';

export interface Message {
    id: string;
    role: Role;
    text: string;
    isStreaming?: boolean;
    error?: boolean;
}

export interface Persona {
    id: string;
    name: string;
    jobTitle?: string;
    description: string;
    iconName: string;
    systemInstruction: string;
    identityPrompt?: string;
    colorClass: string;
    order?: number;
    imageUrl?: string;
    isDefault?: boolean;
    isVisible?: boolean;
}

export interface UserMemory {
    id: number;
    userId: number;
    content: string;
    category?: string;
    similarity?: number;
    createdAt: string;
}

export interface PersonaImage {
    id: number;
    personaId: string;
    imageUrl: string;
    description?: string;
    isMain: boolean;
    order: number;
    requiredLevel: number;
    createdAt: string;
    _count?: { videos: number };
}

export interface PersonaVideo {
    id: number;
    imageId: number;
    videoUrl: string;
    title?: string;
    order: number;
    requiredLevel: number;
    createdAt: string;
}

export interface ConversationSummary {
    id: number;
    sessionId: number;
    summary: string;
    messageCount: number;
    updatedAt: string;
}

export interface ChatSessionState {
    messages: Message[];
    isTyping: boolean;
    dbSessionId?: number;
    hasMoreMessages?: boolean;
    oldestMessageId?: number;
    summary?: ConversationSummary | null;
    isSummarizing?: boolean;
}

export interface User {
    id: number;
    email: string;
    username?: string;
    role: string;
    personaXp: Record<string, number>;
}

export interface DbSession {
    id: number;
    personaId: string;
    title: string;
    updatedAt: string;
    persona: Pick<Persona, 'id' | 'name' | 'iconName' | 'colorClass'>;
}

export interface TriggerVideo {
    id: number;
    personaId: string;
    videoUrl: string;
    title?: string;
    description?: string;
    keywords: string;
    tag?: string;
    order: number;
    createdAt: string;
}

export interface SwingAnalysisSection {
    name: string;
    score: number;
    comment: string;
    good: string[];
    improve: string[];
}

export interface SwingAnalysis {
    overallScore: number;
    overallComment: string;
    sections: SwingAnalysisSection[];
    topPriorities: string[];
    recommendedDrills: string[];
}

export interface UserSwingAnalysis {
    id: number;
    fileName?: string;
    createdAt: string;
    analysis: SwingAnalysis;
}

export interface BoardReply {
    id: number;
    postId: number;
    userId: number;
    isAdminReply: boolean;
    content: string;
    createdAt: string;
    user: { username?: string; email: string };
}

export interface BoardPost {
    id: number;
    userId: number;
    personaId: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: { username?: string; email: string };
    replies: BoardReply[];
    _count?: { replies: number };
}
