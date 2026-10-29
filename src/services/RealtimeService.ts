import { Centrifuge, Subscription } from 'centrifuge';
import { SDK_CONFIG, type NormalizedConfig } from '../RiviumChatConfig';
import type { Message } from '../models/types';
import type {
  RiviumChatEventMap,
  MessageDeletionEvent,
  MessageEditEvent,
  MessageEvent,
  MessagePinEvent,
  PresenceEvent,
  ReactionEvent,
  ReadReceiptEvent,
  RecoveryFailedEvent,
  RoomUpdatedEvent,
  SubscriptionStateEvent,
  TypingEvent,
} from '../events/events';

type EventCallback<K extends keyof RiviumChatEventMap> = (event: RiviumChatEventMap[K]) => void;

/**
 * Unsubscribe codes the client sets itself: 0 = unsubscribe() called,
 * 2 = client closed. Every other code comes from the server (a refusal or a
 * server-side unsubscribe).
 */
function isClientSideUnsubscribe(code: number | undefined): boolean {
  return code === undefined || code === 0 || code === 2;
}

/** Realtime service for RiviumChat. */
export class RealtimeService {
  private config: NormalizedConfig;
  private getToken: () => Promise<string>;
  private client: Centrifuge | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private eventListeners: Map<string, Set<EventCallback<keyof RiviumChatEventMap>>> = new Map();

  constructor(config: NormalizedConfig, getToken: () => Promise<string>) {
    this.config = config;
    this.getToken = getToken;
  }

  /** Connect to the realtime server. */
  async connect(): Promise<void> {
    if (this.client) return;

    let token: string;
    try {
      token = await this.getToken();
    } catch (error) {
      // No connection without a token (unknown key, token required, API
      // unreachable, tokenProvider failed): report it like any connection error.
      this.emit('connectionState', {
        state: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }

    this.client = new Centrifuge(SDK_CONFIG.realtimeUrl, {
      token,
      getToken: () => this.getToken(),
    });

    this.client.on('connecting', () => {
      this.emit('connectionState', { state: 'connecting' });
    });

    this.client.on('connected', () => {
      this.emit('connectionState', { state: 'connected' });
    });

    this.client.on('disconnected', () => {
      this.emit('connectionState', { state: 'disconnected' });
    });

    this.client.on('error', (ctx) => {
      this.emit('connectionState', { state: 'error', error: new Error(ctx.error.message) });
    });

    this.client.connect();
  }

  /** Disconnect from the realtime server. */
  disconnect(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.client?.disconnect();
    this.client = null;
  }

  /** Subscribe to a room's channels. */
  subscribeToRoom(roomId: string): void {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    this.subscribeToChatChannel(roomId);
    this.subscribeToTypingChannel(roomId);
    this.subscribeToPresenceChannel(roomId);
  }

  /** Subscribe only to chat channel (messages, read receipts) without presence/typing. */
  observeRoom(roomId: string): void {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }
    this.subscribeToChatChannel(roomId);
  }

  /** Leave presence and typing channels but keep chat channel for unread updates. */
  leaveRoom(roomId: string): void {
    const channels = [
      `typing:room_${roomId}`,
      `presence:room_${roomId}`,
    ];

    channels.forEach((channel) => {
      const sub = this.subscriptions.get(channel);
      if (sub) {
        sub.unsubscribe();
        sub.removeAllListeners();
        this.client?.removeSubscription(sub);
        this.subscriptions.delete(channel);
      }
    });
  }

  /** Unsubscribe from a room's channels. */
  unsubscribeFromRoom(roomId: string): void {
    const channels = [
      `chat:room_${roomId}`,
      `typing:room_${roomId}`,
      `presence:room_${roomId}`,
    ];

    channels.forEach((channel) => {
      const sub = this.subscriptions.get(channel);
      if (sub) {
        sub.unsubscribe();
        sub.removeAllListeners();
        this.client?.removeSubscription(sub);
        this.subscriptions.delete(channel);
      }
    });
  }

  /** When a typing indicator was last published, per room. */
  private lastTypingTime = new Map<string, number>();

  /** Publish a typing indicator over the realtime connection (throttled to 2 seconds per room). */
  async publishTyping(roomId: string): Promise<void> {
    const now = Date.now();
    if (now - (this.lastTypingTime.get(roomId) ?? 0) < 2000) return;
    this.lastTypingTime.set(roomId, now);

    const channel = `typing:room_${roomId}`;
    const sub = this.subscriptions.get(channel);
    if (!sub) return;

    try {
      await sub.publish({
        userId: this.config.userId,
        isTyping: true,
      });
    } catch (_) {
      // Ignore typing publish errors
    }
  }

  /** Get currently online users in a room via realtime presence. */
  async getRoomPresence(roomId: string): Promise<Set<string>> {
    const channel = `presence:room_${roomId}`;
    const sub = this.subscriptions.get(channel);
    if (!sub) return new Set();

    try {
      const result = await sub.presence();
      const users = new Set<string>();
      for (const clientInfo of Object.values(result.clients)) {
        if (clientInfo.user) {
          users.add(clientInfo.user);
        }
      }
      return users;
    } catch (_) {
      return new Set();
    }
  }

  /** Add event listener. */
  on<K extends keyof RiviumChatEventMap>(event: K, callback: EventCallback<K>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as EventCallback<keyof RiviumChatEventMap>);
  }

