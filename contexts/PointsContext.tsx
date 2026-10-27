/**
 * PointsContext – manages the user's loyalty points balance.
 *
 * Rules:
 *  • Buy something  → +5 points per order
 *  • Drop a review  → +1 point
 *  • 1 point = ₦0.10 (Nigerian Naira)
 *
 * DB requirements (add via Supabase migration):
 *  • profiles.points_balance  INTEGER DEFAULT 0
 *  • points_transactions table (see supabase/migrations)
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { pointsToNaira as convertPointsToNaira } from '@/lib/points';

export interface PointsTransaction {
  id: string;
  type: 'earned' | 'spent';
  amount: number;
  description: string;
  reference?: string;
  created_at: string;
}

interface PointsContextType {
  pointsBalance: number;
  transactions: PointsTransaction[];
  loading: boolean;
  refreshPoints: () => Promise<void>;
  pointsToNaira: (points: number) => number;
}

const PointsContext = createContext<PointsContextType>({
  pointsBalance: 0,
  transactions: [],
  loading: false,
  refreshPoints: async () => {},
  pointsToNaira: convertPointsToNaira,
});

export function PointsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pointsBalance, setPointsBalance] = useState(0);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshPoints = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Fetch balance from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('points_balance')
        .eq('id', user.id)
        .single();

      setPointsBalance(profile?.points_balance ?? 0);

      // Fetch recent transactions
      const { data: txns } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setTransactions((txns as PointsTransaction[]) ?? []);
    } catch (err) {
      console.log('⚠️ Failed to fetch points:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Points are only ever awarded/spent server-side (order, review and
  // referral triggers, bill-pay); this context just reads them.
  useEffect(() => {
    if (user?.id) {
      refreshPoints();
    } else {
      // Signed out: don't keep showing the previous account's points.
      setPointsBalance(0);
      setTransactions([]);
    }
  }, [user?.id]);

  return (
    <PointsContext.Provider
      value={{ pointsBalance, transactions, loading, refreshPoints, pointsToNaira: convertPointsToNaira }}
    >
      {children}
    </PointsContext.Provider>
  );
}

export const usePoints = () => useContext(PointsContext);
