import { useEffect, useState } from 'react';
import { Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { buildCanonicalPublicUrl } from '@/lib/links';

export function useReferralStats(userId: string | undefined, referralCodeRaw: string | null | undefined) {
  const [referralStats, setReferralStats] = useState({ signups: 0, firstOrders: 0 });
  const [showReferralDetails, setShowReferralDetails] = useState(false);

  useEffect(() => {
    const loadReferralStats = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from('referrals')
        .select('id, first_paid_order_id')
        .eq('referrer_user_id', userId);

      if (error) {
        console.log('Failed to load referral stats:', error);
        return;
      }

      const rows = data ?? [];
      setReferralStats({
        signups: rows.length,
        firstOrders: rows.filter((row) => !!row.first_paid_order_id).length,
      });
    };

    void loadReferralStats();
  }, [userId]);

  const referralCode = referralCodeRaw?.trim().toUpperCase() || '';
  const referralLink = referralCode
    ? buildCanonicalPublicUrl('/register', { ref: referralCode })
    : '';

  const handleCopyReferralLink = async () => {
    if (!referralLink) return;

    await Clipboard.setStringAsync(referralLink);
    Alert.alert('Copied', 'Your referral link has been copied.');
  };

  const handleShareReferralLink = async () => {
    if (!referralLink) {
      Alert.alert('Unavailable', 'Your referral link is not ready yet. Please try again shortly.');
      return;
    }

    await Share.share({
      message:
        `Join me on Dritchwear with my referral link: ${referralLink}\n\n` +
        `Referral code: ${referralCode}\n` +
        `You can also enter the code manually during sign up.`,
    });
  };

  return {
    referralStats,
    referralCode,
    referralLink,
    showReferralDetails,
    setShowReferralDetails,
    handleCopyReferralLink,
    handleShareReferralLink,
  };
}