  /** Remove event listener. */
  off<K extends keyof RiviumChatEventMap>(event: K, callback: EventCallback<K>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as EventCallback<keyof RiviumChatEventMap>);
    }
  }

  /** Emit event to listeners. @internal */
  emit<K extends keyof RiviumChatEventMap>(event: K, data: RiviumChatEventMap[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  /** Forgets a subscription the server ended, so the next subscribe builds a fresh one. */
  private dropSubscription(channel: string, sub: Subscription): void {
    if (this.subscriptions.get(channel) !== sub) return;
    sub.removeAllListeners();
    this.client?.removeSubscription(sub);
    this.subscriptions.delete(channel);
  }

  /** Drops the subscription when the server refuses or ends it. */
  private dropWhenRefused(channel: string, sub: Subscription): void {
    sub.on('unsubscribed', (ctx) => {
      if (ctx && !isClientSideUnsubscribe(ctx.code)) this.dropSubscription(channel, sub);
    });
  }

  private subscribeToChatChannel(roomId: string): void {
    const channel = `chat:room_${roomId}`;
    if (this.subscriptions.has(channel)) return;

    const sub = this.client!.newSubscription(channel, {
      recoverable: true,
    });

    sub.on('subscribing', () => {
      this.emit('subscriptionState', {
        channel,
        state: 'subscribing',
      } as SubscriptionStateEvent);
    });

    sub.on('subscribed', (ctx) => {
      this.emit('subscriptionState', {
        channel,
        state: 'subscribed',
      } as SubscriptionStateEvent);

      // Check for recovery failure
      if (ctx.wasRecovering && !ctx.recovered) {
        this.emit('recoveryFailed', { roomId } as RecoveryFailedEvent);
      }
    });

    sub.on('unsubscribed', (ctx) => {
      this.emit('subscriptionState', {
        channel,
        roomId,
        state: 'unsubscribed',
        code: ctx?.code,
        reason: ctx?.reason,
      } as SubscriptionStateEvent);

      // The server refused or ended the subscription (for example: not a
      // participant of the room). The room is not followed any more: drop the
      // dead subscription so a later subscribeToRoom() tries again, and tell
      // the app, which should reload the room or show the refusal.
      if (ctx && !isClientSideUnsubscribe(ctx.code)) {
        this.dropSubscription(channel, sub);
        this.emit('recoveryFailed', {
          roomId,
          code: ctx.code,
          reason: ctx.reason,
        } as RecoveryFailedEvent);
      }
    });

    sub.on('error', () => {
      this.emit('recoveryFailed', {
        roomId,
      } as RecoveryFailedEvent);
    });

    sub.on('publication', (ctx) => {
      this.handleChatPublication(roomId, ctx.data);
    });

    sub.subscribe();
    this.subscriptions.set(channel, sub);
  }

  private subscribeToTypingChannel(roomId: string): void {
    const channel = `typing:room_${roomId}`;
    if (this.subscriptions.has(channel)) return;

    const sub = this.client!.newSubscription(channel);

    sub.on('publication', (ctx) => {
      this.handleTypingPublication(roomId, ctx.data);
    });
    this.dropWhenRefused(channel, sub);

    sub.subscribe();
    this.subscriptions.set(channel, sub);
  }

  private subscribeToPresenceChannel(roomId: string): void {
    const channel = `presence:room_${roomId}`;
    if (this.subscriptions.has(channel)) return;

    const sub = this.client!.newSubscription(channel, {
      joinLeave: true,
    });

    this.dropWhenRefused(channel, sub);

    sub.on('join', (ctx) => {
      this.emit('presence', {
        roomId,
        userId: ctx.info.user,
        isOnline: true,
      } as PresenceEvent);
    });

    sub.on('leave', (ctx) => {
      this.emit('presence', {
        roomId,
        userId: ctx.info.user,
        isOnline: false,
      } as PresenceEvent);
    });

    // Query current presence on subscribe to detect users who joined before us
    sub.on('subscribed', () => {
      sub.presence().then((result) => {
        for (const clientInfo of Object.values(result.clients)) {
          if (clientInfo.user) {
            this.emit('presence', {
              roomId,
              userId: clientInfo.user,
              isOnline: true,
            } as PresenceEvent);
          }
        }
      }).catch(() => {});
    });

    sub.subscribe();
    this.subscriptions.set(channel, sub);
  }

  private handleChatPublication(roomId: string, data: unknown): void {
    const json = data as { type?: string; event?: string; data?: unknown };
    // Backend may send 'event' or 'type' field
    const type = json.event ?? json.type;
    const eventData = (json.data as Record<string, unknown>) ?? (json as Record<string, unknown>);

    switch (type) {
      case 'message':
        this.emit('message', {
          message: eventData as unknown as Message,
        } as MessageEvent);
        break;

      case 'read':
      case 'read_receipt':
        this.emit('readReceipt', {
          userId: eventData.userId as string,
          roomId,
          readAt: new Date((eventData.readAt ?? eventData.lastReadAt ?? new Date().toISOString()) as string),
        } as ReadReceiptEvent);
        break;

      case 'deleted':
      case 'message_deleted':
        this.emit('messageDeleted', {
          messageId: eventData.messageId as string,
          roomId,
          deletedBy: eventData.deletedBy as string,
        } as MessageDeletionEvent);
        break;

      case 'message_edited':
        this.emit('messageEdited', {
          messageId: eventData.messageId as string,
          roomId,
          content: eventData.content as string,
          editedBy: eventData.editedBy as string,
          editedAt: new Date(eventData.editedAt as string),
        } as MessageEditEvent);
        break;

      case 'reaction_added':
      case 'reaction_removed':
        this.emit('reaction', {
          messageId: eventData.messageId as string,
          roomId,
          userId: eventData.userId as string,
          emoji: eventData.emoji as string,
          added: type === 'reaction_added',
          reactionId: eventData.reactionId as string | undefined,
        } as ReactionEvent);
        break;

      case 'message_pinned':
        this.emit('messagePinChanged', {
          messageId: eventData.messageId as string,
          roomId,
          userId: (eventData.pinnedBy ?? eventData.userId) as string,
          pinned: true,
          pinnedAt: eventData.pinnedAt ? new Date(eventData.pinnedAt as string) : undefined,
        } as MessagePinEvent);
        break;

      case 'message_unpinned':
        this.emit('messagePinChanged', {
          messageId: eventData.messageId as string,
          roomId,
          userId: (eventData.unpinnedBy ?? eventData.userId) as string,
          pinned: false,
        } as MessagePinEvent);
        break;

      case 'room_updated':
        this.emit('roomUpdated', {
          roomId,
          name: eventData.name as string | undefined,
          metadata: eventData.metadata as Record<string, unknown> | undefined,
          isActive: eventData.isActive as boolean | undefined,
        } as RoomUpdatedEvent);
        break;

      default:
        // Try parsing as a direct message if no type specified
        if (eventData && typeof eventData === 'object' && 'id' in eventData && 'content' in eventData) {
          this.emit('message', {
            message: eventData as unknown as Message,
          } as MessageEvent);
        }
    }
  }

  private handleTypingPublication(roomId: string, data: unknown): void {
    const json = data as { userId?: string; isTyping?: boolean };
    // Filter out own typing events
    if (!json.userId || json.userId === this.config.userId) return;

    this.emit('typing', {
      roomId,
      userId: json.userId,
      isTyping: json.isTyping ?? true,
    } as TypingEvent);
  }
}
