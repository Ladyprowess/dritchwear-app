import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Wallet, CreditCard, DollarSign, X, Globe } from 'lucide-react-native';
import PaystackPayment from '@/components/PaystackPayment';
import CurrencySelector from '@/components/CurrencySelector';
import { convertToNGN, formatCurrency, isNairaCurrency } from '@/lib/currency';
import PayPalPayment from '@/components/PayPalPayment';
import { convertFromNGN } from '@/lib/currency';


const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];
const quickAmountsInternational = [10, 20, 50, 100, 200, 500];

export default function FundWalletScreen() {
  const router = useRouter();
  const { profile, user, refreshProfile } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaystack, setShowPaystack] = useState(false);
  const [showPayPal, setShowPayPal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(profile?.preferred_currency || 'NGN');

  const handleCurrencyChange = (currencyCode: string) => {
    setSelectedCurrency(currencyCode);
    setAmount(''); // Reset amount when currency changes
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
  };

  const getQuickAmounts = () => {
    return isNairaCurrency(selectedCurrency) ? quickAmounts : quickAmountsInternational;
  };

  const handleFundWallet = async () => {
    const fundAmount = parseFloat(amount);
    
    if (!amount || isNaN(fundAmount) || fundAmount <= 0) {
      Alert.alert('Invalid Amount', `Please enter a valid amount (minimum ${formatCurrency(1, selectedCurrency)})`);
      return;
    }

    if (!user || !profile) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);

    // Choose payment provider based on currency
    if (isNairaCurrency(selectedCurrency)) {
      // Check if we have Paystack public key
      if (!process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY) {
        Alert.alert(
          'Payment Not Available',
          'Payment gateway is not configured. Please contact support.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      setShowPaystack(true);
    } else {
      // Use PayPal for international currencies
      if (!process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID) {
        Alert.alert(
          'Payment Not Available',
          'PayPal is not configured. Please contact support.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      setShowPayPal(true);
    }
  };

  const handlePaystackSuccess = async (response: any) => {
    setShowPaystack(false);

    try {
      const fundAmount = parseFloat(amount);
      const ngnAmount = fundAmount; // For Paystack, amount is already in NGN
      
      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'credit',
          amount: ngnAmount,
          currency: 'NGN',
          description: `Wallet funding via Paystack`,
          reference: response.reference,
          status: 'completed',
          payment_provider: 'paystack'
        });

      if (transactionError) throw transactionError;

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('profiles')
        .update({
          wallet_balance: (profile!.wallet_balance || 0) + ngnAmount
        })
        .eq('id', user!.id);

      if (walletError) throw walletError;

      // Refresh profile to get updated balance
      await refreshProfile();

      Alert.alert(
        'Payment Successful',
        `Your wallet has been funded with ${formatCurrency(ngnAmount, 'NGN')}`,
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

  const handlePayPalSuccess = async (response: any) => {
    setShowPayPal(false);

    try {
      const fundAmount = parseFloat(amount);
      
      // Convert from selected currency to NGN for wallet storage
      const ngnAmount = convertToNGN(fundAmount, selectedCurrency);
      
      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'credit',
          amount: ngnAmount,
          currency: selectedCurrency,
          original_amount: fundAmount,
          exchange_rate: ngnAmount / fundAmount,
          description: `Wallet funding via PayPal (${selectedCurrency})`,
          reference: response.reference,
          status: 'completed',
          payment_provider: 'paypal'
        });

      if (transactionError) throw transactionError;

      // Update wallet balance (always in NGN)
      const { error: walletError } = await supabase
        .from('profiles')
        .update({
          wallet_balance: (profile!.wallet_balance || 0) + ngnAmount
        })
        .eq('id', user!.id);

      if (walletError) throw walletError;

      // Refresh profile to get updated balance
      await refreshProfile();

      Alert.alert(
        'Payment Successful',
        `Your wallet has been funded with ${formatCurrency(fundAmount, selectedCurrency)} (${formatCurrency(ngnAmount, 'NGN')})`,
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

  const handlePayPalCancel = () => {
    setShowPayPal(false);
    setLoading(false);
    Alert.alert('Payment Cancelled', 'Your payment was cancelled');
  };

  // Get wallet balance in preferred currency
  const walletBalanceInPreferredCurrency = profile?.preferred_currency === 'NGN' ? 
    profile?.wallet_balance : 
    convertFromNGN(profile?.wallet_balance || 0, profile?.preferred_currency || 'NGN');

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
            {formatCurrency(walletBalanceInPreferredCurrency, profile?.preferred_currency || 'NGN')}
          </Text>
          <Text style={styles.balanceNote}>
            {profile?.preferred_currency !== 'NGN' ? 
              `Equivalent to ${formatCurrency(profile?.wallet_balance || 0, 'NGN')} in Nigerian Naira` :
              'Your wallet balance is maintained in Nigerian Naira (NGN)'
            }
          </Text>
        </View>

        {/* Currency Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Currency</Text>
          <CurrencySelector
            selectedCurrency={selectedCurrency}
            onCurrencyChange={handleCurrencyChange}
          />
          <Text style={styles.currencyNote}>
            {isNairaCurrency(selectedCurrency) 
              ? 'Naira payments are processed via Paystack' 
              : 'International payments are processed via PayPal'}
          </Text>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Amount</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>
              {selectedCurrency === 'NGN' ? '₦' : 
               selectedCurrency === 'USD' ? '$' :
               selectedCurrency === 'EUR' ? '€' :
               selectedCurrency === 'GBP' ? '£' : selectedCurrency}
            </Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
          <Text style={styles.inputHint}>
            Minimum amount: {formatCurrency(1, selectedCurrency)}
          </Text>
        </View>

        {/* Quick Amounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Amounts</Text>
          <View style={styles.quickAmountsGrid}>
            {getQuickAmounts().map((quickAmount) => (
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
                  {formatCurrency(quickAmount, selectedCurrency)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethodCard}>
            {isNairaCurrency(selectedCurrency) ? (
              <>
                <CreditCard size={24} color="#7C3AED" />
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Paystack</Text>
                  <Text style={styles.paymentMethodSubtitle}>
                    Pay securely with card, bank transfer, or USSD
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Globe size={24} color="#0070BA" />
                <View style={styles.paymentMethodInfo}>
                  <Text style={[styles.paymentMethodTitle, { color: '#0070BA' }]}>PayPal</Text>
                  <Text style={styles.paymentMethodSubtitle}>
                    Pay securely with PayPal or credit card
                  </Text>
                </View>
              </>
            )}
          </View>
          {!isNairaCurrency(selectedCurrency) && process.env.EXPO_PUBLIC_PAYPAL_SANDBOX === 'true' && (
            <Text style={styles.sandboxNote}>
              🔧 PayPal Sandbox Mode - No real payment will be processed
            </Text>
          )}
        </View>

        {/* Fund Button */}
        <View style={styles.fundContainer}>
          <Pressable
            style={[
              styles.fundButton, 
              (!amount || loading) && styles.fundButtonDisabled,
              !isNairaCurrency(selectedCurrency) && styles.paypalButton
            ]}
            onPress={handleFundWallet}
            disabled={!amount || loading}
          >
            <Text style={styles.fundButtonText}>
              {loading ? 'Processing...' : `Fund Wallet ${amount ? formatCurrency(parseFloat(amount), selectedCurrency) : ''}`}
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

      {/* PayPal Payment Modal */}
      <Modal
        visible={showPayPal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePayPalCancel}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Complete Payment</Text>
            <Pressable style={styles.closeButton} onPress={handlePayPalCancel}>
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>
          
          {showPayPal && amount && profile && (
            <PayPalPayment
              email={profile.email}
              amount={parseFloat(amount)}
              currency={selectedCurrency}
              customerName={profile.full_name || 'Customer'}
              description={`Wallet funding - ${formatCurrency(parseFloat(amount), selectedCurrency)}`}
              onSuccess={handlePayPalSuccess}
              onCancel={handlePayPalCancel}
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
    marginBottom: 8,
  },
  balanceNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
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
  currencyNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 8,
  },
  sandboxNote: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#F59E0B',
    marginTop: 8,
    textAlign: 'center',
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
  currencySymbol: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#6B7280',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    height: 56,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
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
    color: '#7C3AED',
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
  paypalButton: {
    backgroundColor: '#0070BA',
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