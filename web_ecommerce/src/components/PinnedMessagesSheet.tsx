import { useState, useEffect, useCallback } from 'react';
import { RiviumChatClient, type Message } from '@rivium/web-chat';
import styles from './PinnedMessagesSheet.module.css';

interface PinnedMessagesSheetProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  currentUserId: string;
  client: RiviumChatClient;
}

export function PinnedMessagesSheet({
  visible,
  onClose,
  roomId,
  currentUserId,
  client,
}: PinnedMessagesSheetProps) {
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPinnedMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const messages = await client.getPinnedMessages(roomId);
      setPinnedMessages(messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pinned messages');
    } finally {
      setIsLoading(false);
    }
  }, [client, roomId]);

  useEffect(() => {
    if (visible) {
      loadPinnedMessages();
    }
  }, [visible, loadPinnedMessages]);

  const handleUnpin = async (messageId: string) => {
    try {
      await client.unpinMessage(messageId);
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (e) {
      console.error('Failed to unpin message:', e);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  if (!visible) {
    return null;
  }

  const renderMessage = (message: Message) => {
    const isMe = message.senderUserId === currentUserId;

    return (
      <div key={message.id} className={styles.messageCard}>
        <div className={styles.messageHeader}>
          <div className={styles.avatarContainer}>
            <div
              className={styles.avatar}
              style={{ backgroundColor: isMe ? '#007AFF' : '#5856D6' }}
            >
              <span className={styles.avatarText}>
                {isMe ? 'You' : (message.senderUserId?.[0] || '?').toUpperCase()}
              </span>
            </div>
            <span className={styles.senderName}>
              {isMe ? 'You' : message.senderUserId}
            </span>
          </div>
          <button
            className={styles.unpinButton}
            onClick={() => handleUnpin(message.id)}
            title="Unpin message"
          >
            📌
          </button>
        </div>

        <p className={styles.messageContent}>{message.content}</p>

        {message.attachments && message.attachments.length > 0 && (
          <div className={styles.attachmentsRow}>
            <span className={styles.attachmentIcon}>📎</span>
            <span className={styles.attachmentText}>
              {message.attachments.length} attachment(s)
            </span>
          </div>
        )}

        {message.pinnedAt && (
          <span className={styles.pinnedDate}>
            Pinned on {formatDate(message.pinnedAt)}
          </span>
        )}
      </div>
    );
  };

  const renderEmpty = () => (
    <div className={styles.emptyContainer}>
      <span className={styles.emptyIcon}>📌</span>
      <h3 className={styles.emptyTitle}>No pinned messages</h3>
      <p className={styles.emptySubtitle}>
        Long-press any message and select "Pin" to pin it here
      </p>
    </div>
  );

  const renderError = () => (
    <div className={styles.errorContainer}>
      <span className={styles.errorIcon}>⚠️</span>
      <h3 className={styles.errorTitle}>Failed to load pinned messages</h3>
      <p className={styles.errorMessage}>{error}</p>
      <button className={styles.retryButton} onClick={loadPinnedMessages}>
        Retry
      </button>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div className={styles.handleContainer}>
          <div className={styles.handle} />
        </div>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>📌</span>
            <h2 className={styles.headerTitle}>Pinned Messages</h2>
          </div>
          <div className={styles.headerRight}>
            {pinnedMessages.length > 0 && (
              <span className={styles.headerCount}>{pinnedMessages.length}</span>
            )}
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Content */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner} />
            </div>
          ) : error ? (
            renderError()
          ) : pinnedMessages.length === 0 ? (
            renderEmpty()
          ) : (
            <div className={styles.messagesList}>
              {pinnedMessages.map(renderMessage)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PinnedMessagesSheet;
