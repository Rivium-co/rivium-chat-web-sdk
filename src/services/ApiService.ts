import { SDK_CONFIG, type NormalizedConfig } from '../RiviumChatConfig';
import type {
  Attachment,
  Message,
  MessageType,
  PaginatedMessages,
  Participant,
  ParticipantRole,
  Reaction,
  Room,
  RoomType,
  UnreadSummary,
} from '../models/types';

/** Result from a message search operation. */
export interface SearchResult {
  messages: Message[];
  totalCount: number;
  hasMore: boolean;
}

/** Result from a file upload operation. */
export interface UploadResult {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** Mention information for a user. */
export interface Mention {
  id: string;
  messageId: string;
  roomId: string;
  userId: string;
  mentionedAt: string;
  message: Message;
}

/** HTTP API service for RiviumChat backend. */
export class ApiService {
  private config: NormalizedConfig;

  constructor(config: NormalizedConfig) {
    this.config = config;
  }

  // ─── Room Operations ─────────────────────────────────────────────────

  /** Create a new chat room. */
  async createRoom(options: {
    type?: RoomType;
    name?: string;
    participants: Array<Record<string, string>>;
    metadata?: Record<string, unknown>;
  }): Promise<Room> {
    return this.request<Room>('POST', '/rooms', {
      type: options.type ?? 'direct',
      ...(options.name && { name: options.name }),
      participants: options.participants,
      ...(options.metadata && { metadata: options.metadata }),
    });
  }

  /** Find or create a room by external ID. */
  async findOrCreateRoom(options: {
    externalId: string;
    type?: RoomType;
    name?: string;
    participants: Array<Record<string, string>>;
    metadata?: Record<string, unknown>;
  }): Promise<Room> {
    const result = await this.request<Record<string, unknown>>('POST', '/rooms/find-or-create', {
      externalId: options.externalId,
      type: options.type ?? 'direct',
      ...(options.name && { name: options.name }),
      participants: options.participants,
      ...(options.metadata && { metadata: options.metadata }),
    });
    // API may return { room: {...}, created: bool }
    if (result && typeof result === 'object' && 'room' in result) {
      return result.room as Room;
    }
    return result as unknown as Room;
  }

  /** List all rooms for the current user. */
  async listRooms(): Promise<Room[]> {
    return this.request<Room[]>('GET', `/rooms?userId=${encodeURIComponent(this.config.userId)}`);
  }

  /** Get a room by ID. */
  async getRoom(roomId: string): Promise<Room> {
    return this.request<Room>('GET', `/rooms/${roomId}`);
  }

  /** Get a room by external ID. */
  async getRoomByExternalId(externalId: string): Promise<Room> {
    return this.request<Room>('GET', `/rooms/by-external-id/${encodeURIComponent(externalId)}`);
  }

  /** Update a room. */
  async updateRoom(
    roomId: string,
    updates: {
      name?: string;
      metadata?: Record<string, unknown>;
      isActive?: boolean;
    }
  ): Promise<Room> {
    return this.request<Room>('PATCH', `/rooms/${roomId}`, updates);
  }

  /** Delete a room. */
  async deleteRoom(roomId: string): Promise<void> {
    await this.request('DELETE', `/rooms/${roomId}`);
  }

  /** Add a participant to a room. */
  async addParticipant(
    roomId: string,
    options: {
      externalUserId: string;
      displayName?: string;
      locale?: string;
      role?: ParticipantRole;
    }
  ): Promise<Participant> {
    return this.request<Participant>('POST', `/rooms/${roomId}/participants`, {
      externalUserId: options.externalUserId,
      ...(options.displayName && { displayName: options.displayName }),
      ...(options.locale && { locale: options.locale }),
      ...(options.role && { role: options.role }),
    });
  }

  /** Remove a participant from a room. */
  async removeParticipant(roomId: string, userId: string): Promise<void> {
    await this.request('DELETE', `/rooms/${roomId}/participants/${userId}`);
  }

  // ─── Message Operations ──────────────────────────────────────────────

