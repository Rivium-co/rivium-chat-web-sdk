/**
 * @rivium/web-chat-ui - React Chat Components for RiviumChat SDK
 *
 * A comprehensive UI toolkit for building chat interfaces with React.
 *
 * ## Quick Start
 *
 * ```tsx
 * import { RiviumChatProvider, ChatScreen, RiviumChatThemeProvider } from '@rivium/web-chat-ui';
 *
 * function App() {
 *   return (
 *     <RiviumChatProvider client={riviumChatClient}>
 *       <RiviumChatThemeProvider>
 *         <ChatScreen
 *           roomId="room-123"
 *           currentUserId="user-456"
 *         />
 *       </RiviumChatThemeProvider>
 *     </RiviumChatProvider>
 *   );
 * }
 * ```
 */

// State Management
export {
  RiviumChatProvider,
  useRiviumChatClient,
  useRiviumChatConnection,
  type RiviumChatProviderProps,
  type RiviumChatConfig,
  type RiviumChatClient,
  type Message,
  type Room,
  type Participant,
  type Attachment,
  type Reaction,
} from './state/RiviumChatProvider';

// Hooks
export {
  useChatChannel,
  type ChatChannelState,
  type ChatChannelActions,
} from './hooks/useChatChannel';

// Theme
export {
  RiviumChatThemeProvider,
  useRiviumChatTheme,
  type RiviumChatThemeProviderProps,
  type RiviumChatColors,
  type RiviumChatDimensions,
  type RiviumChatThemeValue,
  defaultLightColors,
  defaultDarkColors,
  defaultDimensions,
} from './theme/RiviumChatTheme';

// Components
export {
  ChatScreen,
  type ChatScreenProps,
  type FileUploader,
} from './components/ChatScreen';

export {
  ChatMessageBubble,
  type ChatMessageBubbleProps,
} from './components/ChatMessageBubble';

export {
  ChatInputField,
  type ChatInputFieldProps,
} from './components/ChatInputField';

export {
  TypingIndicator,
  TypingDots,
  CompactTypingIndicator,
  type TypingIndicatorProps,
  type TypingDotsProps,
  type CompactTypingIndicatorProps,
} from './components/TypingIndicator';

export {
  PresenceIndicator,
  PresenceStatus,
  type PresenceIndicatorProps,
  type PresenceStatusProps,
} from './components/PresenceIndicator';

export {
  UnreadBadge,
  UnreadDot,
  type UnreadBadgeProps,
  type UnreadDotProps,
} from './components/UnreadBadge';

export {
  MessageContextMenu,
  type MessageContextMenuProps,
  type MessageAction,
} from './components/MessageContextMenu';

export {
  MessageReactionPicker,
  MessageReactions,
  defaultReactions,
  type MessageReactionPickerProps,
  type MessageReactionsProps,
} from './components/MessageReactionPicker';

export {
  ChatRoomListTile,
  ChatRoomListTileSkeleton,
  type ChatRoomListTileProps,
} from './components/ChatRoomListTile';

export {
  SwipeableMessage,
  type SwipeableMessageProps,
} from './components/SwipeableMessage';

export {
  ReplyPreview,
  InlineReplyIndicator,
  type ReplyPreviewProps,
  type ReplyMessage,
  type InlineReplyIndicatorProps,
} from './components/ReplyPreview';

export {
  ReadReceipts,
  ReadStatus,
  ReadReceiptList,
  type ReadReceiptsProps,
  type ReadReceiptUser,
  type ReadStatusProps,
  type ReadReceiptListProps,
} from './components/ReadReceipts';

export {
  MentionsList,
  MentionChip,
  type MentionsListProps,
  type MentionUser,
  type MentionChipProps,
} from './components/MentionsList';

export {
  VoiceMessageRecorder,
  VoiceMessagePlayer,
  type VoiceMessageRecorderProps,
  type VoiceMessagePlayerProps,
} from './components/VoiceMessageRecorder';

export {
  MessageSearchBar,
  HighlightedText,
  type MessageSearchBarProps,
  type SearchResult,
  type HighlightedTextProps,
} from './components/MessageSearchBar';

export {
  LinkPreview,
  extractUrls,
  isValidUrl,
  type LinkPreviewProps,
  type LinkMetadata,
} from './components/LinkPreview';

export {
  ChatAttachmentPicker,
  AttachmentPreview,
  type ChatAttachmentPickerProps,
  type AttachmentPreviewProps,
  type AttachmentOption,
  type SelectedAttachment,
} from './components/ChatAttachmentPicker';
