import { useState, useEffect, useCallback, useRef } from 'react';
import { useRiviumChatClient, Message, Attachment, Reaction } from '../state/RiviumChatProvider';

export interface ChatChannelState {
  messages: Message[];
  hasMore: boolean;
  isLoadingMore: boolean;
  isInitialLoading: boolean;
  typingUsers: string[];
  onlineUsers: Set<string>;
  otherUserLastRead: Date | null;
  replyingTo: Message | null;
  error: Error | null;
}

export interface ChatChannelActions {
  loadMore: () => Promise<void>;
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  publishTyping: () => Promise<void>;
  markAsRead: () => Promise<void>;
  setReplyingTo: (message: Message | null) => void;
  clearError: () => void;
}

/** Normalize a message from the API (null → [] for arrays). */
function normalizeMessage(msg: Message): Message {
  return {
    ...msg,
    reactions: msg.reactions ?? [],
    attachments: msg.attachments ?? [],
  };
}

/**
 * Hook for managing chat channel state
 */
export function useChatChannel(
  roomId: string,
  currentUserId: string
): ChatChannelState & ChatChannelActions {
  const client = useRiviumChatClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [otherUserLastRead, setOtherUserLastRead] = useState<Date | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastTypingTimeRef = useRef<number>(0);

  // Initialize channel
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        client.subscribeToRoom(roomId);

        const result = await client.getMessages(roomId, { limit: 50 });
        if (mounted) {
          setMessages(result.messages.map(normalizeMessage).reverse()); // Newest first
          setHasMore(result.messages.length >= 50);
          setIsInitialLoading(false);
        }

        // Get initial presence
        try {
          const presence = await client.getRoomPresence(roomId);
          if (mounted) {
            setOnlineUsers(presence);
          }
        } catch {
          // Ignore presence errors
        }

        // Load initial read state from room participants
        try {
          const room = await client.getRoom(roomId);
          if (mounted) {
            const otherParticipant = room.participants.find(
              (p) => p.externalUserId !== currentUserId
            );
            if (otherParticipant?.lastReadAt) {
              setOtherUserLastRead(new Date(otherParticipant.lastReadAt));
            }
          }
        } catch {
          // Non-critical: read receipts will still work via real-time events
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load messages'));
          setIsInitialLoading(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      client.leaveRoom(roomId);
      typingTimersRef.current.forEach((timer) => clearTimeout(timer));
      typingTimersRef.current.clear();
    };
  }, [client, roomId]);

  // Event subscriptions
  useEffect(() => {
    const unsubMessage = client.onMessage((event) => {
      if (event.message.roomId !== roomId) return;

      setMessages((prev) => {
        // Check for pending message confirmation
        const pendingIndex = prev.findIndex(
          (m) =>
            m.isPending &&
            m.content === event.message.content &&
            m.senderUserId === event.message.senderUserId
        );

        const normalized = normalizeMessage(event.message);

        if (pendingIndex >= 0) {
          const updated = [...prev];
          updated[pendingIndex] = normalized;
          return updated;
        }

        if (prev.some((m) => m.id === normalized.id)) {
          return prev;
        }

        return [normalized, ...prev];
      });

      // Auto mark as read when receiving messages from other user
      if (event.message.senderUserId !== currentUserId) {
        client.markAsRead(roomId).catch(() => {});
      }
    });

    const unsubDeleted = client.onMessageDeleted((event) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === event.messageId ? { ...m, isDeleted: true } : m
        )
      );
    });

    const unsubEdited = client.onMessageEdited((event) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === event.messageId
            ? { ...m, content: event.newContent, isEdited: true, editedAt: event.editedAt }
            : m
        )
      );
    });

    const unsubReaction = client.onReaction((event) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== event.messageId) return m;

          let reactions = [...(m.reactions ?? [])];
          if (event.isAdded) {
            if (!reactions.some((r) => r.userId === event.userId && r.emoji === event.emoji)) {
              reactions.push({
                id: `${event.userId}_${event.emoji}`,
                messageId: event.messageId,
                userId: event.userId,
                emoji: event.emoji,
                createdAt: new Date().toISOString(),
              });
            }
          } else {
            reactions = reactions.filter(
              (r) => !(r.userId === event.userId && r.emoji === event.emoji)
            );
          }

          return { ...m, reactions };
        })
      );
    });

    const unsubTyping = client.onTyping((event) => {
      if (event.roomId !== roomId || event.userId === currentUserId) return;

      setTypingUsers((prev) => {
        if (!prev.includes(event.userId)) {
          return [...prev, event.userId];
        }
        return prev;
      });

      // Clear existing timer
      const existingTimer = typingTimersRef.current.get(event.userId);
      if (existingTimer) clearTimeout(existingTimer);

      // Set new timer to remove typing user
      const timer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== event.userId));
        typingTimersRef.current.delete(event.userId);
      }, 3000);
      typingTimersRef.current.set(event.userId, timer);
    });

    const unsubPresence = client.onPresenceChange((event) => {
      if (event.roomId !== roomId) return;

      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        if (event.isOnline) {
          updated.add(event.userId);
        } else {
          updated.delete(event.userId);
        }
        return updated;
      });
    });

    const unsubReadReceipt = client.onReadReceipt((event) => {
      if (event.roomId !== roomId || event.userId === currentUserId) return;

      const timestamp = new Date(event.lastReadAt);
      setOtherUserLastRead((prev) => {
        if (!prev || timestamp > prev) {
          return timestamp;
        }
        return prev;
      });
    });

    return () => {
      unsubMessage();
      unsubDeleted();
      unsubEdited();
      unsubReaction();
      unsubTyping();
      unsubPresence();
      unsubReadReceipt();
    };
  }, [client, roomId, currentUserId]);

  // Actions
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestMessage = messages[messages.length - 1];
      const result = await client.getMessages(roomId, {
        limit: 50,
        before: oldestMessage?.id,
      });
      setMessages((prev) => [...prev, ...result.messages.map(normalizeMessage).reverse()]);
      setHasMore(result.messages.length >= 50);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more messages'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [client, roomId, isLoadingMore, hasMore, messages]);

  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      // Determine message type from attachments
      let messageType: Message['type'] = 'text';
      if (attachments && attachments.length > 0) {
        const mime = attachments[0].mimeType || '';
        if (mime.startsWith('image/')) {
          messageType = 'image';
        } else if (mime === 'application/pdf') {
          messageType = 'file';
        } else {
          messageType = 'file';
        }
      }

      const pendingId = `pending_${Date.now()}_${Math.random()}`;
      const pendingMessage: Message = {
        id: pendingId,
        roomId,
        senderUserId: currentUserId,
        content,
        type: messageType,
        attachments: attachments || [],
        metadata: null,
        replyToId: replyingTo?.id || null,
        replyTo: replyingTo,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        isEdited: false,
        editedAt: null,
        editHistory: null,
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
        reactions: [],
        isPending: true,
        isFailed: false,
      };

      setMessages((prev) => [pendingMessage, ...prev]);
      const replyId = replyingTo?.id;
      setReplyingTo(null);

      try {
        const sent = await client.sendMessage(roomId, content, {
          type: messageType,
          attachments,
          replyToId: replyId,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? normalizeMessage(sent) : m))
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, isPending: false, isFailed: true } : m
          )
        );
      }
    },
    [client, roomId, currentUserId, replyingTo]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message?.isFailed) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isPending: true, isFailed: false } : m
        )
      );

      try {
        const sent = await client.sendMessage(roomId, message.content, {
          attachments: (message.attachments ?? []).length > 0 ? message.attachments : undefined,
          replyToId: message.replyToId || undefined,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? normalizeMessage(sent) : m))
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, isPending: false, isFailed: true } : m
          )
        );
      }
    },
    [client, roomId, messages]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      try {
        await client.deleteMessage(messageId);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to delete message'));
      }
    },
    [client]
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      try {
        await client.editMessage(messageId, newContent);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to edit message'));
      }
    },
    [client]
  );

  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await client.addReaction(messageId, emoji);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to add reaction'));
      }
    },
    [client]
  );

  const removeReaction = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await client.removeReaction(messageId, emoji);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to remove reaction'));
      }
    },
    [client]
  );

  const publishTyping = useCallback(async () => {
    const now = Date.now();
    if (now - lastTypingTimeRef.current < 2000) return;

    lastTypingTimeRef.current = now;
    try {
      await client.publishTyping(roomId);
    } catch {
      // Ignore typing errors
    }
  }, [client, roomId]);

  const markAsRead = useCallback(async () => {
    try {
      await client.markAsRead(roomId);
    } catch {
      // Ignore read errors
    }
  }, [client, roomId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    hasMore,
    isLoadingMore,
    isInitialLoading,
    typingUsers,
    onlineUsers,
    otherUserLastRead,
    replyingTo,
    error,
    loadMore,
    sendMessage,
    retryMessage,
    deleteMessage,
    editMessage,
    addReaction,
    removeReaction,
    publishTyping,
    markAsRead,
    setReplyingTo,
    clearError,
  };
}
