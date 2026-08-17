import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, ImagePlus, X, Trash2, Package } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { pickAndUploadImage } from '@/lib/uploadImage';
import { smartBack } from '@/lib/navigation';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useQuoteBasket } from '@/contexts/QuoteBasketContext';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

const QUANTITY_OPTIONS = ['10 - 50', '50 - 100', '100+'];
const BRANDING_OPTIONS = ['Screen Print', 'Embroidery', 'Not sure yet'];

export default function CorporateQuoteScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isDesktop } = useDesktopLayout();
  const { items: basketItems, updateQuantity, removeItem, clear: clearBasket } = useQuoteBasket();

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [quantity, setQuantity] = useState('');
  const [brandingType, setBrandingType] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [notes, setNotes] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const uploadLogo = async () => {
    setUploadingLogo(true);
    const url = await pickAndUploadImage('corporate-quotes');
    setUploadingLogo(false);
    if (url) setLogoUrl(url);
  };

  const handleSubmit = async () => {
    if (!companyName.trim() || !contactName.trim() || !email.trim()) {
      Alert.alert('Missing details', 'Please fill in your company name, contact name, and email.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (basketItems.length === 0 && !quantity) {
      Alert.alert('Estimated quantity required', 'Add products above, or select an estimated quantity below.');
      return;
    }

    setSubmitting(true);
    try {
      const basketSummary = basketItems.map((i) => `${i.productName} - ${i.quantity} ${i.type === 'package' ? 'people' : 'pieces'}`).join('; ');
      const totalBasketQty = basketItems.reduce((sum, i) => sum + i.quantity, 0);

      // Generated client-side so we know the id without needing the insert to
      // return the row - an anonymous submitter (no account, user_id null)
      // has no SELECT policy that would let them read their own row back,
      // since `auth.uid() = user_id` is never true when both sides are null.
      // Asking Postgres to RETURN the row would fail RLS even though the
      // insert itself is allowed.
      const quoteRequestId = Crypto.randomUUID();
      const { error } = await supabase
        .from('quote_requests')
        .insert({
          id: quoteRequestId,
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          delivery_address: deliveryAddress.trim() || null,
          product_interest: basketSummary || productInterest.trim() || null,
          estimated_quantity: quantity || (totalBasketQty ? `${totalBasketQty} pieces (from basket)` : ''),
          branding_type: brandingType || null,
          needed_by: neededBy.trim() || null,
          logo_url: logoUrl,
          notes: notes.trim() || null,
          user_id: user?.id || null,
          selected_items: basketItems.length > 0 ? basketItems : null,
        });

      if (error) throw error;

      // Best-effort admin notification - the request is already saved either way.
      supabase.functions.invoke('notify-quote-request', {
        body: { quoteRequestId },
      }).catch((notifyError) => console.error('Quote notification failed:', notifyError));

      await clearBasket();
      setSubmitted(true);
    } catch (error: any) {
      Alert.alert('Could not submit', error.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.centered}>
        <CheckCircle size={56} color="#10B981" />
        <Text style={styles.successTitle}>Request received!</Text>
        <Text style={styles.successSub}>
          Thanks for reaching out. Our team will review your request and follow up by email within 1-2 business days with pricing and next steps.
        </Text>
        <Pressable style={styles.backToShopBtn} onPress={() => smartBack(router, '/(customer)/shop')}>
          <Text style={styles.backToShopBtnText}>Back to Shop</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <View style={[styles.headerInner, isDesktop && styles.headerInnerDesktop]}>
            <Pressable style={styles.backButton} onPress={() => smartBack(router, '/corporate' as any)} accessibilityRole="button" accessibilityLabel="Back">
              <ArrowLeft size={20} color={BRAND.purple} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Request a Quote</Text>
              <Text style={styles.headerSub}>Tell us what you need - we'll follow up with pricing</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, isDesktop && styles.cardDesktop]}>
            {basketItems.length > 0 && (
              <>
                <Text style={styles.basketTitle}>Products Selected</Text>
                {basketItems.map((item) => (
                  <View key={item.productId} style={styles.basketRow}>
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={styles.basketThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.basketThumb, styles.basketThumbPlaceholder]}>
                        {item.type === 'package' && <Package size={18} color="#9CA3AF" />}
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.basketItemName}>{item.productName}</Text>
                      <View style={styles.basketItemQtyRow}>
                        <TextInput
                          style={styles.basketQtyInput}
                          value={String(item.quantity)}
                          onChangeText={(t) => updateQuantity(item.productId, Math.max(1, parseInt(t.replace(/[^0-9]/g, ''), 10) || 0))}
                          keyboardType="number-pad"
                          textAlign="center"
                        />
                        <Text style={styles.basketItemQty}>{item.type === 'package' ? 'people' : 'pieces'}</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => updateQuantity(item.productId, item.quantity - (item.type === 'package' ? 5 : 10))} style={styles.basketQtyBtn}>
                      <Text style={styles.basketQtyBtnText}>-</Text>
                    </Pressable>
                    <Pressable onPress={() => updateQuantity(item.productId, item.quantity + (item.type === 'package' ? 5 : 10))} style={styles.basketQtyBtn}>
                      <Text style={styles.basketQtyBtnText}>+</Text>
                    </Pressable>
                    <Pressable onPress={() => removeItem(item.productId)} style={styles.basketRemoveBtn} hitSlop={6}>
                      <Trash2 size={14} color="#EF4444" />
                    </Pressable>
                  </View>
                ))}
                <Pressable style={styles.addMoreLink} onPress={() => router.push('/corporate/products' as any)}>
                  <Text style={styles.addMoreLinkText}>+ Browse more products</Text>
                </Pressable>
                <View style={styles.divider} />
              </>
            )}

            <Text style={styles.cardTitle}>Your Details</Text>

            <Text style={styles.label}>Company Name *</Text>
            <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Your company" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Contact Person *</Text>
            <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Full name" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@company.com" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="08012345678" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />

            <Text style={styles.label}>Delivery Address</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder="Where should we deliver this order?"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            {basketItems.length === 0 && (
              <>
                <Text style={styles.label}>What are you looking for?</Text>
                <TextInput style={styles.input} value={productInterest} onChangeText={setProductInterest} placeholder="e.g. Hoodies + caps for onboarding kits" placeholderTextColor="#9CA3AF" />

                <Text style={styles.label}>Estimated Quantity *</Text>
                <View style={styles.chipRow}>
                  {QUANTITY_OPTIONS.map((opt) => (
                    <Pressable key={opt} style={[styles.chip, quantity === opt && styles.chipActive]} onPress={() => setQuantity(opt)}>
                      <Text style={[styles.chipText, quantity === opt && styles.chipTextActive]}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Branding Type</Text>
            <View style={styles.chipRow}>
              {BRANDING_OPTIONS.map((opt) => (
                <Pressable key={opt} style={[styles.chip, brandingType === opt && styles.chipActive]} onPress={() => setBrandingType(opt)}>
                  <Text style={[styles.chipText, brandingType === opt && styles.chipTextActive]}>{opt}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Needed By</Text>
            <TextInput style={styles.input} value={neededBy} onChangeText={setNeededBy} placeholder="e.g. December 2026" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Logo (optional)</Text>
            {logoUrl ? (
              <View style={styles.logoPreviewWrap}>
                <Image source={{ uri: logoUrl }} style={styles.logoPreview} resizeMode="contain" />
                <Pressable style={styles.logoRemove} onPress={() => setLogoUrl(null)} hitSlop={6}>
                  <X size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.logoUploadBtn} onPress={uploadLogo} disabled={uploadingLogo}>
                <ImagePlus size={18} color={BRAND.purple} />
                <Text style={styles.logoUploadText}>{uploadingLogo ? 'Uploading…' : 'Upload logo'}</Text>
              </Pressable>
            )}

            <Text style={styles.label}>Additional Requirements</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else we should know? Brand colours, placement, event date..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Pressable style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Get My Quote</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F9FAFB' },
  successTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#10B981', marginTop: 16, marginBottom: 8 },
  successSub: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  backToShopBtn: { marginTop: 24, backgroundColor: BRAND.purple, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  backToShopBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter-Bold' },

  header: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 20, paddingVertical: 16 },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInnerDesktop: { maxWidth: 1120, alignSelf: 'center', width: '100%' },
  backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerSub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },

  content: { padding: 20, paddingBottom: 48 },
  contentDesktop: { padding: 40, maxWidth: 1120, alignSelf: 'center', width: '100%' },

  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cardDesktop: { maxWidth: 640, alignSelf: 'center', width: '100%', padding: 32 },
  cardTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 16 },

  basketTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 12 },
  basketRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  basketThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#F3F4F6' },
  basketThumbPlaceholder: { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  basketItemName: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#1F2937' },
  basketItemQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  basketQtyInput: {
    fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1F2937', minWidth: 36,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 4,
  },
  basketItemQty: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280' },
  basketQtyBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  basketQtyBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: BRAND.purple },
  basketRemoveBtn: { padding: 4 },
  addMoreLink: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 4 },
  addMoreLinkText: { fontSize: 13, fontFamily: 'Inter-Bold', color: BRAND.purple },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 18 },

  label: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter-Regular', color: '#1F2937',
  },
  multiline: { minHeight: 90 },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF' },
  chipActive: { backgroundColor: BRAND.purple, borderColor: BRAND.purple },
  chipText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#4B5563' },
  chipTextActive: { color: '#FFF' },

  logoUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: BRAND.purple, borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 14,
  },
  logoUploadText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: BRAND.purple },
  logoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  logoPreview: { width: 100, height: 100, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  logoRemove: {
    position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },

  submitBtn: {
    backgroundColor: BRAND.purple, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 22,
  },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFF' },
});
