import {
  Order,
  formatCurrency,
  getStatusColor,
  getStatusDisplayName,
} from '../models/types';
import styles from './OrderHeaderWidget.module.css';

interface OrderHeaderWidgetProps {
  order: Order;
}

export function OrderHeaderWidget({ order }: OrderHeaderWidgetProps) {
  const statusColor = getStatusColor(order.status);
  const primaryImage = order.items[0]?.imageUrl;

  return (
    <div className={styles.container}>
      {primaryImage ? (
        <img src={primaryImage} alt="Order" className={styles.image} />
      ) : (
        <div className={styles.imagePlaceholder}>
          <span className={styles.placeholderIcon}>📦</span>
        </div>
      )}

      <div className={styles.content}>
        <span className={styles.orderNumber}>{order.orderNumber}</span>
        <span className={styles.itemCount}>
          {order.items.length} item{order.items.length > 1 ? 's' : ''} •{' '}
          {formatCurrency(order.totalAmount)}
        </span>

        <span
          className={styles.statusBadge}
          style={{
            backgroundColor: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {getStatusDisplayName(order.status)}
        </span>
      </div>

      {order.trackingNumber && order.status === 'shipped' && (
        <div className={styles.trackingInfo}>
          <span className={styles.trackingIcon} style={{ color: statusColor }}>
            📦
          </span>
          <span className={styles.trackingText} style={{ color: statusColor }}>
            In Transit
          </span>
        </div>
      )}
    </div>
  );
}

export default OrderHeaderWidget;
