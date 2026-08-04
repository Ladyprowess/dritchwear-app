import type { ComponentType } from 'react';

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  totalPointsIssued: number;
  paymentLinksGenerated: number;
  billPaymentsCount: number;
  referralsCount: number;
  giftCardsCount: number;
  giftCardsActive: number;
  giftCardsRedeemed: number;
}

export interface RecentOrder {
  id: string;
  user_id: string;
  total: number;
  order_status: string;
  payment_status?: string;
  created_at: string;
  currency?: string;
  original_amount?: number;
  contact_phone?: string | null;
  profiles: {
    full_name: string;
    email: string;
    wallet_balance?: number;
    phone?: string | null;
    preferred_currency?: string;
  };
  title?: string;
  description?: string;
  quantity?: number;
  budget_range?: string;
  status?: string;
}

export interface StatCard {
  type: string;
  title: string;
  value: string;
  icon: ComponentType<any>;
  accent: string;
  tint: string;
}

export interface DetailModalState {
  type: string;
  title: string;
}

export interface TopProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  sold: number;
}

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
}

export interface StatusCount {
  label: string;
  value: number;
  color: string;
}
