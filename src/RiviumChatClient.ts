import { type RiviumChatConfig, type NormalizedConfig, normalizeConfig } from './RiviumChatConfig';
import { ApiService, type Mention, type SearchResult, type UploadResult } from './services/ApiService';
import { RealtimeService } from './services/RealtimeService';
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
} from './models/types';
import type { RiviumChatEventMap } from './events/events';

type EventCallback<K extends keyof RiviumChatEventMap> = (event: RiviumChatEventMap[K]) => void;

/**
 * Main entry point for the RiviumChat SDK.
 *
 * @example
 * ```typescript
 * const client = new RiviumChatClient({
 *   apiKey: 'your-api-key',
 *   userId: 'user-123',
 *   userInfo: { displayName: 'John Doe' },
 * });
 *
 * await client.connect();
 *
 * // Listen for messages
 * client.on('message', (event) => {
 *   console.log('New message:', event.message.content);
 * });
 *
 * // Send a message
 * const message = await client.sendMessage(roomId, 'Hello!');
 * ```
 */
export class RiviumChatClient {
  private config: NormalizedConfig;
  private apiService: ApiService;
  private realtimeService: RealtimeService;

  constructor(config: RiviumChatConfig) {
    this.config = normalizeConfig(config);
    this.apiService = new ApiService(this.config);
    this.realtimeService = new RealtimeService(
      this.config,
      () => this.apiService.getCentrifugoToken(this.config.userId, this.config.userInfo),
    );
  }

  // ─── Event Handling ────────────────────────────────────────────────────

  /**
   * Add event listener.
   *
   * @example
   * ```typescript
   * client.on('message', (event) => {
   *   console.log('New message:', event.message.content);
   * });
   *
   * client.on('typing', (event) => {
   *   console.log(`${event.userId} is ${event.isTyping ? 'typing' : 'not typing'}`);
   * });
   * ```
   */
  on<K extends keyof RiviumChatEventMap>(event: K, callback: EventCallback<K>): void {
    this.realtimeService.on(event, callback);
  }

  /** Remove event listener. */
  off<K extends keyof RiviumChatEventMap>(event: K, callback: EventCallback<K>): void {
    this.realtimeService.off(event, callback);
  }

  // ─── Connection ────────────────────────────────────────────────────────

  /** Connect to the RiviumChat realtime server. */
  async connect(): Promise<void> {
    await this.realtimeService.connect();
  }

  /** Disconnect from the RiviumChat realtime server. */
  disconnect(): void {
    this.realtimeService.disconnect();
  }

  /** Clean up resources. */
  dispose(): void {
    this.disconnect();
  }

  // ─── Room Operations ───────────────────────────────────────────────────

  /**
   * Create a new chat room.
   *
   * @param options - Room creation options
   * @param options.type - Room type ('direct' or 'group'), defaults to 'direct'
   * @param options.name - Optional room name
   * @param options.participants - List of participant info
   * @param options.metadata - Optional metadata for the room
   */
  async createRoom(options: {
    type?: RoomType;
    name?: string;
    participants: Array<Record<string, string>>;
    metadata?: Record<string, unknown>;
  }): Promise<Room> {
    return this.apiService.createRoom(options);
  }

  /**
   * Find or create a room by external ID.
   *
   * @param options - Find or create options
   * @param options.externalId - Your application's ID for this conversation
   * @param options.type - Room type ('direct' or 'group'), defaults to 'direct'
   * @param options.name - Optional room name
   * @param options.participants - List of participant info
   * @param options.metadata - Optional metadata for the room
   */
  async findOrCreateRoom(options: {
    externalId: string;
    type?: RoomType;
    name?: string;
    participants: Array<Record<string, string>>;
    metadata?: Record<string, unknown>;
  }): Promise<Room> {
    return this.apiService.findOrCreateRoom(options);
  }

