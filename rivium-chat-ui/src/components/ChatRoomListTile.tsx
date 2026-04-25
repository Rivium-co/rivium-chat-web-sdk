import React, { ReactNode } from 'react';
import { clsx } from 'clsx';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';
import { Room, Message } from '../state/RiviumChatProvider';
import { PresenceIndicator } from './PresenceIndicator';
import { UnreadBadge } from './UnreadBadge';
import { TypingDots } from './TypingIndicator';

export interface ChatRoomListTileProps {
  room: Room;
  lastMessage?: Message | null;
  unreadCount?: number;
  isMuted?: boolean;
  isPinned?: boolean;
  isTyping?: boolean;
  isOnline?: boolean;
  onClick: () => void;
  avatar?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function ChatRoomListTile({
  room,
  lastMessage,
  unreadCount = 0,
  isMuted = false,
  isPinned = false,
  isTyping = false,
  isOnline = false,
  onClick,
  avatar,
  title,
  subtitle,
  trailing,
  className,
}: ChatRoomListTileProps) {
  const { colors, dimensions } = useRiviumChatTheme();

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    if (differenceInDays(new Date(), date) < 7) {
      return format(date, 'EEE');
    }
    return format(date, 'dd/MM/yy');
  };

  const formatLastMessage = (message: Message) => {
    switch (message.type) {
      case 'image':
        return '📷 Photo';
      case 'file':
        return '📎 File';
      case 'system':
        return message.content;
      default:
        return message.content;
    }
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-left',
        isPinned && 'bg-gray-50',
        className
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatar || (
          <div
            className="flex items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold"
            style={{
              width: dimensions.avatarSize,
              height: dimensions.avatarSize,
            }}
          >
            {(room.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        {isOnline && (
          <PresenceIndicator
            isOnline
            size={14}
            className="absolute -bottom-0.5 -right-0.5"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-1">
          {title || (
            <span
              className={clsx(
                'truncate',
                unreadCount > 0 ? 'font-semibold' : 'font-normal'
              )}
            >
              {room.name || 'Chat'}
            </span>
          )}
          {isPinned && (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          )}
          {isMuted && (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Subtitle */}
        <div className="flex items-center gap-1 mt-0.5">
          {subtitle || (
            isTyping ? (
              <div className="flex items-center gap-1">
                <TypingDots dotSize={6} />
                <span className="text-sm" style={{ color: colors.typingIndicator }}>
                  typing...
                </span>
              </div>
            ) : (
              <span
                className={clsx(
                  'text-sm truncate',
                  unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'
                )}
              >
                {lastMessage ? formatLastMessage(lastMessage) : 'No messages yet'}
              </span>
            )
          )}
        </div>
      </div>

      {/* Trailing */}
      {trailing || (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {lastMessage?.createdAt && (
            <span
              className="text-xs"
              style={{
                color: unreadCount > 0 ? colors.linkText : colors.timestampText,
              }}
            >
              {formatTimestamp(lastMessage.createdAt)}
            </span>
          )}
          {unreadCount > 0 && (
            <UnreadBadge
              count={unreadCount}
              backgroundColor={isMuted ? colors.offlineIndicator : undefined}
            />
          )}
        </div>
      )}
    </button>
  );
}

export function ChatRoomListTileSkeleton({ className }: { className?: string }) {
  const { dimensions } = useRiviumChatTheme();

  return (
    <div className={clsx('flex items-center gap-3 px-4 py-3', className)}>
      <div
        className="rounded-full bg-gray-200 animate-pulse flex-shrink-0"
        style={{
          width: dimensions.avatarSize,
          height: dimensions.avatarSize,
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-48 bg-gray-200 rounded animate-pulse mt-2" />
      </div>
      <div className="h-3 w-10 bg-gray-200 rounded animate-pulse flex-shrink-0" />
    </div>
  );
}

export default ChatRoomListTile;
