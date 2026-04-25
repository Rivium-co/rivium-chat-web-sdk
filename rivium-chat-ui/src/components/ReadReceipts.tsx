import React from 'react';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface ReadReceiptUser {
  /** Unique identifier for the user. */
  id: string;
  /** Display name of the user. */
  displayName?: string;
  /** Avatar URL. */
  avatarUrl?: string;
}

export interface ReadReceiptsProps {
  /** List of users who have read the message. */
  readers: ReadReceiptUser[];
  /** Maximum number of avatars to display before collapsing. */
  maxAvatars?: number;
  /** Size of the avatar circles in pixels. */
  avatarSize?: number;
  /** Whether to show reader names on hover. */
  showNames?: boolean;
  /** Custom class name. */
  className?: string;
}

/**
 * Displays read receipts as a row of overlapping avatars.
 */
export function ReadReceipts({
  readers,
  maxAvatars = 3,
  avatarSize = 16,
  showNames = false,
  className = '',
}: ReadReceiptsProps) {
  const { colors } = useRiviumChatTheme();

  if (readers.length === 0) return null;

  const displayedReaders = readers.slice(0, maxAvatars);
  const remainingCount = readers.length - maxAvatars;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
  };

  const avatarWrapperStyle = (index: number): React.CSSProperties => ({
    marginLeft: index > 0 ? -avatarSize / 3 : 0,
    zIndex: displayedReaders.length - index,
    borderRadius: '50%',
    border: '1px solid #fff',
    boxSizing: 'border-box' as const,
  });

  const avatarStyle: React.CSSProperties = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: '50%',
    backgroundColor: '#E0E0E0',
    objectFit: 'cover' as const,
  };

  const placeholderStyle: React.CSSProperties = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: '50%',
    backgroundColor: `${colors.linkText}30`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: avatarSize * 0.5,
    fontWeight: 600,
    color: colors.linkText,
  };

  const countBadgeStyle: React.CSSProperties = {
    marginLeft: -avatarSize / 3,
    width: avatarSize,
    height: avatarSize,
    borderRadius: '50%',
    backgroundColor: colors.timestampText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: avatarSize * 0.5,
    fontWeight: 600,
    color: '#fff',
    border: '1px solid #fff',
    boxSizing: 'border-box' as const,
  };

  return (
    <div className={className} style={containerStyle}>
      {displayedReaders.map((reader, index) => (
        <div
          key={reader.id}
          style={avatarWrapperStyle(index)}
          title={showNames ? reader.displayName || reader.id : undefined}
        >
          {reader.avatarUrl ? (
            <img
              src={reader.avatarUrl}
              alt=""
              style={avatarStyle}
            />
          ) : (
            <div style={placeholderStyle}>
              {(reader.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      ))}

      {remainingCount > 0 && (
        <div style={countBadgeStyle}>
          +{remainingCount}
        </div>
      )}

      {showNames && readers.length === 1 && (
        <span style={{
          marginLeft: 4,
          fontSize: 10,
          color: colors.timestampText,
        }}>
          {readers[0].displayName || 'Read'}
        </span>
      )}
    </div>
  );
}

/**
 * Simple checkmark-based read receipt indicator.
 */
export interface ReadStatusProps {
  /** Whether the message has been sent. */
  isSent?: boolean;
  /** Whether the message has been delivered. */
  isDelivered?: boolean;
  /** Whether the message has been read. */
  isRead?: boolean;
  /** Color for unread state. */
  unreadColor?: string;
  /** Color for read state. */
  readColor?: string;
  /** Size of the checkmarks in pixels. */
  size?: number;
  /** Custom class name. */
  className?: string;
}

export function ReadStatus({
  isSent = true,
  isDelivered = false,
  isRead = false,
  unreadColor,
  readColor,
  size = 12,
  className = '',
}: ReadStatusProps) {
  const { colors } = useRiviumChatTheme();

  const color = isRead
    ? readColor || colors.readReceipt
    : unreadColor || colors.timestampText;

  const style: React.CSSProperties = {
    fontSize: size,
    fontWeight: 600,
    color,
  };

  if (!isSent) {
    return <span className={className} style={style}>⏱</span>;
  }

  if (isRead) {
    return <span className={className} style={style}>✓✓</span>;
  }

  if (isDelivered) {
    return <span className={className} style={style}>✓✓</span>;
  }

  return <span className={className} style={style}>✓</span>;
}

/**
 * Detailed read receipt list (for showing who read a message).
 */
export interface ReadReceiptListProps {
  /** List of users who have read the message with timestamps. */
  readers: Array<ReadReceiptUser & { readAt: Date }>;
  /** Title to show above the list. */
  title?: string;
  /** Custom class name. */
  className?: string;
}

export function ReadReceiptList({
  readers,
  title = 'Read by',
  className = '',
}: ReadReceiptListProps) {
  const { colors } = useRiviumChatTheme();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const containerStyle: React.CSSProperties = {
    padding: '8px 0',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 12,
    padding: '0 16px',
    color: colors.timestampText,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
  };

  const avatarStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    objectFit: 'cover' as const,
  };

  const placeholderStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: `${colors.linkText}20`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 600,
    color: colors.linkText,
  };

  return (
    <div className={className} style={containerStyle}>
      <div style={titleStyle}>{title}</div>

      {readers.map((reader) => (
        <div key={reader.id} style={itemStyle}>
          {reader.avatarUrl ? (
            <img src={reader.avatarUrl} alt="" style={avatarStyle} />
          ) : (
            <div style={placeholderStyle}>
              {(reader.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ flex: 1, marginLeft: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: colors.otherMessageText }}>
              {reader.displayName || reader.id}
            </div>
            <div style={{ fontSize: 12, marginTop: 2, color: colors.timestampText }}>
              {formatTime(reader.readAt)}
            </div>
          </div>

          <span style={{ fontSize: 14, color: colors.readReceipt }}>✓✓</span>
        </div>
      ))}
    </div>
  );
}

export default ReadReceipts;
