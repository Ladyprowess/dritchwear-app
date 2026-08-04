import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface AdminChatAlert {
  id: string;
  title: string;
  message: string;
}

// Notifies the admin of new customer messages by subscribing straight to
// support_messages (RLS lets admins see all). Any message not sent by this admin
// is treated as an incoming customer message → toast + browser notification.
export function useAdminChatAlerts(isAdmin: boolean, currentUserId?: string) {
  const [unreadChats, setUnreadChats] = useState(0);
  const [chatAlert, setChatAlert] = useState<AdminChatAlert | null>(null);

  const markChatsSeen = useCallback(() => {
    setUnreadChats(0);
    setChatAlert(null);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('admin-chat-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
        const m = payload.new as any;
        if (!m || m.sender_id === currentUserId) return; // ignore the admin's own replies
        const preview = (m.message || '').toString().trim();
        const body = preview ? (preview.length > 90 ? `${preview.slice(0, 90)}…` : preview) : 'Sent an attachment';
        setUnreadChats((c) => c + 1);
        setChatAlert({ id: m.id, title: 'New customer message', message: body });
        if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          new window.Notification('New customer message', { body, icon: '/icons/icon-192.png', tag: `chat-${m.id}` });
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isAdmin, currentUserId]);

  return { unreadChats, chatAlert, markChatsSeen };
}
