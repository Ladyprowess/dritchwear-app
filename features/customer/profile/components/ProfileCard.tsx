import React from 'react';
import { Text, View } from 'react-native';
import { Wallet } from 'lucide-react-native';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import type { Profile } from '@/lib/auth';
import { styles } from '../styles';

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const walletBalanceInPreferredCurrency = profile.preferred_currency === 'NGN' ?
    profile.wallet_balance :
    convertFromNGN(profile.wallet_balance, profile.preferred_currency);

  return (
    <View style={styles.profileCard}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.profileInfo}>
        <Text style={styles.userName}>
          {profile.full_name || 'Add your name'}
        </Text>
        <Text style={styles.userEmail}>{profile.email}</Text>

        <View style={styles.walletContainer}>
          <Wallet size={16} color="#5A2D82" />
          <Text style={styles.walletBalance}>
            {formatCurrency(walletBalanceInPreferredCurrency, profile.preferred_currency || 'NGN')}
          </Text>
        </View>
      </View>
    </View>
  );
}
