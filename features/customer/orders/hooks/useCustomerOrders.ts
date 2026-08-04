import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Order } from '../types';

export function useCustomerOrders(userId: string | undefined, onError: (message: string) => void) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customRequests, setCustomRequests] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filterOrders = (ordersList: Order[], filter: string) => {
    let filtered = [...ordersList];

    if (filter === 'Custom Orders') {
      filtered = filtered.filter(item => !item.items);
    } else if (filter !== 'All') {
      filtered = filtered.filter(item => {
        if (item.items) {
          return item.order_status?.toLowerCase() === filter.toLowerCase();
        } else {
          return item.status?.toLowerCase() === filter.toLowerCase();
        }
      });
    }

    setFilteredOrders(filtered);
  };

  const fetchOrders = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const { data: customData, error: customError } = await supabase
        .from('custom_requests')
        .select('*, invoices(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (customError) throw customError;

      setOrders(ordersData || []);
      setCustomRequests(customData || []);

      const allItems = [...(ordersData || []), ...(customData || [])];
      filterOrders(allItems, selectedStatus);
    } catch (error) {
      console.error('Error fetching orders:', error);
      onError('We could not load your orders. Pull down to try again.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!userId) return;

    let timeout: any;

    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
        () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => fetchOrders(), 300);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'custom_requests', filter: `user_id=eq.${userId}` },
        () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => fetchOrders(), 300);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${userId}` },
        () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => fetchOrders(), 300);
        }
      )
      .subscribe((status) => console.log('📡 realtime status:', status));

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchOrders]);

  useEffect(() => {
    const allItems = [...orders, ...customRequests];
    filterOrders(allItems, selectedStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, customRequests, selectedStatus]);

  return {
    filteredOrders,
    selectedStatus,
    setSelectedStatus,
    loading,
    refreshing,
    onRefresh,
    fetchOrders,
  };
}
