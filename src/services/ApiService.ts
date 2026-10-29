import { SDK_CONFIG, type NormalizedConfig } from '../RiviumChatConfig';
import type { AuthErrorEvent } from '../events/events';
import type { TokenManager } from './TokenManager';
import { SDK_HEADER, SDK_HEADER_VALUE } from '../version';
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

/** Chat API route that issues the realtime connection token. */
const REALTIME_TOKEN_PATH = '/centrifugo/token';

/** Result from a message search operation. */
export interface SearchResult {
  messages: Message[];
  /** Number of messages that match the query. */
  total: number;
  /** @deprecated Use `total`. Same value. */
  totalCount: number;
  /** @deprecated Compare `offset + messages.length` with `total`. */
  hasMore: boolean;
}

/** Message thrown by `uploadFile()` and `updateRoom()`, which the API does not offer. */
export const UPLOAD_NOT_SUPPORTED =
  'uploadFile() is not supported: Rivium Chat does not store files. Upload the file to your own storage ' +
  'and send its URL as an attachment with sendMessage().';
export const UPDATE_ROOM_NOT_SUPPORTED =
  'updateRoom() is not supported: rooms cannot be changed from the client SDK. ' +
  'Set the name and metadata when you create the room.';

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
  /** The user who was mentioned. */
  mentionedUserId: string;
  /** When the mention was made (ISO 8601). */
  createdAt: string;
  /** @deprecated Use `mentionedUserId`. Same value. */
  userId: string;
  /** @deprecated Use `createdAt`. Same value. */
  mentionedAt: string;
  message: Message;
}

/** HTTP API service for RiviumChat backend. */
export class ApiService {
  private config: NormalizedConfig;

