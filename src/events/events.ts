import type { ConnectionState, Message } from '../models/types';

/** Event emitted when a new message is received. */
export interface MessageEvent {
  message: Message;
}

/** Event emitted when a user reads messages in a room. */
export interface ReadReceiptEvent {
  userId: string;
  roomId: string;
  readAt: Date;
}

/** Event emitted when a message is deleted. */
export interface MessageDeletionEvent {
  messageId: string;
  roomId: string;
  deletedBy: string;
}

/** Event emitted when a user is typing. */
export interface TypingEvent {
  roomId: string;
  userId: string;
  isTyping: boolean;
}

/** Event emitted when a reaction is added or removed. */
export interface ReactionEvent {
  messageId: string;
  roomId: string;
  userId: string;
  emoji: string;
  added: boolean;
  reactionId?: string;
}

/** Event emitted when a message is edited. */
export interface MessageEditEvent {
  messageId: string;
  roomId: string;
  content: string;
  editedBy: string;
  editedAt: Date;
}

/** Event emitted when a message is pinned or unpinned. */
export interface MessagePinEvent {
  messageId: string;
  roomId: string;
  userId: string;
  pinned: boolean;
  pinnedAt?: Date;
}

/** Event emitted when subscription state changes. */
export interface SubscriptionStateEvent {
  channel: string;
  state: 'subscribing' | 'subscribed' | 'unsubscribed';
}

/** Event emitted when recovery fails and full refresh is needed. */
export interface RecoveryFailedEvent {
  roomId: string;
}

/** Event emitted when a room is updated. */
export interface RoomUpdatedEvent {
  roomId: string;
  name?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

/** Event emitted when user presence changes. */
export interface PresenceEvent {
  roomId: string;
  userId: string;
  isOnline: boolean;
}

/** Event emitted when connection state changes. */
export interface ConnectionStateEvent {
  state: ConnectionState;
  error?: Error;
}

/** Event types for the RiviumChat client. */
export type RiviumChatEventMap = {
  connectionState: ConnectionStateEvent;
  message: MessageEvent;
  readReceipt: ReadReceiptEvent;
  typing: TypingEvent;
  presence: PresenceEvent;
  reaction: ReactionEvent;
  messageDeleted: MessageDeletionEvent;
  messageEdited: MessageEditEvent;
  messagePinChanged: MessagePinEvent;
  subscriptionState: SubscriptionStateEvent;
  recoveryFailed: RecoveryFailedEvent;
  roomUpdated: RoomUpdatedEvent;
};
