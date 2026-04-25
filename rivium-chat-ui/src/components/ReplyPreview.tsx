import React from 'react';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface ReplyMessage {
  /** Unique identifier for the message. */
  id: string;
  /** Message content. */
  content: string;
  /** Sender display name. */
  senderName?: string;
  /** Sender user ID. */
  senderId: string;
  /** First attachment URL (for preview). */
  attachmentUrl?: string;
  /** Attachment type (image, file, etc.). */
  attachmentType?: string;
}

export interface ReplyPreviewProps {
  /** The message being replied to. */
  message: ReplyMessage;
  /** Called when the close button is pressed. */
  onClose?: () => void;
  /** Called when the preview is clicked (to scroll to original). */
  onClick?: () => void;
  /** Whether this is in the input area (vs in a bubble). */
  isInputPreview?: boolean;
  /** Whether this is from the current user. */
  isMe?: boolean;
  /** Custom class name. */
  className?: string;
}

/**
 * A preview component for showing the message being replied to.
 */
export function ReplyPreview({
  message,
  onClose,
  onClick,
  isInputPreview = false,
  isMe = false,
  className = '',
}: ReplyPreviewProps) {
  const { colors } = useRiviumChatTheme();

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
    backgroundColor: isInputPreview
      ? 'rgba(0, 0, 0, 0.05)'
      : isMe
      ? 'rgba(255, 255, 255, 0.1)'
      : colors.replyBackground,
    ...(isInputPreview && {
      margin: '8px 8px 0',
    }),
  };

  const barStyle: React.CSSProperties = {
    width: 3,
    flexShrink: 0,
    backgroundColor: isMe && !isInputPreview
      ? 'rgba(255, 255, 255, 0.5)'
      : colors.linkText,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 10px',
    minWidth: 0,
  };

  const senderStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 2,
    color: isMe && !isInputPreview
      ? 'rgba(255, 255, 255, 0.9)'
      : colors.linkText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: 12,
    lineHeight: 1.4,
    color: isMe && !isInputPreview
      ? 'rgba(255, 255, 255, 0.7)'
      : colors.timestampText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  };

  const closeButtonStyle: React.CSSProperties = {
    padding: 8,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: isInputPreview
      ? colors.timestampText
      : isMe
      ? 'rgba(255, 255, 255, 0.5)'
      : colors.timestampText,
    flexShrink: 0,
  };

  const thumbnailStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginRight: 8,
    objectFit: 'cover' as const,
  };

  const fileIconStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: `${colors.linkText}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  };

  return (
    <div className={className} style={containerStyle} onClick={handleClick}>
      <div style={barStyle} />

      <div style={contentStyle}>
        <div style={senderStyle}>
          {message.senderName || message.senderId}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {message.attachmentUrl && message.attachmentType === 'image' && (
            <img
              src={message.attachmentUrl}
              alt=""
              style={thumbnailStyle}
            />
          )}

          {message.attachmentUrl && message.attachmentType !== 'image' && (
            <div style={fileIconStyle}>📎</div>
          )}

          <div style={messageStyle}>
            {message.content || (message.attachmentType ? `[${message.attachmentType}]` : '')}
          </div>
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          style={closeButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * A compact inline reply indicator shown in message bubbles.
 */
export interface InlineReplyIndicatorProps {
  /** The message being replied to. */
  message: ReplyMessage;
  /** Whether this is from the current user. */
  isMe?: boolean;
  /** Called when clicked to scroll to original message. */
  onClick?: () => void;
  /** Custom class name. */
  className?: string;
}

export function InlineReplyIndicator({
  message,
  isMe = false,
  onClick,
  className = '',
}: InlineReplyIndicatorProps) {
  const { colors } = useRiviumChatTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    marginBottom: 6,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    cursor: onClick ? 'pointer' : 'default',
  };

  const barStyle: React.CSSProperties = {
    width: 2,
    backgroundColor: isMe ? 'rgba(255, 255, 255, 0.5)' : colors.linkText,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '6px 8px',
    minWidth: 0,
  };

  return (
    <div className={className} style={containerStyle} onClick={onClick}>
      <div style={barStyle} />
      <div style={contentStyle}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 2,
          color: isMe ? 'rgba(255, 255, 255, 0.9)' : colors.linkText,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}>
          {message.senderName || message.senderId}
        </div>
        <div style={{
          fontSize: 11,
          lineHeight: 1.3,
          color: isMe ? 'rgba(255, 255, 255, 0.6)' : colors.timestampText,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

export default ReplyPreview;