  constructor(
    config: NormalizedConfig,
    private readonly tokens?: TokenManager,
    private readonly onAuthError?: (event: AuthErrorEvent) => void,
  ) {
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

  /**
   * Not supported: the API has no route to change a room.
   * @deprecated Always rejects with a `RiviumChatError`.
   */
  async updateRoom(
    _roomId: string,
    _updates: {
      name?: string;
      metadata?: Record<string, unknown>;
      isActive?: boolean;
    }
  ): Promise<Room> {
    throw new RiviumChatError(UPDATE_ROOM_NOT_SUPPORTED);
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
    await this.request('DELETE', `/rooms/${roomId}/participants/${encodeURIComponent(userId)}`);
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
      /** Sent only by the offline outbox (`queueOfflineMessages`). */
      clientMessageId?: string;
    }
  ): Promise<Message> {
    return this.request<Message>('POST', `/rooms/${roomId}/messages`, {
      senderUserId: this.config.userId,
      content,
      type: options?.type ?? 'text',
      ...(options?.attachments && { attachments: options.attachments }),
      ...(options?.metadata && { metadata: options.metadata }),
      ...(options?.replyToId && { replyToId: options.replyToId }),
      ...(options?.clientMessageId && { clientMessageId: options.clientMessageId }),
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
    const result = await this.request<{ messages?: Message[]; total?: number }>(
      'GET',
      `/rooms/${roomId}/messages/search?${params.toString()}`
    );
    const messages = result?.messages ?? [];
    const total = result?.total ?? messages.length;
    return {
      messages,
      total,
      totalCount: total,
      hasMore: (options?.offset ?? 0) + messages.length < total,
    };
  }

  /** Get mentions for the current user in a room. */
  async getMentions(roomId: string, options?: { limit?: number; offset?: number }): Promise<Mention[]> {
    const params = new URLSearchParams();
    params.set('userId', this.config.userId);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const mentions = await this.request<Mention[]>('GET', `/rooms/${roomId}/mentions?${params.toString()}`);
    // Older releases typed these fields; fill them from what the API sends.
    return (mentions ?? []).map((m) => ({
      ...m,
      userId: m.userId ?? m.mentionedUserId,
      mentionedAt: m.mentionedAt ?? m.createdAt,
    }));
  }

  // ─── File Upload ───────────────────────────────────────────────────────

  /**
   * Not supported: Rivium Chat does not store files. Upload the file to your
   * own storage and send its URL as an attachment with `sendMessage()`.
   * @deprecated Always rejects with a `RiviumChatError`.
   */
  async uploadFile(_roomId: string, _file: Blob | File, _filename?: string): Promise<UploadResult> {
    throw new RiviumChatError(UPLOAD_NOT_SUPPORTED);
  }

  // ─── Presence ──────────────────────────────────────────────────────

  /** Get online users in a room via the server API. */
  async getRoomPresence(roomId: string): Promise<Set<string>> {
    const result = await this.request<{ online: string[] }>('GET', `/rooms/${roomId}/presence`);
    return new Set(result.online ?? []);
  }

  // ─── Realtime Token ─────────────────────────────────────────────────

  /** Get a realtime connection token. */
  async getRealtimeToken(userId: string, info?: Record<string, string>): Promise<string> {
    const result = await this.request<{ token: string }>('POST', REALTIME_TOKEN_PATH, {
      userId,
      ...(info && Object.keys(info).length > 0 ? { info } : {}),
    });
    return result.token;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  /** Gets a user token, reporting a failing tokenProvider as an auth error. */
  private async userToken(get: () => Promise<string>): Promise<string> {
    try {
      return await get();
    } catch (error) {
      this.onAuthError?.({ code: 'token_provider_failed', message: 'tokenProvider failed', error });
      throw new RiviumChatError('tokenProvider failed', undefined, String(error));
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${SDK_CONFIG.baseUrl}/api/v1${path}`;

    const send = async (token?: string): Promise<Response> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        'X-User-ID': this.config.userId,
        [SDK_HEADER]: SDK_HEADER_VALUE,
      };
      if (token) headers['X-User-Token'] = token;
      const options: RequestInit = { method, headers };
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      return fetchWithTimeout(url, options, this.config.requestTimeoutMs);
    };

    let response: Response;
    if (this.tokens) {
      response = await send(await this.userToken(() => this.tokens!.get()));
      // An expired token is routine: fetch a new one and replay the request
      // once. The user never sees it.
      if (response.status === 401 && (await authErrorCode(response.clone())) === 'token_expired') {
        response = await send(await this.userToken(() => this.tokens!.refresh()));
      }
    } else {
      response = await send();
    }

    if (!response.ok) {
      const errorData = await response.text();
      const code = response.status === 401 ? parseAuthCode(errorData) : undefined;
      if (code && this.tokens) {
        this.onAuthError?.({ code, message: parseMessage(errorData) });
      }
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

/** The identity error code (`token_*`) of a 401 body, if any. */
function parseAuthCode(text: string): string | undefined {
  try {
    const code = JSON.parse(text)?.code;
    return typeof code === 'string' && code.startsWith('token_') ? code : undefined;
  } catch {
    return undefined;
  }
}

function parseMessage(text: string): string {
  try {
    const message = JSON.parse(text)?.message;
    return typeof message === 'string' ? message : 'Authentication failed';
  } catch {
    return 'Authentication failed';
  }
}

async function authErrorCode(response: Response): Promise<string | undefined> {
  return parseAuthCode(await response.text());
}

/** Error thrown by RiviumChat SDK operations. */
export class RiviumChatError extends Error {
  public readonly statusCode?: number;
  public readonly responseData?: string;
  /** Set when the request failed before an answer: `'timeout'`. */
  public readonly code?: string;

  constructor(message: string, statusCode?: number, responseData?: string, code?: string) {
    super(message);
    this.name = 'RiviumChatError';
    this.statusCode = statusCode;
    this.responseData = responseData;
    this.code = code;
  }
}

/**
 * fetch() that gives up after `timeoutMs`: the request is aborted and the
 * promise rejects with a RiviumChatError (code `'timeout'`), also where
 * fetch ignores the abort signal.
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeoutError = new RiviumChatError(`Request timed out after ${timeoutMs / 1000} seconds`, undefined, undefined, 'timeout');
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject first, then abort: a browser's fetch rejects with AbortError the moment it is aborted, and that must
      // not win the race. The catch below maps any rejection after the timer fired to the timeout error too.
      timedOut = true;
      reject(timeoutError);
      controller?.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetch(url, controller ? { ...options, signal: controller.signal } : options),
      timeout,
    ]);
  } catch (error) {
    if (timedOut) throw timeoutError;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
