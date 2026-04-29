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
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: { username?: string; email: string };
    replies: BoardReply[];
    _count?: { replies: number };
}
