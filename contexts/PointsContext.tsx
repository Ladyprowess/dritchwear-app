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
  awardPoints: (amount: number, description: string, reference?: string) => Promise<void>;
  spendPoints: (amount: number, description: string, reference?: string) => Promise<boolean>;
  refreshPoints: () => Promise<void>;
  pointsToNaira: (points: number) => number;
}

const PointsContext = createContext<PointsContextType>({
  pointsBalance: 0,
  transactions: [],
  loading: false,
  awardPoints: async () => {},
  spendPoints: async () => false,
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

  useEffect(() => {
    if (user?.id) refreshPoints();
  }, [user?.id]);

  /** Award points to the current user */
  const awardPoints = useCallback(async (
    amount: number,
    description: string,
    reference?: string,
  ) => {
    if (!user?.id || amount <= 0) return;

    try {
      // Insert transaction record
      await supabase.from('points_transactions').insert({
        user_id: user.id,
        type: 'earned',
        amount,
        description,
        reference: reference ?? null,
      });

      // Increment balance in profiles
      await supabase.rpc('increment_points', { uid: user.id, delta: amount });

      setPointsBalance((prev) => prev + amount);
      setTransactions((prev) => [
        {
          id: Date.now().toString(),
          type: 'earned',
          amount,
          description,
          reference,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      console.log(`✅ Awarded ${amount} points: ${description}`);
    } catch (err) {
      console.error('❌ awardPoints error:', err);
    }
  }, [user?.id]);

  /** Spend points; returns false if insufficient balance */
  const spendPoints = useCallback(async (
    amount: number,
    description: string,
    reference?: string,
  ): Promise<boolean> => {
    if (!user?.id || amount <= 0) return false;
    if (pointsBalance < amount) return false;

    try {
      await supabase.from('points_transactions').insert({
        user_id: user.id,
        type: 'spent',
        amount,
        description,
        reference: reference ?? null,
      });

      await supabase.rpc('increment_points', { uid: user.id, delta: -amount });

      setPointsBalance((prev) => prev - amount);
      setTransactions((prev) => [
        {
          id: Date.now().toString(),
          type: 'spent',
          amount,
          description,
          reference,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      return true;
    } catch (err) {
      console.error('❌ spendPoints error:', err);
      return false;
    }
  }, [user?.id, pointsBalance]);

  return (
    <PointsContext.Provider
      value={{ pointsBalance, transactions, loading, awardPoints, spendPoints, refreshPoints, pointsToNaira: convertPointsToNaira }}
    >
      {children}
    </PointsContext.Provider>
  );
}

export const usePoints = () => useContext(PointsContext);
