import { useState, useEffect, useCallback, useRef } from 'react';
import { RiviumChatClient } from '@rivium/web-chat';
import { DemoUser, Order, MockOrders, OrderStatus } from '../models/types';
import { OrderListCard } from '../components/OrderListCard';
import styles from './OrdersScreen.module.css';

interface OrdersScreenProps {
  currentUser: DemoUser;
  client: RiviumChatClient;
  onOrderClick: (order: Order) => void;
  onLogout: () => void;
}

type FilterOption = 'all' | OrderStatus;

const filterOptions: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function OrdersScreen({
  currentUser,
  client,
  onOrderClick,
  onLogout,
}: OrdersScreenProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  // Map of externalId (order.id) -> unread count
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const observedRoomIds = useRef<string[]>([]);

  // Fetch unread summary from API
  const fetchUnreadSummary = useCallback(async () => {
    try {
      const summary = await client.getUnreadSummary();
      const counts: Record<string, number> = {};
      for (const room of summary.rooms) {
        if (room.externalId) {
          counts[room.externalId] = room.unreadCount;
        }
      }
      setUnreadCounts(counts);
    } catch (err) {
      console.error('Failed to fetch unread summary:', err);
    }
  }, [client]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Load initial unread counts
      await fetchUnreadSummary();

      // Subscribe to all user's rooms for real-time message events
      try {
        const rooms = await client.listRooms();
        if (!mounted) return;
        const roomIds: string[] = [];
        for (const room of rooms) {
          client.observeRoom(room.id);
          roomIds.push(room.id);
        }
        observedRoomIds.current = roomIds;
      } catch (err) {
        console.error('Failed to list rooms:', err);
      }
    };

    init();

    // Listen for new messages to update unread counts in real-time
    const unsubMessage = client.onMessage((event) => {
      if (event.message.senderUserId !== currentUser.id) {
        fetchUnreadSummary();
      }
    });

    return () => {
      mounted = false;
      unsubMessage();
      // Unsubscribe from observed rooms
      for (const roomId of observedRoomIds.current) {
        client.unsubscribeFromRoom(roomId);
      }
      observedRoomIds.current = [];
    };
  }, [client, currentUser.id, fetchUnreadSummary]);

  // Filter orders based on user role and selected filter
  const filteredOrders = MockOrders.filter((order) => {
    // Show orders relevant to the current user
    const isUserOrder =
      currentUser.role === 'buyer'
        ? order.buyerId === currentUser.id
        : order.sellerId === currentUser.id;

    if (!isUserOrder) return false;

    // Apply status filter
    if (selectedFilter === 'all') return true;
    return order.status === selectedFilter;
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.userInfo}>
            <span className={styles.welcomeText}>Welcome back,</span>
            <h1 className={styles.userName}>{currentUser.name}</h1>
          </div>
          <button className={styles.logoutButton} onClick={onLogout}>
            Logout
          </button>
        </div>
        <span className={styles.roleTag}>
          {currentUser.role === 'buyer' ? '🛒 Buyer' : '🏪 Seller'}
        </span>
      </header>

      <div className={styles.filterContainer}>
        <div className={styles.filterList}>
          {filterOptions.map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.filterChip} ${
                selectedFilter === key ? styles.filterChipSelected : ''
              }`}
              onClick={() => setSelectedFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.orderList}>
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <OrderListCard
              key={order.id}
              order={order}
              onClick={() => onOrderClick(order)}
              unreadCount={unreadCounts[order.id] || 0}
            />
          ))
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyStateIcon}>📦</span>
            <h3 className={styles.emptyStateTitle}>No Orders Found</h3>
            <p className={styles.emptyStateSubtitle}>
              {selectedFilter === 'all'
                ? "You don't have any orders yet"
                : `No ${selectedFilter} orders`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrdersScreen;
