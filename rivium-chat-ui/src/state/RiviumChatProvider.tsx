import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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

  useEffect(() => {
    if (!autoConnect) return;

    const connect = async () => {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        await client.connect();
        setIsConnected(true);
        onConnected?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Connection failed');
        setConnectionError(err);
        onConnectionError?.(err);
      } finally {
        setIsConnecting(false);
      }
    };

    connect();

    return () => {
      client.disconnect();
      setIsConnected(false);
    };
  }, [client, autoConnect, onConnected, onConnectionError]);

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
