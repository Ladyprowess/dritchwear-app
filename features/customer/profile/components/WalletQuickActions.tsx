import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus, History } from 'lucide-react-native';
import { styles } from '../styles';

interface WalletQuickActionsProps {
  onFundWallet: () => void;
  onWalletHistory: () => void;
}

export function WalletQuickActions({ onFundWallet, onWalletHistory }: WalletQuickActionsProps) {
  return (
    <View style={styles.walletActionsRow}>
      <Pressable style={styles.walletActionCard} onPress={onFundWallet}>
        <View style={[styles.walletActionIcon, { backgroundColor: '#EDE9F6' }]}>
          <Plus size={20} color="#5A2D82" />
        </View>
        <Text style={styles.walletActionTitle}>Fund Wallet</Text>
        <Text style={styles.walletActionSub}>Top up balance</Text>
      </Pressable>
      <Pressable style={styles.walletActionCard} onPress={onWalletHistory}>
        <View style={[styles.walletActionIcon, { backgroundColor: '#FEF3C7' }]}>
          <History size={20} color="#D97706" />
        </View>
        <Text style={styles.walletActionTitle}>Wallet History</Text>
        <Text style={styles.walletActionSub}>View transactions</Text>
      </Pressable>
    </View>
  );
}
