import React from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';
import { Message } from '../state/RiviumChatProvider';

export interface ChatMessageBubbleProps {
  message: Message;
  isMe: boolean;
  isRead?: boolean;
  showAvatar?: boolean;
  otherUserName?: string;
  mentionDisplayNames?: Record<string, string>;
  onRetry?: () => void;
  onReactionTap?: (emoji: string) => void;
  onLongPress?: () => void;
  onImageClick?: (url: string) => void;
  className?: string;
}

export function ChatMessageBubble({
  message,
  isMe,
  isRead = false,
  showAvatar = true,
  otherUserName,
  mentionDisplayNames,
  onRetry,
  onReactionTap,
  onLongPress,
  onImageClick,
  className,
}: ChatMessageBubbleProps) {
  const { colors, dimensions } = useRiviumChatTheme();

  if (message.isDeleted) {
    return (
      <div
        className={clsx(
          'flex px-2 py-0.5',
          isMe ? 'justify-end' : 'justify-start',
          className
        )}
      >
        <div
          className="px-3 py-2 italic text-gray-500 bg-gray-200/50 rounded-2xl"
          style={{ borderRadius: dimensions.messageBubbleRadius }}
        >
          This message was deleted
        </div>
      </div>
    );
  }

  const timestamp = format(new Date(message.createdAt), 'HH:mm');

  const bubbleStyle: React.CSSProperties = {
    backgroundColor: message.isFailed
      ? `${colors.failedMessage}33`
      : message.isPending
      ? isMe
        ? `${colors.myMessageBubble}99`
        : colors.otherMessageBubble
      : isMe
      ? colors.myMessageBubble
      : colors.otherMessageBubble,
    borderRadius: dimensions.messageBubbleRadius,
    maxWidth: `${dimensions.maxBubbleWidthRatio * 100}%`,
    padding: dimensions.messagePadding,
  };

  const textColor = isMe ? colors.myMessageText : colors.otherMessageText;

  // Group reactions by emoji
  const groupedReactions = (message.reactions ?? []).reduce((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div
      className={clsx(
        'flex items-end gap-2 px-2 py-0.5',
        isMe ? 'flex-row-reverse' : 'flex-row',
        className
      )}
    >
      {/* Avatar */}
      {!isMe && showAvatar && (
        <div
          className="flex items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-semibold flex-shrink-0"
          style={{
            width: dimensions.smallAvatarSize,
            height: dimensions.smallAvatarSize,
          }}
        >
          {(otherUserName || 'U').charAt(0).toUpperCase()}
        </div>
      )}
      {!isMe && !showAvatar && (
        <div style={{ width: dimensions.smallAvatarSize + 8 }} />
      )}

      <div className={clsx('flex flex-col', isMe ? 'items-end' : 'items-start')}>
        {/* Reply preview */}
        {message.replyTo && (
          <ReplyPreview message={message.replyTo} isMe={isMe} />
        )}

        {/* Message bubble */}
        <div
          style={bubbleStyle}
          className="cursor-pointer"
          onContextMenu={(e) => {
            e.preventDefault();
            onLongPress?.();
          }}
        >
          {/* Image attachments */}
          {(message.attachments ?? [])
            .filter((a) => a.mimeType?.startsWith('image/'))
            .map((attachment, idx) => (
              <img
                key={idx}
                src={attachment.url}
                alt={attachment.name || 'Image'}
                className="rounded-lg mb-1 cursor-pointer"
                style={{
                  width: '100%',
                  maxWidth: dimensions.imagePreviewSize,
                  height: 'auto',
                  display: 'block',
                }}
                onClick={() => {
                  if (onImageClick) {
                    onImageClick(attachment.url);
                  } else {
                    window.open(attachment.url, '_blank');
                  }
                }}
              />
            ))}

          {/* File attachments */}
          {(message.attachments ?? [])
            .filter((a) => !a.mimeType?.startsWith('image/'))
            .map((attachment, idx) => (
              <FileAttachmentChip
                key={idx}
                name={attachment.name || 'File'}
                size={attachment.size}
                url={attachment.url}
                isMe={isMe}
              />
            ))}

          {/* Message content with inline timestamp */}
          <p style={{ color: textColor }} className="text-sm break-words">
            {message.content}
            {/* Invisible spacer for timestamp */}
            <span style={{ display: 'inline-block', width: isMe ? 70 : 45, height: 1 }} />
          </p>

          {/* Timestamp and status — positioned bottom-right */}
          <div className="flex items-center justify-end gap-1" style={{ marginTop: -18, position: 'relative' }}>
            {message.isEdited && (
              <span
                className="text-xs italic"
                style={{ color: colors.timestampText }}
              >
                edited
              </span>
            )}
            <span
              className="text-xs"
              style={{
                color: isMe
                  ? `${colors.myMessageText}b3`
                  : colors.timestampText,
              }}
            >
              {timestamp}
            </span>
            {isMe && <StatusIndicator message={message} isRead={isRead} />}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReactionTap?.(emoji)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                style={{ borderRadius: dimensions.reactionPillRadius }}
              >
                <span className="text-sm">{emoji}</span>
                {count > 1 && (
                  <span className="text-xs text-gray-600">{count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReplyPreview({ message, isMe }: { message: Message; isMe: boolean }) {
  const { colors } = useRiviumChatTheme();

  return (
    <div
      className="flex gap-2 p-2 mb-1 rounded-lg"
      style={{ backgroundColor: colors.replyBackground }}
    >
      <div
        className="w-0.5 rounded-full"
        style={{
          backgroundColor: isMe ? colors.myMessageBubble : colors.linkText,
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium"
          style={{ color: isMe ? colors.myMessageBubble : colors.linkText }}
        >
          {message.senderUserId}
        </p>
        <p className="text-xs text-gray-500 truncate">{message.content}</p>
      </div>
    </div>
  );
}

function StatusIndicator({
  message,
  isRead,
}: {
  message: Message;
  isRead: boolean;
}) {
  const { colors } = useRiviumChatTheme();

  if (message.isFailed) {
    return (
      <svg
        className="w-3.5 h-3.5"
        fill={colors.failedMessage}
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (message.isPending) {
    return (
      <svg
        className="w-3.5 h-3.5"
        fill={`${colors.myMessageText}b3`}
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (isRead) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <path
          d="M1.5 12.5l5 5L18 6"
          stroke={colors.myMessageText}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 12.5l5 5L23.5 6"
          stroke={colors.myMessageText}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 12.5l5 5L20.5 6"
        stroke={`${colors.myMessageText}80`}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileAttachmentChip({
  name,
  size,
  url,
  isMe,
}: {
  name: string;
  size: number | null;
  url: string;
  isMe: boolean;
}) {
  const { colors } = useRiviumChatTheme();

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg mb-1 cursor-pointer hover:opacity-80 transition-opacity"
      style={{
        backgroundColor: isMe
          ? `${colors.myMessageText}1a`
          : colors.replyBackground,
      }}
      onClick={() => window.open(url, '_blank')}
    >
      <span>📎</span>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm truncate"
          style={{ color: isMe ? colors.myMessageText : colors.otherMessageText }}
        >
          {name}
        </p>
        {size && (
          <p
            className="text-xs"
            style={{
              color: isMe
                ? `${colors.myMessageText}b3`
                : colors.timestampText,
            }}
          >
            {formatSize(size)}
          </p>
        )}
      </div>
    </div>
  );
}

export default ChatMessageBubble;
