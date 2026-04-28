export type Role = 'user' | 'model';

export interface Message {
    id: string;
    role: Role;
    text: string;
    isStreaming?: boolean;
    error?: boolean;
}

export type PersonaStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'archived';
export type MediaStatus = 'pending' | 'approved';

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
    status: PersonaStatus;
    createdBy?: number;
    createdAt?: string;
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
    status: MediaStatus;
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
    status: MediaStatus;
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
    personaQuota: number;
    personaXp: Record<string, number>;
}

export interface PersonaQuotaRequest {
    id: number;
    userId: number;
    status: 'pending' | 'approved' | 'rejected';
    note?: string;
    createdAt: string;
    updatedAt: string;
    user?: { id: number; username?: string; email: string; personaQuota: number };
}

export interface PersonaDashboardEntry {
    id: string;
    name: string;
    status: PersonaStatus;
    createdAt: string;
    totalXp: number;
    totalUsers: number;
    totalSessions: number;
}

export interface DbSession {
    id: number;
    personaId: string;
    title: string;
    updatedAt: string;
    persona: Pick<Persona, 'id' | 'name' | 'iconName' | 'colorClass'>;
}