  /** Send a message to a room. */
  async sendMessage(
    roomId: string,
    content: string,
    options?: {
      type?: MessageType;
      attachments?: Attachment[];
      replyToId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Message> {
    return this.request<Message>('POST', `/rooms/${roomId}/messages`, {
      senderUserId: this.config.userId,
      content,
      type: options?.type ?? 'text',
      ...(options?.attachments && { attachments: options.attachments }),
      ...(options?.metadata && { metadata: options.metadata }),
      ...(options?.replyToId && { replyToId: options.replyToId }),
    });
  }

  /** Get messages for a room with pagination. */
  async getMessages(
    roomId: string,
    options?: { limit?: number; before?: string }
  ): Promise<PaginatedMessages> {
    const params = new URLSearchParams();
    params.set('userId', this.config.userId);
    params.set('limit', String(options?.limit ?? 50));
    if (options?.before) {
      params.set('before', options.before);
    }
    return this.request<PaginatedMessages>(
      'GET',
      `/rooms/${roomId}/messages?${params.toString()}`
    );
  }

  /** Delete a message. */
  async deleteMessage(messageId: string): Promise<void> {
    await this.request('DELETE', `/messages/${messageId}?userId=${encodeURIComponent(this.config.userId)}`);
  }

  /** Edit a message. */
  async editMessage(messageId: string, content: string): Promise<Message> {
    return this.request<Message>('PUT', `/messages/${messageId}`, {
      userId: this.config.userId,
      content,
    });
  }

  // ─── Read Status ─────────────────────────────────────────────────────

  /** Mark messages in a room as read. */
  async markAsRead(roomId: string): Promise<void> {
    await this.request('POST', `/rooms/${roomId}/read`, {
      userId: this.config.userId,
    });
  }

  /** Get unread summary for all rooms. */
  async getUnreadSummary(): Promise<UnreadSummary> {
    return this.request<UnreadSummary>('GET', `/rooms/unread-summary?userId=${encodeURIComponent(this.config.userId)}`);
  }

  // ─── Reactions ───────────────────────────────────────────────────────

  /** Add a reaction to a message. */
  async addReaction(messageId: string, emoji: string): Promise<Reaction> {
    return this.request<Reaction>('POST', `/messages/${messageId}/reactions`, {
      userId: this.config.userId,
      emoji,
    });
  }

  /** Remove a reaction from a message. */
  async removeReaction(messageId: string, emoji: string): Promise<void> {
    await this.request('DELETE', `/messages/${messageId}/reactions`, {
      userId: this.config.userId,
      emoji,
    });
  }

  /** Get all reactions for a message. */
  async getReactions(messageId: string): Promise<Reaction[]> {
    return this.request<Reaction[]>('GET', `/messages/${messageId}/reactions`);
  }

  // ─── Pinned Messages ───────────────────────────────────────────────────

  /** Pin a message. */
  async pinMessage(messageId: string): Promise<Message> {
    return this.request<Message>('POST', `/messages/${messageId}/pin`, {
      userId: this.config.userId,
    });
  }

  /** Unpin a message. */
  async unpinMessage(messageId: string): Promise<void> {
    await this.request('DELETE', `/messages/${messageId}/pin`, {
      userId: this.config.userId,
    });
  }

  /** Get all pinned messages in a room. */
  async getPinnedMessages(roomId: string): Promise<Message[]> {
    return this.request<Message[]>('GET', `/rooms/${roomId}/pinned`);
  }

  // ─── Search & Mentions ─────────────────────────────────────────────────

  /** Search messages in a room. */
  async searchMessages(
    roomId: string,
    query: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SearchResult> {
    const params = new URLSearchParams();
    params.set('userId', this.config.userId);
    params.set('q', query);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    return this.request<SearchResult>('GET', `/rooms/${roomId}/messages/search?${params.toString()}`);
  }

  /** Get mentions for the current user in a room. */
  async getMentions(roomId: string, options?: { limit?: number; offset?: number }): Promise<Mention[]> {
    const params = new URLSearchParams();
    params.set('userId', this.config.userId);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    return this.request<Mention[]>('GET', `/rooms/${roomId}/mentions?${params.toString()}`);
  }

  // ─── File Upload ───────────────────────────────────────────────────────

  /** Upload a file attachment. */
  async uploadFile(roomId: string, file: Blob | File, filename?: string): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file, filename);

    const url = `${SDK_CONFIG.baseUrl}/api/v1/rooms/${roomId}/upload`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'X-User-ID': this.config.userId,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new RiviumChatError(
        `HTTP error ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return response.json();
  }

  // ─── Presence ──────────────────────────────────────────────────────

  /** Get online users in a room via the server API. */
  async getRoomPresence(roomId: string): Promise<Set<string>> {
    const result = await this.request<{ online: string[] }>('GET', `/rooms/${roomId}/presence`);
    return new Set(result.online ?? []);
  }

  // ─── Centrifugo Token ───────────────────────────────────────────────

  /** Get a Centrifugo connection token. */
  async getCentrifugoToken(userId: string, info?: Record<string, string>): Promise<string> {
    const result = await this.request<{ token: string }>('POST', '/centrifugo/token', {
      userId,
      ...(info && Object.keys(info).length > 0 ? { info } : {}),
    });
    return result.token;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${SDK_CONFIG.baseUrl}/api/v1${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
      'X-User-ID': this.config.userId,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.text();
      throw new RiviumChatError(
        `HTTP error ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }
}

/** Error thrown by RiviumChat SDK operations. */
export class RiviumChatError extends Error {
  public readonly statusCode?: number;
  public readonly responseData?: string;

  constructor(message: string, statusCode?: number, responseData?: string) {
    super(message);
    this.name = 'RiviumChatError';
    this.statusCode = statusCode;
    this.responseData = responseData;
  }
}
