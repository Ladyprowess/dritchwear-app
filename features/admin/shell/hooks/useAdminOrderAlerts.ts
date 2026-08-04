import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface AdminLiveAlert {
  id: string;
  title: string;
  message: string;
}

export function useAdminOrderAlerts(isAdmin: boolean) {
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [liveAlert, setLiveAlert] = useState<AdminLiveAlert | null>(null);

  const refreshAdminAlerts = useCallback(async () => {
    if (!isAdmin) return;
    const { count } = await supabase.from('admin_alerts').select('id', { count: 'exact', head: true }).eq('is_read', false).in('type', ['order', 'custom_order']);
    setUnreadOrders(count || 0);
  }, [isAdmin]);

  const markOrdersSeen = useCallback(async () => {
    await supabase.from('admin_alerts').update({ is_read: true }).eq('is_read', false).in('type', ['order', 'custom_order']);
    setUnreadOrders(0);
    setLiveAlert(null);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void refreshAdminAlerts();
    const channel = supabase.channel('admin-order-alerts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_alerts' }, (payload) => {
      const alert = payload.new as any;
      if (!['order', 'custom_order'].includes(alert.type)) return;
      setUnreadOrders((count) => count + 1);
      setLiveAlert({ id: alert.id, title: alert.title, message: alert.message });
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        new window.Notification(alert.title, { body: alert.message, icon: '/icons/icon-192.png', tag: alert.id });
      }
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isAdmin, refreshAdminAlerts]);

  return { unreadOrders, liveAlert, markOrdersSeen };
}
