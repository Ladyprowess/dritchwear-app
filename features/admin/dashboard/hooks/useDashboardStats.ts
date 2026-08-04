import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DASHBOARD_STATUS_CHART_COLORS, LOW_STOCK_THRESHOLD } from '@/lib/admin/constants';
import type { DashboardStats, RecentOrder, TopProduct, LowStockProduct, StatusCount } from '../types';

const INITIAL_STATS: DashboardStats = {
  totalUsers: 0,
  totalOrders: 0,
  totalRevenue: 0,
  pendingOrders: 0,
  totalPointsIssued: 0,
  paymentLinksGenerated: 0,
  billPaymentsCount: 0,
  referralsCount: 0,
  giftCardsCount: 0,
  giftCardsActive: 0,
  giftCardsRedeemed: 0,
};

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [salesSeries, setSalesSeries] = useState<number[]>([]);
  const [growthSeries, setGrowthSeries] = useState<number[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [productsSold, setProductsSold] = useState(0);
  const [aov, setAov] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [
        { count: userCount },
        { data: orders },
        { data: customRequests },
        { data: recentOrdersData },
        { data: recentCustomData },
        { data: pointsTxns },
        { count: paymentLinksCount },
        { count: billPaymentsCount },
        { count: referralsCount },
        { data: giftCardsRaw },
        { data: salesCounts },
        { data: productsData },
        { data: newCustomers },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'customer'),

        supabase
          .from('orders')
          .select('total, order_status, payment_status, currency, original_amount, created_at'),

        supabase
          .from('custom_requests')
          .select('status, invoices(amount, status, currency, original_amount)'),

        supabase
          .from('orders')
          .select(
            `id, user_id, items, subtotal, service_fee, delivery_fee, tax, total,
             payment_method, payment_status, order_status, delivery_address,
             contact_phone, created_at, currency, original_amount, promo_code,
             discount_amount, profiles!inner(full_name, email, phone, wallet_balance, preferred_currency)`
          )
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('custom_requests')
          .select(
            `id, user_id, title, description, quantity, budget_range, status,
             created_at, currency, invoice_sent,
             profiles!inner(full_name, email, phone, wallet_balance, preferred_currency),
             invoices(*)`
          )
          .order('created_at', { ascending: false })
          .limit(1),

        supabase.from('points_transactions').select('amount, type'),

        supabase
          .from('payment_links')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('bill_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'success'),

        supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('gift_cards')
          .select('status'),

        supabase.rpc('get_product_sales_counts'),

        supabase
          .from('products')
          .select('id, name, price, image_url, stock, is_active'),

        supabase
          .from('profiles')
          .select('created_at')
          .eq('role', 'customer')
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);

      const totalPointsIssued = (pointsTxns ?? [])
        .filter((t: any) => t.type === 'earned')
        .reduce((s: number, t: any) => s + (t.amount ?? 0), 0);

      const totalRevenue = (orders ?? [])
        .filter((o: any) => o.payment_status === 'paid')
        .reduce((sum: number, o: any) => sum + (o.total ?? 0), 0);

      let customRevenue = 0;
      (customRequests ?? []).forEach((req: any) => {
        (req.invoices ?? []).forEach((inv: any) => {
          if (inv.status === 'paid') customRevenue += inv.amount ?? 0;
        });
      });

      const pendingOrders = (orders ?? []).filter((o: any) => o.order_status === 'pending').length;
      const totalOrdersCount = (orders?.length ?? 0) + (customRequests?.length ?? 0);

      const giftCardsActive = (giftCardsRaw ?? []).filter((g: any) => g.status === 'active').length;
      const giftCardsRedeemed = (giftCardsRaw ?? []).filter((g: any) => g.status === 'redeemed').length;
      const giftCardsCount = giftCardsRaw?.length ?? 0;

      setStats({
        totalUsers: userCount ?? 0,
        totalOrders: totalOrdersCount,
        totalRevenue: totalRevenue + customRevenue,
        pendingOrders,
        totalPointsIssued,
        paymentLinksGenerated: paymentLinksCount ?? 0,
        billPaymentsCount: billPaymentsCount ?? 0,
        referralsCount: referralsCount ?? 0,
        giftCardsCount,
        giftCardsActive,
        giftCardsRedeemed,
      });

      // ── Charts + top/low lists (all derived from the fetched data) ──────────
      const salesMap = new Map<string, number>((salesCounts ?? []).map((r: any) => [String(r.product_id), Number(r.total_ordered) || 0]));
      const soldTotal = [...salesMap.values()].reduce((s, n) => s + n, 0);
      const prodById = new Map<string, any>((productsData ?? []).map((p: any) => [String(p.id), p]));
      const top = [...salesMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, sold]) => { const p = prodById.get(id); return p ? { id, name: p.name, price: p.price, image: p.image_url, sold } : null; })
        .filter(Boolean) as TopProduct[];
      setTopProducts(top);
      setProductsSold(soldTotal);

      const low = (productsData ?? [])
        .filter((p: any) => p.is_active !== false && (p.stock ?? 0) <= LOW_STOCK_THRESHOLD)
        .sort((a: any, b: any) => (a.stock ?? 0) - (b.stock ?? 0))
        .slice(0, 6)
        .map((p: any) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }));
      setLowStock(low);

      const statusMap = new Map<string, number>();
      (orders ?? []).forEach((o: any) => { const st = (o.order_status || 'pending'); statusMap.set(st, (statusMap.get(st) || 0) + 1); });
      setStatusCounts([...statusMap.entries()].map(([label, value]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), value, color: DASHBOARD_STATUS_CHART_COLORS[label] ?? '#9CA3AF' })));

      const paidCount = (orders ?? []).filter((o: any) => o.payment_status === 'paid').length;
      setAov(paidCount ? totalRevenue / paidCount : 0);

      // 30-day daily series for the sales area chart + customer-growth bars.
      const days = 30;
      const now = new Date(); now.setHours(23, 59, 59, 999);
      const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const revByDay = new Map<string, number>();
      const custByDay = new Map<string, number>();
      (orders ?? []).forEach((o: any) => { if (o.payment_status === 'paid' && o.created_at) { const k = dayKey(new Date(o.created_at)); revByDay.set(k, (revByDay.get(k) || 0) + (o.total || 0)); } });
      (newCustomers ?? []).forEach((c: any) => { if (c.created_at) { const k = dayKey(new Date(c.created_at)); custByDay.set(k, (custByDay.get(k) || 0) + 1); } });
      const salesArr: number[] = []; const growthArr: number[] = [];
      for (let i = days - 1; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); salesArr.push(revByDay.get(dayKey(d)) || 0); growthArr.push(custByDay.get(dayKey(d)) || 0); }
      setSalesSeries(salesArr);
      setGrowthSeries(growthArr);

      const combinedRecent = [
        ...(recentOrdersData ?? []),
        ...(recentCustomData ?? []),
      ]
        .sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 5);

      setRecentOrders(combinedRecent as unknown as RecentOrder[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  return {
    stats,
    recentOrders,
    salesSeries,
    growthSeries,
    statusCounts,
    topProducts,
    lowStock,
    productsSold,
    aov,
    loading,
    refreshing,
    onRefresh,
    refetch: fetchDashboardData,
  };
}
