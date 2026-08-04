import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Award, Zap } from 'lucide-react-native';
import { pointsToNaira } from '@/lib/points';
import type { Profile } from '@/lib/auth';
import { styles } from '../styles';

interface LoyaltyPointsCardProps {
  profile: Profile;
  pointsBalance: number;
  onRedeem: () => void;
}

export function LoyaltyPointsCard({ profile, pointsBalance, onRedeem }: LoyaltyPointsCardProps) {
  const canRedeem = profile.preferred_currency === 'NGN' || (profile.location || '').toLowerCase().includes('nigeria');

  return (
    <View style={styles.pointsCard}>
      <View style={styles.pointsCardLeft}>
        <View style={styles.pointsIconWrap}>
          <Award size={22} color="#FDB813" />
        </View>
        <View>
          <Text style={styles.pointsCardLabel}>Loyalty Points</Text>
          <Text style={styles.pointsCardBalance}>
            {pointsBalance} pts = ₦{pointsToNaira(pointsBalance).toLocaleString()}
          </Text>
        </View>
      </View>
      {canRedeem && (
        <Pressable style={styles.redeemBtn} onPress={onRedeem}>
          <Zap size={14} color="#78350F" />
          <Text style={styles.redeemBtnText}>Redeem</Text>
        </Pressable>
      )}
    </View>
  );
}
