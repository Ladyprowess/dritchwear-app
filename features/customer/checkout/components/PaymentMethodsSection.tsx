import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { Wallet, CreditCard, Link } from 'lucide-react-native';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import { styles } from '../styles';

interface PaymentMethodsSectionProps {
  walletBalance: number;
  userCurrency: string;
  loading: boolean;
  payLinkLoading: boolean;
  onPayWithWallet: () => void;
  onPayWithCard: () => void;
  onPayForMe: () => void;
}

export function PaymentMethodsSection({
  walletBalance,
  userCurrency,
  loading,
  payLinkLoading,
  onPayWithWallet,
  onPayWithCard,
  onPayForMe,
}: PaymentMethodsSectionProps) {
  // Gentle attention pulse on the primary "Pay with Card" button.
  const payPulse = useSharedValue(0);
  const payPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + payPulse.value * 0.018 }] }));
  useEffect(() => {
    payPulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(payPulse);
  }, []);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Payment Method</Text>

      <Pressable
        style={styles.paymentButton}
        onPress={onPayWithWallet}
        disabled={loading}
      >
        <Wallet size={20} color="#FFFFFF" />
        <Text style={styles.paymentButtonText}>
          Pay with Wallet ({formatCurrency(convertFromNGN(walletBalance || 0, userCurrency), userCurrency)})
        </Text>
      </Pressable>

      <Animated.View style={payPulseStyle}>
        <Pressable
          style={[styles.paymentButton, styles.paystackButton]}
          onPress={onPayWithCard}
          disabled={loading}
        >
          <CreditCard size={20} color="#FFFFFF" />
          <Text style={styles.paymentButtonText}>Pay with Card (Paystack)</Text>
        </Pressable>
      </Animated.View>

      <Pressable
        style={[styles.paymentButton, styles.payLinkButton]}
        onPress={onPayForMe}
        disabled={loading || payLinkLoading}
      >
        {payLinkLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Link size={20} color="#FFFFFF" />
        )}
        <Text style={styles.paymentButtonText}>
          {payLinkLoading ? 'Generating link...' : 'Pay for Me (Send Payment Link)'}
        </Text>
      </Pressable>
    </View>
  );
}
