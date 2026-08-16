import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, CheckCircle, ImagePlus, X } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { pickAndUploadImage } from '@/lib/uploadImage';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

const QUANTITY_OPTIONS = ['20 - 50', '50 - 100', '100+'];

const CATALOG_ITEMS = [
  { name: 'Premium Heavyweight Tee', blurb: 'Custom-printed or embroidered' },
  { name: 'Custom Hoodie', blurb: 'Screen print or embroidery' },
  { name: 'Branded Cap', blurb: 'Embroidered logo' },
  { name: 'Tote Bag', blurb: 'Great for onboarding kits' },
];

export default function CorporateScreen() {
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [quantity, setQuantity] = useState('');
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
    if (!quantity) {
      Alert.alert('Estimated quantity required', 'Please select an estimated quantity so we can scope pricing.');
      return;
    }

    setSubmitting(true);
    try {
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
          product_interest: productInterest.trim() || null,
          estimated_quantity: quantity,
          needed_by: neededBy.trim() || null,
          logo_url: logoUrl,
          notes: notes.trim() || null,
          user_id: user?.id || null,
        });

      if (error) throw error;

      // Best-effort admin notification - the request is already saved either way.
      supabase.functions.invoke('notify-quote-request', {
        body: { quoteRequestId },
      }).catch((notifyError) => console.error('Quote notification failed:', notifyError));

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
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Briefcase size={22} color={BRAND.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Dritchwear for Business</Text>
            <Text style={styles.headerSub}>Bulk & corporate branded merch</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            High-quality branded apparel for team onboarding, events, and conferences - handled with fixed lead times and volume pricing. Minimum order 20 pieces.
          </Text>

          <View style={styles.catalogRow}>
            {CATALOG_ITEMS.map((item) => (
              <View key={item.name} style={styles.catalogCard}>
                <Text style={styles.catalogName}>{item.name}</Text>
                <Text style={styles.catalogBlurb}>{item.blurb}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Request a Quote</Text>

            <Text style={styles.label}>Company Name *</Text>
            <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Your company" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Contact Person *</Text>
            <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Full name" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@company.com" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="08012345678" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />

            <Text style={styles.label}>What are you looking for?</Text>
            <TextInput style={styles.input} value={productInterest} onChangeText={setProductInterest} placeholder="e.g. Hoodies + caps for onboarding kits" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Estimated Quantity *</Text>
            <View style={styles.chipRow}>
              {QUANTITY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.chip, quantity === opt && styles.chipActive]}
                  onPress={() => setQuantity(opt)}
                >
                  <Text style={[styles.chipText, quantity === opt && styles.chipTextActive]}>{opt}</Text>
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

            <Text style={styles.label}>Notes</Text>
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

            <Pressable
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Request Quote</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F9FAFB' },
  successTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#10B981', marginTop: 16, marginBottom: 8 },
  successSub: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDE9F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },

  content: { padding: 20, paddingBottom: 48 },
  intro: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 21, marginBottom: 20 },

  catalogRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  catalogCard: {
    width: '47%', backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#EDE9F6',
  },
  catalogName: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 3 },
  catalogBlurb: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#9CA3AF', lineHeight: 16 },

  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cardTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 16 },

  label: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter-Regular', color: '#1F2937',
  },
  multiline: { minHeight: 90 },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF',
  },
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
