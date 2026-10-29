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
  /** The room the channel belongs to. */
  roomId?: string;
  state: 'subscribing' | 'subscribed' | 'unsubscribed';
  /** With `unsubscribed`: why. 0 = you unsubscribed; 100 and above = the server refused or ended it. */
  code?: number;
  /** With `unsubscribed`: the reason, for example `Not a participant in this room`. */
  reason?: string;
}

/**
 * The room's live updates cannot be followed: messages were missed (after a
 * long disconnect) or the server refused the subscription. Reload the room's
 * messages; when `code` is set the server refused it and `reason` says why.
 */
export interface RecoveryFailedEvent {
  roomId: string;
  /** Set when the server refused the room subscription. */
  code?: number;
  /** The server's reason, for example `Not a participant in this room`. */
  reason?: string;
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
/**
 * The server refused the user's identity and a token refresh cannot fix it:
 * the token was revoked or invalid, the project requires a token, or your
 * tokenProvider failed. Typically: send the user to login.
 *
 * `code`: `token_revoked`, `token_invalid`, `token_required`, `token_expired`
 * (after a failed refresh) or `token_provider_failed`.
 */
export interface AuthErrorEvent {
  code: string;
  message: string;
  error?: unknown;
}

/**
 * A message from the offline outbox (`queueOfflineMessages`) was stored by the
 * Chat API. `message` is the server's copy; it carries the same
 * `clientMessageId`, so a screen can replace its pending copy (`localId`).
 */
export interface MessageSentEvent {
  /** The `id` of the pending copy `sendMessage()` returned (`local_<clientMessageId>`). */
  localId: string;
  clientMessageId: string;
  message: Message;
}

/**
 * A message left the offline outbox without being stored: the Chat API
 * refused it (`reason: 'rejected'`, for example not a member or a plan limit)
 * or it waited longer than 24 hours (`reason: 'expired'`).
 */
export interface MessageFailedEvent {
  localId: string;
  clientMessageId: string;
  roomId: string;
  error: Error;
  reason: 'rejected' | 'expired';
}

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
  authError: AuthErrorEvent;
  messageSent: MessageSentEvent;
  messageFailed: MessageFailedEvent;
};
