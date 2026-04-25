import {
  Order,
  formatCurrency,
  getStatusColor,
  getStatusDisplayName,
  formatDate,
} from '../models/types';
import styles from './OrderListCard.module.css';

interface OrderListCardProps {
  order: Order;
  onClick: () => void;
  unreadCount?: number;
}

export function OrderListCard({ order, onClick, unreadCount = 0 }: OrderListCardProps) {
  const statusColor = getStatusColor(order.status);
  const primaryImage = order.items[0]?.imageUrl;

  return (
    <div className={styles.container} onClick={onClick}>
      <div className={styles.imageContainer}>
        {primaryImage ? (
          <img src={primaryImage} alt="Order" className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span className={styles.placeholderIcon}>📦</span>
          </div>
        )}
        {order.items.length > 1 && (
          <span className={styles.itemCountBadge}>+{order.items.length - 1}</span>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.orderNumber}>{order.orderNumber}</span>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        <span className={styles.itemNames}>
          {order.items.map((item) => item.name).join(', ')}
        </span>

        <div className={styles.footer}>
          <span
            className={styles.statusBadge}
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {getStatusDisplayName(order.status)}
          </span>
          <span className={styles.amount}>{formatCurrency(order.totalAmount)}</span>
        </div>

        <span className={styles.date}>{formatDate(order.createdAt)}</span>
      </div>

      <div className={styles.chevron}>
        <span className={styles.chevronIcon}>›</span>
      </div>
    </div>
  );
}

export default OrderListCard;
