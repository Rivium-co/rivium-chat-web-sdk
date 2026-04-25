import React from 'react';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface MentionUser {
  /** Unique identifier for the user. */
  id: string;
  /** Display name of the user. */
  displayName: string;
  /** Optional avatar URL. */
  avatarUrl?: string;
  /** Optional online status. */
  isOnline?: boolean;
}

export interface MentionsListProps {
  /** List of users to show in the suggestions. */
  users: MentionUser[];
  /** Called when a user is selected. */
  onUserSelected: (user: MentionUser) => void;
  /** Current search query (text after @). */
  searchQuery?: string;
  /** Whether the list is visible. */
  visible?: boolean;
  /** Maximum number of suggestions to show. */
  maxSuggestions?: number;
  /** Custom empty state message. */
  emptyMessage?: string;
  /** Custom class name. */
  className?: string;
}

/**
 * A dropdown list of users for @mention autocomplete.
 */
export function MentionsList({
  users,
  onUserSelected,
  searchQuery = '',
  visible = true,
  maxSuggestions = 5,
  emptyMessage = 'No users found',
  className = '',
}: MentionsListProps) {
  const { colors } = useRiviumChatTheme();

  if (!visible) return null;

  // Filter users based on search query
  const filteredUsers = users
    .filter((user) =>
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, maxSuggestions);

  const containerStyle: React.CSSProperties = {
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    backgroundColor: colors.otherMessageBubble,
    maxHeight: 200,
    overflowY: 'auto' as const,
  };

  const emptyStyle: React.CSSProperties = {
    padding: 16,
    textAlign: 'center' as const,
    fontSize: 14,
    color: colors.timestampText,
  };

  const userItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: `1px solid rgba(0, 0, 0, 0.1)`,
    transition: 'background-color 0.15s',
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

  if (filteredUsers.length === 0) {
    return (
      <div className={className} style={containerStyle}>
        <div style={emptyStyle}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      {filteredUsers.map((user, index) => (
        <div
          key={user.id}
          style={{
            ...userItemStyle,
            ...(index === filteredUsers.length - 1 && { borderBottom: 'none' }),
          }}
          onClick={() => onUserSelected(user)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
          }}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" style={avatarStyle} />
          ) : (
            <div style={placeholderStyle}>
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 500,
              color: colors.otherMessageText,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
            }}>
              {user.displayName}
            </div>
            <div style={{
              fontSize: 12,
              marginTop: 2,
              color: colors.timestampText,
            }}>
              @{user.id}
            </div>
          </div>

          {user.isOnline && (
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#34C759',
              marginLeft: 8,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Inline mention chip that appears in the text.
 */
export interface MentionChipProps {
  /** Display name to show. */
  displayName: string;
  /** Called when the chip is clicked. */
  onClick?: () => void;
  /** Whether this is the current user. */
  isCurrentUser?: boolean;
  /** Custom class name. */
  className?: string;
}

export function MentionChip({
  displayName,
  onClick,
  isCurrentUser = false,
  className = '',
}: MentionChipProps) {
  const { colors } = useRiviumChatTheme();

  const style: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: isCurrentUser
      ? `${colors.linkText}30`
      : `${colors.linkText}15`,
    fontSize: 14,
    fontWeight: 500,
    color: colors.linkText,
    cursor: onClick ? 'pointer' : 'default',
  };

  return (
    <span className={className} style={style} onClick={onClick}>
      @{displayName}
    </span>
  );
}

export default MentionsList;
