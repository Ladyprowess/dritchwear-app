/**
 * Pay-for-me Link Generator
 *
 * Lets a user generate a shareable payment link for items in their cart.
 * The link is stored in the `payment_links` table (see DB migration).
 * Anyone (even without the app) can open the link to pay on Paystack.
 *
 * Link format: https://dritchwear.com/pay/<token>
 * (You handle the web page separately; this screen just creates the record.)
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Share, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Share2, Link, Copy, Clock } from 'lucide-react-native';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import { calculateServiceFee } from '@/lib/fees';
import { buildPayLink } from '@/lib/pay-links';
import * as Clipboard from 'expo-clipboard';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

function generateToken(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export default function PayLinkScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { items: cartItems, appliedPromo } = useCart();

  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const userCurrency = profile?.preferred_currency || 'NGN';

  // Calculate subtotal in NGN (no delivery - address unknown at this stage)
  const subtotalNGN = (cartItems ?? []).reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0,
  );
  const discountNGN = (() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.type === 'free_delivery') return 0;
    if (appliedPromo.type === 'item_percentage' && appliedPromo.productId) {
      return (cartItems ?? []).reduce((sum: number, item: any) =>
        item.productId === appliedPromo.productId
          ? sum + item.price * item.quantity * appliedPromo.discount
          : sum, 0);
    }
    return subtotalNGN * appliedPromo.discount;
  })();
  const discountedNGN = subtotalNGN - discountNGN;
  // Subtotal + 2% service fee only - delivery is added when the recipient pays
  const serviceFeeNGN = calculateServiceFee(discountedNGN);
  const totalWithoutDelivery = Math.round((discountedNGN + serviceFeeNGN) * 100) / 100;

  const displayTotal = userCurrency === 'NGN'
    ? totalWithoutDelivery
    : convertFromNGN(totalWithoutDelivery, userCurrency);

  const handleGenerateLink = async () => {
    if (!user || !profile) {
      Alert.alert('Sign in to create a payment link', 'Sign in so the payment can be connected securely to your order.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/(auth)/welcome') },
      ]);
      return;
    }

    const items = (cartItems ?? []);
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart before generating a payment link.');
      return;
    }
    router.push({ pathname: '/(customer)/checkout', params: { cartData: JSON.stringify(items), paymentIntent: 'pay_for_me' } });
  };

  const handleShare = async () => {
    if (!generatedLink) return;
    try {
      await Share.share({
        message: `Hiya! Would you like to pay for my order on Dritchwear? 🥺\n\n${generatedLink}\n\nLink expires in 48 hours.`,
        url: generatedLink,
        title: 'Hiya! Would you like to pay for my order on Dritchwear? 🥺',
      });
    } catch (err) {
      Alert.alert('Could not open sharing', 'Copy the payment link instead, then send it through your preferred messaging app.');
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await Clipboard.setStringAsync(generatedLink);
    Alert.alert('Copied!', 'Payment link copied to clipboard.');
  };

  const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Pay-for-Me Link</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Explanation card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            Generate a secure payment link for your current cart. Share it with anyone - even people who don't have the app - and they can pay for your order via Paystack.{'\n\n'}
            The link expires in <Text style={{ fontFamily: 'Inter-Bold' }}>48 hours</Text>.
          </Text>
        </View>

        {/* Cart summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cart Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items</Text>
              <Text style={styles.summaryValue}>
                {(cartItems ?? []).reduce((s: number, i: any) => s + i.quantity, 0)} items
              </Text>
            </View>
            {appliedPromo && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Promo ({appliedPromo.code})</Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                  -{formatCurrency(convertFromNGN(discountNGN, userCurrency), userCurrency)}
                </Text>
              </View>
            )}
            {appliedPromo?.type === 'free_delivery' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>🚚 {appliedPromo.code}</Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>Free Delivery</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Subtotal + Service Fee</Text>
              <Text style={styles.totalValue}>{formatCurrency(displayTotal, userCurrency)}</Text>
            </View>
            <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter-Regular', marginTop: 6 }}>
              + Delivery fee (calculated at payment based on recipient's location)
            </Text>
          </View>
        </View>

        {/* Generated link */}
        {generatedLink ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Payment Link</Text>
            <View style={styles.linkCard}>
              <Link size={18} color={BRAND.purple} />
              <Text style={styles.linkText} numberOfLines={2} selectable>
                {generatedLink}
              </Text>
            </View>

            {expiresAt && (
              <View style={styles.expiryRow}>
                <Clock size={14} color="#6B7280" />
                <Text style={styles.expiryText}>
                  Expires: {formatExpiry(expiresAt)}
                </Text>
              </View>
            )}

            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <Share2 size={20} color="#FFF" />
              <Text style={styles.shareBtnText}>Share Link</Text>
            </Pressable>

            <Pressable style={styles.copyBtn} onPress={handleCopy}>
              <Copy size={18} color={BRAND.purple} />
              <Text style={styles.copyBtnText}>Copy Link</Text>
            </Pressable>

            <Pressable style={styles.newLinkBtn} onPress={() => setGeneratedLink(null)}>
              <Text style={styles.newLinkBtnText}>Generate New Link</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Pressable
              style={[styles.generateBtn, loading && { opacity: 0.7 }]}
              onPress={handleGenerateLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Link size={20} color="#FFF" />
                  <Text style={styles.generateBtnText}>Continue to Checkout</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.noteText}>
              Add the delivery details at checkout, then choose Pay for Me. The recipient does not need a Dritchwear account.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  content: { padding: 20, paddingBottom: 40 },
  infoCard: {
    backgroundColor: '#EDE9F6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.purple,
  },
  infoTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#3B1A6D', marginBottom: 8 },
  infoText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 22 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 12 },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#1F2937' },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1F2937' },
  totalValue: { fontSize: 16, fontFamily: 'Inter-Bold', color: BRAND.purple },
  linkCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 10,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: BRAND.purple,
    lineHeight: 20,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  expiryText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.purple,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 10,
  },
  shareBtnText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.purple,
  },
  copyBtnText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: BRAND.purple },
  newLinkBtn: { alignItems: 'center', paddingVertical: 12 },
  newLinkBtnText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textDecorationLine: 'underline' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.purple,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 14,
  },
  generateBtnText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  noteText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});
