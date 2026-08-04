export type { Order, Invoice } from '@/lib/orders/types';

export interface OrderNotice {
  tone: 'error' | 'success' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const statusFilters = ['All', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Custom Orders'];
