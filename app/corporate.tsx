import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Briefcase, CheckCircle, ImagePlus, X, Package,
  ClipboardList, Search, FileCheck, Factory, Truck, ShieldCheck,
} from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { pickAndUploadImage } from '@/lib/uploadImage';
import { smartBack } from '@/lib/navigation';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

const QUANTITY_OPTIONS = ['20 - 50', '50 - 100', '100+'];
const BRANDING_OPTIONS = ['Screen Print', 'Embroidery', 'Not sure yet'];

const WHY_DRITCHWEAR = [
  '20-piece minimum, no smaller runs',
  'Volume pricing that drops as quantity grows',
  'Screen printing & embroidery in-house',
  'Logo/specification review before production',
  'Fixed production lead times',
  'Live order tracking',
  'Dedicated corporate/event support',
  'A real portfolio of past projects',
];

const PROCESS_STEPS = [
  { n: '01', icon: ClipboardList, title: 'Tell us what you need', body: 'Products, quantity, branding and deadline.' },
  { n: '02', icon: Search, title: 'We review your specifications', body: 'Upload your logo and requirements.' },
  { n: '03', icon: FileCheck, title: 'Receive your quote', body: 'We confirm volume pricing and production lead time.' },
  { n: '04', icon: Factory, title: 'Approve production', body: 'We produce and prepare your order.' },
  { n: '05', icon: Truck, title: 'Receive your merchandise', body: 'Delivery coordinated around your deadline.' },
];

interface B2BProduct {
  id: string;
  name: string;
  photo_url: string | null;
  colors: string[];
  sizes: string[];
  fabric_spec: string | null;
  min_qty: number;
  price_20_49: number | null;
  price_50_99: number | null;
  price_100_plus: number | null;
  branding_note: string | null;
}

interface B2BPackage {
  id: string;
  name: string;
  description: string | null;
  price_per_person: number | null;
}

interface PastWorkItem {
  id: string;
  title: string;
  client_name: string | null;
  media_urls: { url: string; type: 'image' | 'video'; posterUrl?: string }[];
}

function formatNaira(n: number | null): string {
  return n == null ? '-' : `₦${n.toLocaleString('en-NG')}`;
}

