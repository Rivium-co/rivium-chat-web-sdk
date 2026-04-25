/** Message content types supported by RiviumChat. */
export type MessageType = 'text' | 'image' | 'file' | 'system';

/** Room types for conversations. */
export type RoomType = 'direct' | 'group';

/** Participant roles within a room. */
export type ParticipantRole = 'admin' | 'member';

/** Connection states for the realtime service. */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Subscription states for room channels. */
export type SubscriptionStatus = 'subscribing' | 'subscribed' | 'unsubscribed';

/** Represents a file attachment in a message. */
export interface Attachment {
  url: string;
  mimeType?: string;
  name?: string;
  size?: number;
}

/** Represents an emoji reaction on a message. */
export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

/** Represents a participant in a chat room. */
export interface Participant {
  id: string;
  externalUserId: string;
  displayName?: string;
  locale?: string;
  role: ParticipantRole;
  lastReadAt?: string;
  joinedAt: string;
}

/** Represents a chat room (conversation). */
export interface Room {
  id: string;
  type: RoomType;
  externalId?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  participants: Participant[];
}

/** Represents a chat message. */
export interface Message {
  id: string;
  roomId: string;
  senderUserId: string;
  content: string;
  type: MessageType;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  replyToId?: string;
  replyTo?: Message;
  isDeleted: boolean;
  createdAt: string;
  isEdited: boolean;
  editedAt?: string;
  editHistory?: Array<Record<string, string>>;
  isPinned: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
  reactions?: Reaction[];
  /** Local state flag for optimistic updates (not persisted) */
  isPending?: boolean;
  /** Local state flag for failed messages (not persisted) */
  isFailed?: boolean;
}

/** Paginated response for message queries. */
export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
}

/** Summary of unread messages across all rooms. */
export interface UnreadSummary {
  totalUnread: number;
  rooms: RoomUnread[];
}

/** Unread count for a specific room. */
export interface RoomUnread {
  roomId: string;
  externalId?: string;
  unreadCount: number;
}
