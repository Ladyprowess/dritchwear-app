import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator, TextInput, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, User, CreditCard, X, CheckCircle } from 'lucide-react-native';
import { formatCurrency } from '@/lib/currency';
import PaystackPayment from '@/components/PaystackPayment';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

export default function PayLinkGateway() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [loadingLink, setLoadingLink]     = useState(true);
  const [linkData,    setLinkData]        = useState<any>(null);
  const [notFound,    setNotFound]        = useState(false);

  const [payerEmail,  setPayerEmail]      = useState('');
  const [emailReady,  setEmailReady]      = useState(false);

  const [showPaystack, setShowPaystack]   = useState(false);
  const [processing,   setProcessing]     = useState(false);
  const [paid,         setPaid]           = useState(false);
  const [webScriptReady, setWebScriptReady] = useState(false);

  // ── Web: load Paystack inline.js directly (bypasses iframe restriction) ───
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const script = (document as any).createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setWebScriptReady(true);
    script.onerror = () => setWebScriptReady(true); // still allow tap - startPayment will surface the error
    (document as any).head.appendChild(script);
    return () => {
      try { (document as any).head.removeChild(script); } catch {}
    };
  }, []);

  const handleWebPayment = () => {
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      Alert.alert('Error', 'Payment system is still loading. Please wait a moment and try again.');
      return;
    }
    setProcessing(true);
    const handler = PaystackPop.setup({
      key: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
      email: payerEmail,
      amount: Math.round((linkData?.amount_ngn ?? 0)) * 100, // whole kobo, no fraction
      currency: 'NGN',
      ref: 'dw_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      callback: (response: any) => {
        setProcessing(false);
        handlePaystackSuccess(response);
      },
      onClose: () => {
        setProcessing(false);
      },
    });
    handler.openIframe();
  };

  // ── Fetch payment link ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setNotFound(true); setLoadingLink(false); return; }

    const fetch = async () => {
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) { setNotFound(true); setLoadingLink(false); return; }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setNotFound(true); setLoadingLink(false); return;
      }

      setLinkData(data);
      setLoadingLink(false);
    };

    fetch();
  }, [token]);

  // ── Payment success handler ───────────────────────────────────────────────
  const handlePaystackSuccess = async (response: any) => {
    setShowPaystack(false);
    setProcessing(true);

    try {
      const confirmRes = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/pay/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          payerEmail,
          reference: response?.reference || response?.trxref || '',
        }),
      });

      const confirmBody = await confirmRes.json().catch(() => null);

      if (!confirmRes.ok || !confirmBody?.success) {
        throw new Error(confirmBody?.error || 'Failed to update order after payment.');
      }

      setPaid(true);
    } catch (err) {
      Alert.alert('Error', 'Payment recorded but failed to update order. Please contact support.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePaystackCancel = () => {
    setShowPaystack(false);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadingLink) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND.purple} />
        <Text style={styles.loadingText}>Loading payment details...</Text>
      </SafeAreaView>
    );
  }

  // ── Not found / expired ───────────────────────────────────────────────────
  if (notFound) {
    return (
      <SafeAreaView style={styles.centered}>
        <X size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Link Unavailable</Text>
        <Text style={styles.errorSub}>
          This payment link is invalid, expired, or has already been paid.
        </Text>
      </SafeAreaView>
    );
  }

  // ── Paid success screen ───────────────────────────────────────────────────
  if (paid) {
    return (
      <SafeAreaView style={styles.centered}>
        <CheckCircle size={56} color="#10B981" />
        <Text style={styles.successTitle}>Payment Successful!</Text>
        <Text style={styles.successSub}>
          The order is now being reviewed. Thank you for paying!
        </Text>
      </SafeAreaView>
    );
  }

  const items: any[]    = linkData?.items ?? [];
  const amountNGN: number = linkData?.amount_ngn ?? linkData?.amount ?? 0;
  const requester: string = linkData?.requester_name ?? 'Someone';

  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: '#EDE9F6' }]}>
            <ShoppingBag size={22} color={BRAND.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Pay for Order</Text>
            <Text style={styles.headerSub}>{requester} wants you to cover this order</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Order items */}
          {items.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Order Items</Text>
              {items.map((item: any, i: number) => (
                <View key={i} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {(item.size || item.color) && (
                      <Text style={styles.itemMeta}>
                        {[item.size, item.color].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    {typeof item.note === 'string' && item.note.trim() ? (
                      <Text style={styles.itemNote}>
                        Special request: {item.note.trim()}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.itemQty}>x{item.quantity}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price * item.quantity, 'NGN')}</Text>
                </View>
              ))}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(amountNGN, 'NGN')}</Text>
              </View>
            </View>
          )}

          {/* Payer email */}
          {!emailReady ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Email</Text>
              <Text style={styles.emailNote}>
                Enter your email to receive the Paystack payment receipt.
              </Text>
              <View style={styles.emailRow}>
                <User size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.emailInput}
                  value={payerEmail}
                  onChangeText={setPayerEmail}
                  placeholder="your@email.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <Pressable
                style={[styles.continueBtn, !payerEmail.includes('@') && { opacity: 0.5 }]}
                onPress={() => setEmailReady(true)}
                disabled={!payerEmail.includes('@')}
              >
                <Text style={styles.continueBtnText}>Continue to Payment</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ready to Pay</Text>
              <Text style={styles.readyAmount}>{formatCurrency(amountNGN, 'NGN')}</Text>
              <Text style={styles.readySub}>via Paystack · {payerEmail}</Text>

              <Pressable
                style={[styles.payBtn, (Platform.OS === 'web' && !webScriptReady) && { opacity: 0.6 }]}
                onPress={Platform.OS === 'web' ? handleWebPayment : () => setShowPaystack(true)}
                disabled={processing || (Platform.OS === 'web' && !webScriptReady)}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" />
                ) : Platform.OS === 'web' && !webScriptReady ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <CreditCard size={20} color="#FFF" />
                    <Text style={styles.payBtnText}>Pay Now</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => setEmailReady(false)} style={styles.changeEmail}>
                <Text style={styles.changeEmailText}>Change email</Text>
              </Pressable>
            </View>
          )}

          {/* Expiry note */}
          {linkData?.expires_at && (
            <Text style={styles.expiryNote}>
              Link expires {new Date(linkData.expires_at).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Paystack modal - native app only (web uses PaystackPop directly) */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={showPaystack}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handlePaystackCancel}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Payment</Text>
              <Pressable style={styles.modalClose} onPress={handlePaystackCancel}>
                <X size={22} color="#1F2937" />
              </Pressable>
            </View>
            <PaystackPayment
              email={payerEmail}
              amount={amountNGN}
              publicKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || ''}
              customerName={payerEmail}
              onSuccess={handlePaystackSuccess}
              onCancel={handlePaystackCancel}
            />
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280' },
  errorTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937', marginTop: 16, marginBottom: 8 },
  errorSub: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  successTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#10B981', marginTop: 16, marginBottom: 8 },
  successSub: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },

  content: { padding: 20, paddingBottom: 48 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 14 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#1F2937' },
  itemMeta: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 2 },
  itemNote: { fontSize: 12, fontFamily: 'Inter-Medium', color: BRAND.purple, lineHeight: 17, marginTop: 4 },
  itemQty: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#6B7280', width: 28, textAlign: 'center' },
  itemPrice: { fontSize: 14, fontFamily: 'Inter-Bold', color: BRAND.purple, width: 80, textAlign: 'right' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1F2937' },
  totalValue: { fontSize: 16, fontFamily: 'Inter-Bold', color: BRAND.purple },

  emailNote: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', marginBottom: 14, lineHeight: 20 },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  emailInput: { flex: 1, fontSize: 15, fontFamily: 'Inter-Regular', color: '#1F2937' },
  continueBtn: {
    backgroundColor: BRAND.purple,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueBtnText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#FFF' },

  readyAmount: { fontSize: 28, fontFamily: 'Inter-Bold', color: BRAND.purple, marginBottom: 4 },
  readySub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginBottom: 20 },
  payBtn: {
    backgroundColor: '#5A2D82',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  payBtnText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  changeEmail: { alignItems: 'center', paddingVertical: 8 },
  changeEmailText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9CA3AF' },

  expiryNote: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', textAlign: 'center', marginTop: 8 },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  modalClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
});