export default function CorporateScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isDesktop, isWideDesktop } = useDesktopLayout();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});

  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [packages, setPackages] = useState<B2BPackage[]>([]);
  const [pastWork, setPastWork] = useState<PastWorkItem[]>([]);

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [quantity, setQuantity] = useState('');
  const [brandingType, setBrandingType] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [notes, setNotes] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: pk }, { data: pw }] = await Promise.all([
        supabase.from('b2b_products').select('*').order('sort_order', { ascending: true }),
        supabase.from('b2b_packages').select('*').order('sort_order', { ascending: true }),
        supabase.from('portfolio_items').select('id, title, client_name, media_urls')
          .order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(4),
      ]);
      setProducts((p || []) as B2BProduct[]);
      setPackages((pk || []) as B2BPackage[]);
      setPastWork((pw || []) as PastWorkItem[]);
    })();
  }, []);

  const scrollToSection = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

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
          branding_type: brandingType || null,
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
        <Pressable style={styles.backToShopBtn} onPress={() => smartBack(router, '/(customer)/shop')}>
          <Text style={styles.backToShopBtnText}>Back to Shop</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.headerInner, isDesktop && styles.headerInnerDesktop]}>
            <Pressable
              style={styles.backButton}
              onPress={() => smartBack(router, '/(customer)/shop')}
              accessibilityRole="button"
              accessibilityLabel="Back to shop"
            >
              <ArrowLeft size={20} color={BRAND.purple} />
            </Pressable>
            <View style={styles.headerIcon}>
              <Briefcase size={22} color={BRAND.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Dritchwear for Business</Text>
              <Text style={styles.headerSub}>Corporate & event merchandise</Text>
            </View>
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={isDesktop && styles.heroRow}>
            <View style={isDesktop && styles.heroCol}>
              <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]}>Branded Merchandise for Teams, Companies & Events</Text>
              <Text style={[styles.heroSub, isDesktop && styles.heroSubDesktop]}>
                Premium apparel and branded merchandise for companies, tech teams and events - produced to your specifications, with clear pricing, volume discounts, and reliable lead times.
              </Text>
              <Text style={styles.heroMoq}>Minimum order: 20 pieces</Text>

              <View style={styles.heroActions}>
                <Pressable style={styles.heroPrimaryBtn} onPress={() => scrollToSection('products')}>
                  <Text style={styles.heroPrimaryBtnText}>View Products & Prices</Text>
                </Pressable>
                <Pressable style={styles.heroSecondaryBtn} onPress={() => scrollToSection('quote')}>
                  <Text style={styles.heroSecondaryBtnText}>Request a Quote</Text>
                </Pressable>
              </View>
            </View>

            {isDesktop && (
              <View style={styles.heroFactsCard}>
                <Text style={styles.heroFactsTitle}>At a glance</Text>
                {[
                  ['Minimum order', '20 pieces'],
                  ['Branding', 'Screen print & embroidery'],
                  ['Lead time', 'Fixed, confirmed at quote'],
                  ['Tracking', 'Live order status'],
                ].map(([label, value]) => (
                  <View key={label} style={styles.heroFactRow}>
                    <Text style={styles.heroFactLabel}>{label}</Text>
                    <Text style={styles.heroFactValue}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Products & Pricing */}
          <View onLayout={(e) => { sectionY.current.products = e.nativeEvent.layout.y; }}>
            <Text style={styles.sectionTitle}>Products & Pricing</Text>
            <Text style={styles.sectionSub}>Garment prices below. Branding (logo/print) is quoted separately based on complexity - see the note on each product.</Text>

            {products.length === 0 ? (
              <Text style={styles.emptySection}>Our full price list is being finalised - request a quote below and we'll send pricing directly.</Text>
            ) : (
              <View style={isDesktop && styles.productGrid}>
                {products.map((item) => (
                  <View key={item.id} style={[styles.productCard, isDesktop && styles.productCardDesktop, isWideDesktop && styles.productCardWide]}>
                    {item.photo_url && <Image source={{ uri: item.photo_url }} style={[styles.productPhoto, isDesktop && styles.productPhotoDesktop]} resizeMode="cover" />}
                    <View style={styles.productBody}>
                      <Text style={styles.productName}>{item.name}</Text>
                      {(item.colors.length > 0 || item.sizes.length > 0) && (
                        <Text style={styles.productSpec}>
                          {item.colors.length > 0 ? item.colors.join(', ') : ''}
                          {item.colors.length > 0 && item.sizes.length > 0 ? ' · ' : ''}
                          {item.sizes.length > 0 ? `Sizes ${item.sizes.join(', ')}` : ''}
                        </Text>
                      )}
                      {item.fabric_spec ? <Text style={styles.productSpec}>{item.fabric_spec}</Text> : null}
                      <Text style={styles.productMoq}>Min {item.min_qty} pieces</Text>

                      <View style={styles.priceLadder}>
                        <View style={styles.priceRow}><Text style={styles.priceRange}>20-49</Text><Text style={styles.priceValue}>{formatNaira(item.price_20_49)}</Text></View>
                        <View style={styles.priceRow}><Text style={styles.priceRange}>50-99</Text><Text style={styles.priceValue}>{formatNaira(item.price_50_99)}</Text></View>
                        <View style={styles.priceRow}><Text style={styles.priceRange}>100+</Text><Text style={styles.priceValue}>{formatNaira(item.price_100_plus)}</Text></View>
                      </View>

                      {item.branding_note ? <Text style={styles.brandingNote}>* {item.branding_note}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Pressable style={styles.portfolioLink} onPress={() => router.push('/portfolio' as any)}>
              <Text style={styles.portfolioLinkText}>See Examples of Our Past Work →</Text>
            </Pressable>
          </View>

          {/* Event Packages */}
          {packages.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Event Packages</Text>
              <Text style={styles.sectionSub}>Bundled sets priced per person - easier to budget for a full attendee list.</Text>
              <View style={isDesktop && styles.packageGrid}>
                {packages.map((pkg) => (
                  <View key={pkg.id} style={[styles.packageCard, isDesktop && styles.packageCardDesktop]}>
                    <View style={styles.packageIcon}><Package size={18} color={BRAND.purple} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packageName}>{pkg.name}</Text>
                      {pkg.description ? <Text style={styles.packageDesc}>{pkg.description}</Text> : null}
                    </View>
                    <Text style={styles.packagePrice}>{formatNaira(pkg.price_per_person)}<Text style={styles.packagePriceUnit}>/person</Text></Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Process */}
          <Text style={styles.sectionTitle}>Our Process</Text>
          <View style={isDesktop && styles.processRowDesktop}>
            {PROCESS_STEPS.map((step) => (
              <View key={step.n} style={[styles.stepRow, isDesktop && styles.stepColDesktop]}>
                <View style={styles.stepIconWrap}>
                  <step.icon size={16} color={BRAND.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{step.n} - {step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Why Dritchwear */}
          <Text style={styles.sectionTitle}>Why Dritchwear</Text>
          <Text style={styles.sectionSub}>Built for real business orders.</Text>
          <View style={[styles.whyGrid, isDesktop && styles.whyGridDesktop]}>
            {WHY_DRITCHWEAR.map((point) => (
              <View key={point} style={[styles.whyRow, isDesktop && styles.whyRowDesktop]}>
                <ShieldCheck size={14} color={BRAND.gold} />
                <Text style={styles.whyText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* Past work */}
          {pastWork.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Past Work</Text>
              {isDesktop ? (
                <View style={styles.pastWorkGridDesktop}>
                  {pastWork.map((item) => {
                    const thumb = item.media_urls?.[0];
                    const thumbUri = thumb?.type === 'image' ? thumb.url : thumb?.posterUrl;
                    return (
                      <Pressable key={item.id} style={styles.pastWorkCardDesktop} onPress={() => router.push('/portfolio' as any)}>
                        {thumbUri ? (
                          <Image source={{ uri: thumbUri }} style={styles.pastWorkPhotoDesktop} resizeMode="cover" />
                        ) : (
                          <View style={[styles.pastWorkPhotoDesktop, styles.pastWorkPhotoPlaceholder]} />
                        )}
                        <Text style={styles.pastWorkTitle} numberOfLines={2}>{item.title}</Text>
                        {item.client_name ? <Text style={styles.pastWorkClient}>{item.client_name}</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={styles.pastWorkRow}>
                  {pastWork.map((item) => {
                    const thumb = item.media_urls?.[0];
                    const thumbUri = thumb?.type === 'image' ? thumb.url : thumb?.posterUrl;
                    return (
                      <Pressable key={item.id} style={styles.pastWorkCard} onPress={() => router.push('/portfolio' as any)}>
                        {thumbUri ? (
                          <Image source={{ uri: thumbUri }} style={styles.pastWorkPhoto} resizeMode="cover" />
                        ) : (
                          <View style={[styles.pastWorkPhoto, styles.pastWorkPhotoPlaceholder]} />
                        )}
                        <Text style={styles.pastWorkTitle} numberOfLines={2}>{item.title}</Text>
                        {item.client_name ? <Text style={styles.pastWorkClient}>{item.client_name}</Text> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              <Pressable style={styles.portfolioLink} onPress={() => router.push('/portfolio' as any)}>
                <Text style={styles.portfolioLinkText}>See All Past Work →</Text>
              </Pressable>
            </View>
          )}

          {/* Quote form */}
          <View onLayout={(e) => { sectionY.current.quote = e.nativeEvent.layout.y; }} style={[styles.card, isDesktop && styles.cardDesktop]}>
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

            <Text style={styles.label}>Branding Type</Text>
            <View style={styles.chipRow}>
              {BRANDING_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.chip, brandingType === opt && styles.chipActive]}
                  onPress={() => setBrandingType(opt)}
                >
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

            <Pressable
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Get My Quote</Text>}
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
  backToShopBtn: { marginTop: 24, backgroundColor: BRAND.purple, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  backToShopBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter-Bold' },

  header: {
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInnerDesktop: { maxWidth: 1120, alignSelf: 'center', width: '100%', paddingHorizontal: 20 },
  backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDE9F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },

  content: { padding: 20, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 40, paddingTop: 32, maxWidth: 1120, alignSelf: 'center', width: '100%' },

  heroRow: { flexDirection: 'row', gap: 32, alignItems: 'flex-start' },
  heroCol: { flex: 1.3 },
  heroTitle: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#17131C', lineHeight: 31, marginBottom: 10 },
  heroTitleDesktop: { fontSize: 40, lineHeight: 48, marginBottom: 16 },
  heroSub: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 21, marginBottom: 12 },
  heroSubDesktop: { fontSize: 16, lineHeight: 25, marginBottom: 16, maxWidth: 480 },
  heroMoq: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: BRAND.purple, marginBottom: 20 },
  heroActions: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  heroPrimaryBtn: { flex: 1, backgroundColor: BRAND.purple, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  heroPrimaryBtnText: { color: '#FFF', fontSize: 13.5, fontFamily: 'Inter-Bold' },
  heroSecondaryBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: BRAND.purple, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  heroSecondaryBtnText: { color: BRAND.purple, fontSize: 13.5, fontFamily: 'Inter-Bold' },
  heroFactsCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#EDE9F6', padding: 24, marginTop: 4 },
  heroFactsTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  heroFactRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  heroFactLabel: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280' },
  heroFactValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#17131C', textAlign: 'right' },

  sectionTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C', marginTop: 8, marginBottom: 6 },
  sectionSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 19, marginBottom: 16 },
  emptySection: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9CA3AF', lineHeight: 19, marginBottom: 16 },

  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  productCard: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EDE9F6' },
  productCardDesktop: { flexDirection: 'column', width: '48%', marginBottom: 0 },
  productCardWide: { width: '31.5%' },
  productPhoto: { width: 76, height: 76, borderRadius: 12, backgroundColor: '#F3F4F6' },
  productPhotoDesktop: { width: '100%', height: 160, marginBottom: 12 },
  productBody: { flex: 1 },
  productName: { fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 3 },
  productSpec: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#9CA3AF', lineHeight: 16 },
  productMoq: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: BRAND.purple, marginTop: 4, marginBottom: 8 },
  priceLadder: { flexDirection: 'row', gap: 14 },
  priceRow: { alignItems: 'flex-start' },
  priceRange: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#9CA3AF' },
  priceValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#17131C', marginTop: 1 },
  brandingNote: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 8, lineHeight: 15 },

  portfolioLink: { alignItems: 'center', paddingVertical: 10, marginBottom: 8 },
  portfolioLinkText: { fontSize: 14, fontFamily: 'Inter-Bold', color: BRAND.purple },

  packageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  packageCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EDE9F6' },
  packageCardDesktop: { width: '48%', marginBottom: 0 },
  packageIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  packageName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1F2937' },
  packageDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 2 },
  packagePrice: { fontSize: 14, fontFamily: 'Inter-Bold', color: BRAND.purple },
  packagePriceUnit: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#9CA3AF' },

  processRowDesktop: { flexDirection: 'row', gap: 16 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  stepColDesktop: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 10, marginBottom: 0 },
  stepIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 2 },
  stepBody: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 18 },

  whyGrid: { gap: 10, marginBottom: 8 },
  whyGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 12 },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whyRowDesktop: { width: '46%' },
  whyText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#374151' },

  pastWorkRow: { paddingHorizontal: 20, gap: 12 },
  pastWorkCard: { width: 130 },
  pastWorkPhoto: { width: 130, height: 130, borderRadius: 12, backgroundColor: '#F3F4F6' },
  pastWorkPhotoPlaceholder: { backgroundColor: '#374151' },
  pastWorkTitle: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#1F2937', marginTop: 6, lineHeight: 16 },
  pastWorkClient: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 1 },
  pastWorkGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  pastWorkCardDesktop: { width: '23%' },
  pastWorkPhotoDesktop: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#F3F4F6' },

  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginTop: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cardDesktop: { maxWidth: 640, alignSelf: 'center', width: '100%', padding: 32, marginTop: 40 },
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
