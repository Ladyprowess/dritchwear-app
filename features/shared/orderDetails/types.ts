export type { Order, OrderItem, Invoice } from '@/lib/orders/types';
import type { Order } from '@/lib/orders/types';

export interface OrderDetailsModalProps {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onOrderUpdate: () => void;
  mode?: 'view' | 'manage';
}

export const statusOptions = [
  'pending',
  'in_review',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
];

export const customStatusOptions = [
  'pending',
  'under_review',
  'quoted',
  'accepted',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'rejected',
  'cancelled',
];
