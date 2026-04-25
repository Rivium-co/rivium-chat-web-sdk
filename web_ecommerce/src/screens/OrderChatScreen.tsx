import { useEffect, useState, useCallback, useRef } from 'react';
import { RiviumChatClient, type Message } from '@rivium/web-chat';
import {
  ChatScreen,
  RiviumChatProvider,
  RiviumChatThemeProvider,
  PresenceIndicator,
  MessageSearchBar,
  ChatMessageBubble,
  TypingDots,
  type RiviumChatClient as UIRiviumChatClient,
  type Message as UIMessage,
} from '@rivium/web-chat-ui';
import { DemoUser, Order, DemoUsers } from '../models/types';
import { OrderHeaderWidget } from '../components/OrderHeaderWidget';
import { PinnedMessagesSheet } from '../components/PinnedMessagesSheet';
import styles from './OrderChatScreen.module.css';

interface OrderChatScreenProps {
  order: Order;
  currentUser: DemoUser;
  client: RiviumChatClient;
  onBack: () => void;
}

function getOtherUser(currentUserId: string): DemoUser {
  return currentUserId === DemoUsers.buyer.id ? DemoUsers.seller : DemoUsers.buyer;
}

export function OrderChatScreen({
  order,
  currentUser,
  client,
  onBack,
}: OrderChatScreenProps) {
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const otherUser = getOtherUser(currentUser.id);

  // Find or create the room first
  useEffect(() => {
    const initRoom = async () => {
      try {
        const room = await client.findOrCreateRoom({
          externalId: order.id,
          type: 'direct',
          name: `Order ${order.orderNumber}`,
          participants: [
            { externalUserId: order.buyerId, displayName: 'John Buyer', role: 'member' },
            { externalUserId: order.sellerId, displayName: 'Sarah Seller', role: 'member' },
          ],
        });
        setRoomId(room.id);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to init room:', err);
        setIsLoading(false);
      }
    };
    initRoom();
  }, [order.id]);

  useEffect(() => {
    if (!roomId) return;

    // Subscribe to connection state
    const handleConnectionState = (event: { state: string }) => {
      setIsConnected(event.state === 'connected');
    };

    // Subscribe to presence changes
    const handlePresenceChange = (event: { userId: string; isOnline: boolean; roomId: string }) => {
      if (event.roomId === roomId && event.userId === otherUser.id) {
        setIsOtherUserOnline(event.isOnline);
      }
    };

    // Subscribe to typing events (with auto-clear timeout)
    const handleTyping = (event: { userId: string; isTyping: boolean; roomId: string }) => {
      if (event.roomId === roomId && event.userId === otherUser.id) {
        setIsOtherUserTyping(true);

        // Clear previous timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        // Auto-clear typing after 3 seconds of no typing events
        typingTimeoutRef.current = setTimeout(() => {
          setIsOtherUserTyping(false);
        }, 3000);
      }
    };

    client.on('connectionState', handleConnectionState);
    client.on('presence', handlePresenceChange);
    client.on('typing', handleTyping);

    // Ensure we're connected
    client.connect();

    // Load initial presence
    loadPresence();

    return () => {
      client.off('connectionState', handleConnectionState);
      client.off('presence', handlePresenceChange);
      client.off('typing', handleTyping);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [client, roomId, otherUser.id]);

  const loadPresence = async () => {
    try {
      const onlineUsers = await client.getRoomPresence(roomId!);
      setIsOtherUserOnline(onlineUsers.has(otherUser.id));
    } catch (error) {
      console.error('Failed to load presence:', error);
    }
  };

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      // Debounce search
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await client.searchMessages(roomId!, query, { limit: 50 });
          setSearchResults(result.messages || []);
          setSearchIndex(0);
        } catch (error) {
          console.error('Search failed:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [client, roomId]
  );

  const handleSearchClose = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchIndex(0);
  };

  const handlePreviousResult = () => {
    if (searchIndex > 0) {
      setSearchIndex(searchIndex - 1);
    }
  };

  const handleNextResult = () => {
    if (searchIndex < searchResults.length - 1) {
      setSearchIndex(searchIndex + 1);
    }
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) {
      return (
        <div className={styles.searchEmptyContainer}>
          <span className={styles.searchEmptyIcon}>🔍</span>
          <h3 className={styles.searchEmptyTitle}>No messages found</h3>
          <p className={styles.searchEmptySubtitle}>Try a different search term</p>
        </div>
      );
    }

    return (
      <div className={styles.searchResultsList}>
        {searchResults.map((message, index) => {
          const isMe = message.senderUserId === currentUser.id;
          return (
            <div
              key={message.id}
              className={`${styles.searchResultItem} ${
                index === searchIndex ? styles.searchResultHighlighted : ''
              }`}
            >
              <ChatMessageBubble
                message={message as unknown as UIMessage}
                isMe={isMe}
                showAvatar={!isMe}
              />
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading || !roomId) {
    return (
      <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <span>Loading chat...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <span className={styles.backIcon}>‹</span>
          <span className={styles.backText}>Orders</span>
        </button>

        <div className={styles.headerRight}>
          {/* User info with presence */}
          <div className={styles.userInfo}>
            <div className={styles.userAvatarContainer}>
              <div className={styles.userAvatar}>
                <span className={styles.userAvatarText}>
                  {otherUser.name[0].toUpperCase()}
                </span>
              </div>
              <div className={styles.presenceIndicatorContainer}>
                <PresenceIndicator isOnline={isOtherUserOnline} size={10} />
              </div>
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{otherUser.name}</span>
              {isOtherUserTyping ? (
                <div className={styles.typingContainer}>
                  <span className={styles.typingText}>typing</span>
                  <TypingDots dotSize={4} />
                </div>
              ) : (
                <span className={styles.userStatus}>
                  {isOtherUserOnline ? 'Online' : 'Offline'}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.headerActions}>
            <button
              className={styles.headerButton}
              onClick={() => setShowSearch(!showSearch)}
              title="Search messages"
            >
              🔍
            </button>
            <button
              className={styles.headerButton}
              onClick={() => setShowPinnedMessages(true)}
              title="Pinned messages"
            >
              📌
            </button>
          </div>
        </div>
      </header>

      {/* Search bar */}
      {showSearch && (
        <MessageSearchBar
          onSearch={handleSearch}
          onClose={handleSearchClose}
          totalResults={searchResults.length}
          currentIndex={searchIndex}
          isLoading={isSearching}
          onPrevious={handlePreviousResult}
          onNext={handleNextResult}
          placeholder="Search messages..."
        />
      )}

      <OrderHeaderWidget order={order} />

      {/* Main content - either search results or chat */}
      <div className={styles.chatContainer}>
        {showSearch && searchQuery.trim() ? (
          renderSearchResults()
        ) : (
          <RiviumChatProvider client={client as unknown as UIRiviumChatClient} autoConnect={false}>
            <RiviumChatThemeProvider>
              <ChatScreen
                roomId={roomId}
                currentUserId={currentUser.id}
              />
            </RiviumChatThemeProvider>
          </RiviumChatProvider>
        )}
      </div>

      {/* Connection banner */}
      {!isConnected && (
        <div className={styles.connectionBanner}>
          <span className={styles.connectionText}>Connecting...</span>
        </div>
      )}

      {/* Pinned Messages Sheet */}
      <PinnedMessagesSheet
        visible={showPinnedMessages}
        onClose={() => setShowPinnedMessages(false)}
        roomId={roomId}
        currentUserId={currentUser.id}
        client={client}
      />
    </div>
  );
}

export default OrderChatScreen;
