import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Wallet, CreditCard, DollarSign, X } from 'lucide-react-native';
import PaystackPayment from '@/components/PaystackPayment';

const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

export default function FundWalletScreen() {
  const router = useRouter();
  const { profile, user, refreshProfile } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaystack, setShowPaystack] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
  };

  const handleFundWallet = async () => {
    const fundAmount = parseFloat(amount);
    
    if (!amount || isNaN(fundAmount) || fundAmount < 100) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount (minimum ₦100)');
      return;
    }

    if (fundAmount > 1000000) {
      Alert.alert('Amount Too Large', 'Maximum funding amount is ₦1,000,000');
      return;
    }

    if (!user || !profile) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    // Check if we have Paystack public key
    if (!process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY) {
      Alert.alert(
        'Payment Not Available',
        'Payment gateway is not configured. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    setShowPaystack(true);
  };

  const handlePaystackSuccess = async (response: any) => {
    setShowPaystack(false);

    try {
      const fundAmount = parseFloat(amount);
      
      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'credit',
          amount: fundAmount,
          description: `Wallet funding via Paystack`,
          reference: response.reference,
          status: 'completed'
        });

      if (transactionError) throw transactionError;

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('profiles')
        .update({
          wallet_balance: (profile!.wallet_balance || 0) + fundAmount
        })
        .eq('id', user!.id);

      if (walletError) throw walletError;

      // Refresh profile to get updated balance
      await refreshProfile();

      Alert.alert(
        'Payment Successful',
        `Your wallet has been funded with ${formatCurrency(fundAmount)}`,
        [{ text: 'OK', onPress: () => {
          setAmount('');
          router.back();
        }}]
      );
    } catch (error) {
      console.error('Error updating wallet:', error);
      Alert.alert('Error', 'Payment was successful but failed to update wallet. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaystackCancel = () => {
    setShowPaystack(false);
    setLoading(false);
    Alert.alert('Payment Cancelled', 'Your payment was cancelled');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Fund Wallet</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current Balance */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Wallet size={24} color="#7C3AED" />
            <Text style={styles.balanceLabel}>Current Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>
            {formatCurrency(profile?.wallet_balance || 0)}
          </Text>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Amount</Text>
          <View style={styles.amountInputContainer}>
            <DollarSign size={20} color="#9CA3AF" />
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <Text style={styles.currency}>NGN</Text>
          </View>
          <Text style={styles.inputHint}>Minimum amount: ₦100</Text>
        </View>

        {/* Quick Amounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Amounts</Text>
          <View style={styles.quickAmountsGrid}>
            {quickAmounts.map((quickAmount) => (
              <Pressable
                key={quickAmount}
                style={[
                  styles.quickAmountButton,
                  amount === quickAmount.toString() && styles.quickAmountButtonActive
                ]}
                onPress={() => handleQuickAmount(quickAmount)}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    amount === quickAmount.toString() && styles.quickAmountTextActive
                  ]}
                >
                  {formatCurrency(quickAmount)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethodCard}>
            <CreditCard size={24} color="#7C3AED" />
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodTitle}>Paystack</Text>
              <Text style={styles.paymentMethodSubtitle}>
                Pay securely with card, bank transfer, or USSD
              </Text>
            </View>
          </View>
        </View>

        {/* Fund Button */}
        <View style={styles.fundContainer}>
          <Pressable
            style={[styles.fundButton, (!amount || loading) && styles.fundButtonDisabled]}
            onPress={handleFundWallet}
            disabled={!amount || loading}
          >
            <Text style={styles.fundButtonText}>
              {loading ? 'Processing...' : `Fund Wallet ${amount ? formatCurrency(parseFloat(amount)) : ''}`}
            </Text>
          </Pressable>
          
          <Text style={styles.securityNote}>
            🔒 Your payment is secured with 256-bit SSL encryption
          </Text>
        </View>
      </ScrollView>

      {/* Paystack Payment Modal */}
      <Modal
        visible={showPaystack}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePaystackCancel}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Complete Payment</Text>
            <Pressable style={styles.closeButton} onPress={handlePaystackCancel}>
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>
          
          {showPaystack && amount && profile && (
            <PaystackPayment
              email={profile.email}
              amount={parseFloat(amount)}
              publicKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || ''}
              customerName={profile.full_name || 'Customer'}
              onSuccess={handlePaystackSuccess}
              onCancel={handlePaystackCancel}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  balanceLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  balanceAmount: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  amountInput: {
    flex: 1,
    height: 56,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  currency: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  inputHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 8,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAmountButton: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickAmountButtonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  quickAmountText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  quickAmountTextActive: {
    color: '#FFFFFF',
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentMethodInfo: {
    marginLeft: 12,
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  paymentMethodSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  fundContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  fundButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  fundButtonDisabled: {
    opacity: 0.6,
  },
  fundButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  securityNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});