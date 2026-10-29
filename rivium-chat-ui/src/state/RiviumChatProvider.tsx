import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';

// Types that would come from @rivium/web-chat
export interface RiviumChatConfig {
  apiKey: string;
  userId: string;
  userInfo?: Record<string, string>;
}

export interface Message {
  id: string;
  roomId: string;
  senderUserId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments: Attachment[];
  metadata: Record<string, unknown> | null;
  replyToId: string | null;
  replyTo: Message | null;
  isDeleted: boolean;
  createdAt: string;
  isEdited: boolean;
  editedAt: string | null;
  editHistory: string[] | null;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedBy: string | null;
  reactions: Reaction[];
  isPending?: boolean;
  isFailed?: boolean;
  /** The id the sending SDK gave the message (offline outbox). */
  clientMessageId?: string | null;
  /** Local state: waiting in the client's offline outbox ("Waiting for network…"). */
  isQueued?: boolean;
}

export interface Room {
  id: string;
  type: 'direct' | 'group';
  externalId: string | null;
  name: string | null;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  participants: Participant[];
}

export interface Participant {
  id: string;
  externalUserId: string;
  displayName: string | null;
  locale: string | null;
  role: 'admin' | 'member';
  lastReadAt: string | null;
  joinedAt: string;
}

export interface Attachment {
  url: string;
  mimeType: string | null;
  name: string | null;
  size: number | null;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

// Client interface
export interface RiviumChatClient {
  connect(): Promise<void>;
  disconnect(): void;
  subscribeToRoom(roomId: string): void;
  unsubscribeFromRoom(roomId: string): void;
  leaveRoom(roomId: string): void;
  getMessages(roomId: string, options?: { limit?: number; before?: string }): Promise<{ messages: Message[] }>;
  sendMessage(roomId: string, content: string, options?: { type?: Message['type']; attachments?: Attachment[]; replyToId?: string }): Promise<Message>;
  deleteMessage(messageId: string): Promise<void>;
  editMessage(messageId: string, content: string): Promise<Message>;
  addReaction(messageId: string, emoji: string): Promise<Reaction>;
  removeReaction(messageId: string, emoji: string): Promise<void>;
  publishTyping(roomId: string): Promise<void>;
  markAsRead(roomId: string): Promise<void>;
  getRoom(roomId: string): Promise<Room>;
  getRoomPresence(roomId: string): Promise<Set<string>>;
  onMessage: (callback: (event: { message: Message }) => void) => () => void;
  onMessageDeleted: (callback: (event: { messageId: string; roomId: string }) => void) => () => void;
  onMessageEdited: (callback: (event: { messageId: string; newContent: string; editedAt: string }) => void) => () => void;
  onReaction: (callback: (event: { messageId: string; userId: string; emoji: string; isAdded: boolean }) => void) => () => void;
  onTyping: (callback: (event: { roomId: string; userId: string }) => void) => () => void;
  onPresenceChange: (callback: (event: { roomId: string; userId: string; isOnline: boolean }) => void) => () => void;
  onReadReceipt: (callback: (event: { roomId: string; userId: string; lastReadAt: string }) => void) => () => void;
  onSubscriptionState?: (callback: (event: { channel: string; state: string }) => void) => () => void;
  /** Pin a message (shown in the message menu when available). */
  pinMessage?(messageId: string): Promise<unknown>;
  /** Unpin a message. */
  unpinMessage?(messageId: string): Promise<void>;
  /** Pin / unpin events from other users and devices. */
  onMessagePinChanged?: (callback: (event: { messageId: string; roomId: string; pinned?: boolean; isPinned?: boolean; pinnedAt?: Date | string }) => void) => () => void;
  /** The room's live updates were lost or refused: the screen reloads its history. */
  onRecoveryFailed?: (callback: (event: { roomId: string; code?: number; reason?: string }) => void) => () => void;
  /** True when the client was created with `queueOfflineMessages: true`. */
  readonly queueOfflineMessages?: boolean;
  /** Messages waiting in the offline outbox (shown as "Waiting for network…"). */
  getPendingMessages?(roomId?: string): Promise<Message[]>;
  /** A queued message was stored: the screen replaces its pending copy. */
  onMessageSent?: (callback: (event: { localId: string; clientMessageId: string; message: Message }) => void) => () => void;
  /** A queued message left the outbox without being stored: the screen shows Retry. */
  onMessageFailed?: (callback: (event: { localId: string; clientMessageId: string; roomId: string; error: Error; reason: string }) => void) => () => void;
  /** Connection state changes, so the screens follow reconnects. */
  onConnectionStateChange?: (callback: (event: { state: string; error?: Error }) => void) => () => void;
}

interface RiviumChatContextValue {
  client: RiviumChatClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: Error | null;
}

const RiviumChatContext = createContext<RiviumChatContextValue>({
  client: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
});

export interface RiviumChatProviderProps {
  children: ReactNode;
  client: RiviumChatClient;
  autoConnect?: boolean;
  onConnected?: () => void;
  onConnectionError?: (error: Error) => void;
}

/**
 * Provides RiviumChatClient to child components
 */
export function RiviumChatProvider({
  children,
  client,
  autoConnect = true,
  onConnected,
  onConnectionError,
}: RiviumChatProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  // Callbacks in refs: a new inline callback on every render must not
  // disconnect and reconnect the client.
  const onConnectedRef = useRef(onConnected);
  const onConnectionErrorRef = useRef(onConnectionError);
  onConnectedRef.current = onConnected;
  onConnectionErrorRef.current = onConnectionError;

  // Follow the client's own connection state (also when the app connects it
  // itself with autoConnect={false}, and across disconnect / connect).
  useEffect(() => {
    if (!client.onConnectionStateChange) return;
    return client.onConnectionStateChange((event) => {
      switch (event.state) {
        case 'connected':
          setIsConnected(true);
          setIsConnecting(false);
          setConnectionError(null);
          break;
        case 'connecting':
          setIsConnecting(true);
          break;
        case 'disconnected':
          setIsConnected(false);
          setIsConnecting(false);
          break;
        case 'error':
          if (event.error) setConnectionError(event.error);
          break;
      }
    });
  }, [client]);

  useEffect(() => {
    if (!autoConnect) return;
    let active = true;

    const connect = async () => {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        await client.connect();
        if (!active) return;
        setIsConnected(true);
        onConnectedRef.current?.();
      } catch (error) {
        if (!active) return;
        const err = error instanceof Error ? error : new Error('Connection failed');
        setConnectionError(err);
        onConnectionErrorRef.current?.(err);
      } finally {
        if (active) setIsConnecting(false);
      }
    };

    connect();

    return () => {
      active = false;
      client.disconnect();
      setIsConnected(false);
    };
  }, [client, autoConnect]);

  return (
    <RiviumChatContext.Provider
      value={{ client, isConnected, isConnecting, connectionError }}
    >
      {children}
    </RiviumChatContext.Provider>
  );
}

/**
 * Hook to access RiviumChatClient
 */
export function useRiviumChatClient(): RiviumChatClient {
  const context = useContext(RiviumChatContext);
  if (!context.client) {
    throw new Error('useRiviumChatClient must be used within RiviumChatProvider');
  }
  return context.client;
}

/**
 * Hook to access connection state
 */
export function useRiviumChatConnection() {
  const context = useContext(RiviumChatContext);
  return {
    isConnected: context.isConnected,
    isConnecting: context.isConnecting,
    connectionError: context.connectionError,
  };
}
