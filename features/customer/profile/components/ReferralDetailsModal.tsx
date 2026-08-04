import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { X, Share2, Copy } from 'lucide-react-native';
import { styles } from '../styles';

interface ReferralDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  referralCode: string;
  referralStats: { signups: number; firstOrders: number };
  onShare: () => void;
  onCopy: () => void;
}

export function ReferralDetailsModal({ visible, onClose, referralCode, referralStats, onShare, onCopy }: ReferralDetailsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Invite and Earn</Text>
            <Pressable style={styles.sheetCloseBtn} onPress={onClose}>
              <X size={18} color="#6B7280" />
            </Pressable>
          </View>

          <Text style={styles.sheetIntro}>
            Share your personal link. You earn 1 point when someone signs up and 3 more points when they place their first paid order.
          </Text>

          <View style={styles.referralCodeBox}>
            <Text style={styles.referralCodeLabel}>Your referral code</Text>
            <Text style={styles.referralCodeValue}>{referralCode || 'Generating...'}</Text>
          </View>

          <View style={styles.referralStatsRow}>
            <View style={styles.referralStat}>
              <Text style={styles.referralStatValue}>{referralStats.signups}</Text>
              <Text style={styles.referralStatLabel}>Signups</Text>
            </View>
            <View style={styles.referralStat}>
              <Text style={styles.referralStatValue}>{referralStats.firstOrders}</Text>
              <Text style={styles.referralStatLabel}>First orders</Text>
            </View>
          </View>

          <View style={styles.referralActions}>
            <Pressable style={styles.referralActionPrimary} onPress={onShare}>
              <Share2 size={16} color="#FFFFFF" />
              <Text style={styles.referralActionPrimaryText}>Share Link</Text>
            </Pressable>
            <Pressable style={styles.referralActionSecondary} onPress={onCopy}>
              <Copy size={16} color="#1D4ED8" />
              <Text style={styles.referralActionSecondaryText}>Copy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
