// Demo user types
export type UserRole = 'buyer' | 'seller';

export interface DemoUser {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

// Order types
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date;
  trackingNumber?: string;
}

// Demo users
export const DemoUsers: Record<UserRole, DemoUser> = {
  buyer: {
    id: 'buyer-001',
    name: 'John Buyer',
    role: 'buyer',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  },
  seller: {
    id: 'seller-001',
    name: 'Sarah Seller',
    role: 'seller',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  },
};

// Mock orders
export const MockOrders: Order[] = [
  {
    id: 'order-001',
    orderNumber: 'ORD-2024-001',
    buyerId: 'buyer-001',
    sellerId: 'seller-001',
    status: 'shipped',
    items: [
      {
        id: 'item_001',
        name: 'Wireless Headphones',
        quantity: 1,
        price: 79.99,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200',
      },
      {
        id: 'item_002',
        name: 'Phone Case',
        quantity: 2,
        price: 19.99,
        imageUrl: 'https://images.unsplash.com/photo-1601593346740-925612772716?w=200',
      },
    ],
    totalAmount: 119.97,
    createdAt: new Date('2024-01-15T10:30:00'),
    trackingNumber: 'TRK123456789',
  },
  {
    id: 'order-002',
    orderNumber: 'ORD-2024-002',
    buyerId: 'buyer-001',
    sellerId: 'seller-001',
    status: 'pending',
    items: [
      {
        id: 'item_003',
        name: 'Smart Watch',
        quantity: 1,
        price: 299.99,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
      },
    ],
    totalAmount: 299.99,
    createdAt: new Date('2024-01-18T14:15:00'),
  },
  {
    id: 'order-003',
    orderNumber: 'ORD-2024-003',
    buyerId: 'buyer-001',
    sellerId: 'seller-001',
    status: 'delivered',
    items: [
      {
        id: 'item_004',
        name: 'Laptop Stand',
        quantity: 1,
        price: 49.99,
        imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200',
      },
      {
        id: 'item_005',
        name: 'USB-C Hub',
        quantity: 1,
        price: 39.99,
        imageUrl: 'https://images.unsplash.com/photo-1625723044792-44de16ccb4e9?w=200',
      },
      {
        id: 'item_006',
        name: 'Wireless Mouse',
        quantity: 1,
        price: 29.99,
        imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200',
      },
    ],
    totalAmount: 119.97,
    createdAt: new Date('2024-01-10T09:00:00'),
  },
  {
    id: 'order-004',
    orderNumber: 'ORD-2024-004',
    buyerId: 'buyer-001',
    sellerId: 'seller-001',
    status: 'confirmed',
    items: [
      {
        id: 'item_007',
        name: 'Mechanical Keyboard',
        quantity: 1,
        price: 149.99,
        imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=200',
      },
    ],
    totalAmount: 149.99,
    createdAt: new Date('2024-01-20T16:45:00'),
  },
  {
    id: 'order-005',
    orderNumber: 'ORD-2024-005',
    buyerId: 'buyer-001',
    sellerId: 'seller-001',
    status: 'cancelled',
    items: [
      {
        id: 'item_008',
        name: 'Bluetooth Speaker',
        quantity: 1,
        price: 89.99,
        imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=200',
      },
    ],
    totalAmount: 89.99,
    createdAt: new Date('2024-01-12T11:20:00'),
  },
];

// Helper functions
export function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return '#FF9500';
    case 'confirmed':
      return '#007AFF';
    case 'shipped':
      return '#5856D6';
    case 'delivered':
      return '#34C759';
    case 'cancelled':
      return '#FF3B30';
    default:
      return '#8E8E93';
  }
}

export function getStatusDisplayName(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'shipped':
      return 'Shipped';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getOrderById(id: string): Order | undefined {
  return MockOrders.find((order) => order.id === id);
}