  /** List all rooms the current user is a participant in. */
  async listRooms(): Promise<Room[]> {
    return this.apiService.listRooms();
  }

  /** Get a room by ID. */
  async getRoom(roomId: string): Promise<Room> {
    return this.apiService.getRoom(roomId);
  }

  /** Get a room by external ID. */
  async getRoomByExternalId(externalId: string): Promise<Room> {
    return this.apiService.getRoomByExternalId(externalId);
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
    return this.apiService.updateRoom(roomId, updates);
  }

  /** Delete a room. */
  async deleteRoom(roomId: string): Promise<void> {
    return this.apiService.deleteRoom(roomId);
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
    return this.apiService.addParticipant(roomId, options);
  }

  /** Remove a participant from a room. */
  async removeParticipant(roomId: string, userId: string): Promise<void> {
    return this.apiService.removeParticipant(roomId, userId);
  }

  /** Subscribe to realtime events for a room. */
  subscribeToRoom(roomId: string): void {
    this.realtimeService.subscribeToRoom(roomId);
  }

  /** Subscribe only to chat channel for messages/read receipts, without joining presence or typing. */
  observeRoom(roomId: string): void {
    this.realtimeService.observeRoom(roomId);
  }

  /** Unsubscribe from realtime events for a room. */
  unsubscribeFromRoom(roomId: string): void {
    this.realtimeService.unsubscribeFromRoom(roomId);
  }

  /** Leave presence and typing channels but keep chat channel for unread updates. */
  leaveRoom(roomId: string): void {
    this.realtimeService.leaveRoom(roomId);
  }

