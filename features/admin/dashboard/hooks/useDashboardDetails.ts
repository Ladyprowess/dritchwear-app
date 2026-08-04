import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { DetailModalState } from '../types';

export function useDashboardDetails() {
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchDetailData = async (type: string) => {
    setDetailLoading(true);
    setDetailData([]);
    try {
      let query: any;

      switch (type) {
        case 'users':
          query = supabase
            .from('profiles')
            .select('id,email,full_name,role,created_at,wallet_balance,points_balance')
            .eq('role', 'customer')
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        case 'orders':
          query = supabase
            .from('orders')
            .select('id,total,order_status,payment_status,created_at,profiles(full_name,email)')
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        case 'revenue':
          query = supabase
            .from('orders')
            .select('id,total,order_status,payment_status,created_at,profiles(full_name,email)')
            .eq('payment_status', 'paid')
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        case 'pending':
          query = supabase
            .from('orders')
            .select('id,total,order_status,payment_status,created_at,profiles(full_name,email)')
            .eq('order_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        case 'points':
          query = supabase
            .from('points_transactions')
            .select('id,user_id,amount,type,description,created_at,profiles(email)')
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        case 'paylinks':
          query = supabase
            .from('payment_links')
            .select('id,token,requester_name,amount_ngn,status,created_at')
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        case 'bills':
          query = supabase
            .from('bill_transactions')
            .select('id,user_id,service_type,service_provider,amount,status,created_at,profiles(email)')
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        case 'referrals':
          query = supabase
            .from('referrals')
            .select(
              'id,referral_code_used,signup_rewarded_at,first_paid_order_at,created_at,' +
              'referrer:referrer_user_id(email),referred:referred_user_id(email)'
            )
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        case 'giftcards':
          query = supabase
            .from('gift_cards')
            .select('id,code,recipient_name,sender_name,original_amount,currency,status,created_at')
            .order('created_at', { ascending: false })
            .limit(20);
          break;

        default:
          setDetailLoading(false);
          return;
      }

      const { data, error } = await query;
      if (error) console.error('Detail fetch error:', error);
      setDetailData(data ?? []);
    } catch (err) {
      console.error('fetchDetailData error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetailModal = (type: string, title: string) => {
    setDetailModal({ type, title });
    fetchDetailData(type);
  };

  const closeDetailModal = () => {
    setDetailModal(null);
    setDetailData([]);
  };

  return { detailModal, detailData, detailLoading, openDetailModal, closeDetailModal };
}
