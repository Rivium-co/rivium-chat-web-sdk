// Main client
export { RiviumChatClient } from './RiviumChatClient';

// Configuration
export { RiviumChatConfig, normalizeConfig } from './RiviumChatConfig';

// Models
export type {
  Attachment,
  ConnectionState,
  Message,
  MessageType,
  PaginatedMessages,
  Participant,
  ParticipantRole,
  Reaction,
  Room,
  RoomType,
  RoomUnread,
  SubscriptionStatus,
  UnreadSummary,
} from './models/types';

// Events
export type {
  RiviumChatEventMap,
  ConnectionStateEvent,
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
} from './events/events';

// Errors & Types
export { RiviumChatError } from './services/ApiService';
export type { Mention, SearchResult, UploadResult } from './services/ApiService';