  // ─── Message Operations ────────────────────────────────────────────────

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
    return this.apiService.sendMessage(roomId, content, options);
  }

  /** Get messages for a room with pagination. */
  async getMessages(
    roomId: string,
    options?: { limit?: number; before?: string }
  ): Promise<PaginatedMessages> {
    return this.apiService.getMessages(roomId, options);
  }

  /** Delete a message. */
  async deleteMessage(messageId: string): Promise<void> {
    return this.apiService.deleteMessage(messageId);
  }

  /** Edit a message. */
  async editMessage(messageId: string, content: string): Promise<Message> {
    return this.apiService.editMessage(messageId, content);
  }

  // ─── Read Status ───────────────────────────────────────────────────────

  /** Mark messages in a room as read. */
  async markAsRead(roomId: string): Promise<void> {
    return this.apiService.markAsRead(roomId);
  }

  /** Get unread summary for all rooms. */
  async getUnreadSummary(): Promise<UnreadSummary> {
    return this.apiService.getUnreadSummary();
  }

  // ─── Reactions ─────────────────────────────────────────────────────────

  /** Add a reaction to a message. */
  async addReaction(messageId: string, emoji: string): Promise<Reaction> {
    return this.apiService.addReaction(messageId, emoji);
  }

  /** Remove a reaction from a message. */
  async removeReaction(messageId: string, emoji: string): Promise<void> {
    return this.apiService.removeReaction(messageId, emoji);
  }

  /** Get all reactions for a message. */
  async getReactions(messageId: string): Promise<Reaction[]> {
    return this.apiService.getReactions(messageId);
  }

  // ─── Pinned Messages ──────────────────────────────────────────────────

  /** Pin a message. */
  async pinMessage(messageId: string): Promise<Message> {
    return this.apiService.pinMessage(messageId);
  }

  /** Unpin a message. */
  async unpinMessage(messageId: string): Promise<void> {
    return this.apiService.unpinMessage(messageId);
  }

  /** Get all pinned messages in a room. */
  async getPinnedMessages(roomId: string): Promise<Message[]> {
    return this.apiService.getPinnedMessages(roomId);
  }

  // ─── Search & Mentions ────────────────────────────────────────────────

  /** Search messages in a room. */
  async searchMessages(
    roomId: string,
    query: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SearchResult> {
    return this.apiService.searchMessages(roomId, query, options);
  }

  /** Get mentions for the current user in a room. */
  async getMentions(roomId: string, options?: { limit?: number; offset?: number }): Promise<Mention[]> {
    return this.apiService.getMentions(roomId, options);
  }

  // ─── File Upload ──────────────────────────────────────────────────────

  /** Upload a file attachment. */
  async uploadFile(roomId: string, file: Blob | File, filename?: string): Promise<UploadResult> {
    return this.apiService.uploadFile(roomId, file, filename);
  }

  // ─── Typing Indicator ──────────────────────────────────────────────────

  /** Publish a typing indicator via realtime. */
  async publishTyping(roomId: string): Promise<void> {
    return this.realtimeService.publishTyping(roomId);
  }

  // ─── Presence ──────────────────────────────────────────────────────────

  /** Get online users in a room via the server API. */
  async getRoomPresence(roomId: string): Promise<Set<string>> {
    return this.apiService.getRoomPresence(roomId);
  }

  // ─── Convenience Event Subscribers (for UI library compatibility) ─────

  /** Subscribe to new messages. Returns an unsubscribe function. */
  onMessage(callback: (event: RiviumChatEventMap['message']) => void): () => void {
    this.on('message', callback);
    return () => this.off('message', callback);
  }

  /** Subscribe to message deletions. Returns an unsubscribe function. */
  onMessageDeleted(callback: (event: RiviumChatEventMap['messageDeleted']) => void): () => void {
    this.on('messageDeleted', callback);
    return () => this.off('messageDeleted', callback);
  }

  /** Subscribe to message edits. Returns an unsubscribe function. */
  onMessageEdited(callback: (event: { messageId: string; newContent: string; editedAt: string }) => void): () => void {
    const handler = (event: RiviumChatEventMap['messageEdited']) => {
      callback({
        messageId: event.messageId,
        newContent: event.content,
        editedAt: event.editedAt instanceof Date ? event.editedAt.toISOString() : String(event.editedAt),
      });
    };
    this.on('messageEdited', handler);
    return () => this.off('messageEdited', handler);
  }

  /** Subscribe to reaction changes. Returns an unsubscribe function. */
  onReaction(callback: (event: { messageId: string; userId: string; emoji: string; isAdded: boolean }) => void): () => void {
    const handler = (event: RiviumChatEventMap['reaction']) => {
      callback({
        messageId: event.messageId,
        userId: event.userId,
        emoji: event.emoji,
        isAdded: event.added,
      });
    };
    this.on('reaction', handler);
    return () => this.off('reaction', handler);
  }

  /** Subscribe to typing events. Returns an unsubscribe function. */
  onTyping(callback: (event: RiviumChatEventMap['typing']) => void): () => void {
    this.on('typing', callback);
    return () => this.off('typing', callback);
  }

  /** Subscribe to presence changes. Returns an unsubscribe function. */
  onPresenceChange(callback: (event: RiviumChatEventMap['presence']) => void): () => void {
    this.on('presence', callback);
    return () => this.off('presence', callback);
  }

  /** Subscribe to read receipts. Returns an unsubscribe function. */
  onReadReceipt(callback: (event: { roomId: string; userId: string; lastReadAt: string }) => void): () => void {
    const handler = (event: RiviumChatEventMap['readReceipt']) => {
      callback({
        roomId: event.roomId,
        userId: event.userId,
        lastReadAt: event.readAt instanceof Date ? event.readAt.toISOString() : String(event.readAt),
      });
    };
    this.on('readReceipt', handler);
    return () => this.off('readReceipt', handler);
  }

  /** Subscribe to subscription state changes. Returns an unsubscribe function. */
  onSubscriptionState(callback: (event: RiviumChatEventMap['subscriptionState']) => void): () => void {
    this.on('subscriptionState', callback);
    return () => this.off('subscriptionState', callback);
  }
}
