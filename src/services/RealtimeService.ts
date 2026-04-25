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

/** Realtime service for RiviumChat using Centrifugo. */
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

  /** Connect to the Centrifugo server. */
  async connect(): Promise<void> {
    if (this.client) return;

    const token = await this.getToken();

    this.client = new Centrifuge(SDK_CONFIG.centrifugoUrl, {
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

  /** Disconnect from the Centrifugo server. */
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

  private lastTypingTime = 0;

  /** Publish a typing indicator via Centrifugo (throttled to 2 seconds). */
  async publishTyping(roomId: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastTypingTime < 2000) return;
    this.lastTypingTime = now;

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

  /** Get currently online users in a room via Centrifugo presence. */
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

  /** Emit event to listeners. */
  private emit<K extends keyof RiviumChatEventMap>(event: K, data: RiviumChatEventMap[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
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

    sub.on('unsubscribed', () => {
      this.emit('subscriptionState', {
        channel,
        state: 'unsubscribed',
      } as SubscriptionStateEvent);
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

    sub.subscribe();
    this.subscriptions.set(channel, sub);
  }

  private subscribeToPresenceChannel(roomId: string): void {
    const channel = `presence:room_${roomId}`;
    if (this.subscriptions.has(channel)) return;

    const sub = this.client!.newSubscription(channel, {
      joinLeave: true,
    });

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
