import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Clock3, Package, MessageSquare, BadgeCheck, CheckCircle2, AlertCircle } from 'lucide-react-native';

const P = '#5A2D82';
const G = '#FDB813';

function PolicyCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <View style={s.policyCard}>
      <View style={s.policyIcon}>{icon}</View>
      <Text style={s.policyTitle}>{title}</Text>
      <Text style={s.policyText}>{text}</Text>
    </View>
  );
}

function StepItem({ step, title, text }: { step: number; title: string; text: string }) {
  return (
    <View style={s.stepItem}>
      <View style={s.stepCircle}><Text style={s.stepNum}>{step}</Text></View>
      <Text style={s.stepTitle}>{title}</Text>
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

function ConditionRow({ text, good }: { text: string; good: boolean }) {
  return (
    <View style={s.condRow}>
      <View style={[s.condDot, { backgroundColor: good ? '#10B981' : '#EF4444' }]} />
      <Text style={s.condText}>{text}</Text>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderTitle}>{title}</Text>
      <Text style={s.sectionHeaderSub}>{subtitle}</Text>
    </View>
  );
}

// Single source of truth for the returns policy, shared by the Returns screen
// and the in-product returns modal.
export default function ReturnsBody() {
  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Returns & <Text style={{ color: G }}>Exchanges</Text></Text>
      <Text style={s.pageSubtitle}>Simple, honest, and clear - here's how returns and exchanges work at Dritchwear.</Text>

      <View style={s.policyGrid}>
        <PolicyCard icon={<Clock3 size={22} color={P} />} title="2-Day Window" text="You must send the item back within 2 days of receiving it. As long as you've dropped off or arranged pickup within this window, your return is valid." />
        <PolicyCard icon={<Package size={22} color={P} />} title="Customer Pays Shipping" text="Customers are responsible for return shipping costs. We recommend using a trackable shipping method." />
        <PolicyCard icon={<MessageSquare size={22} color={P} />} title="Contact Us First" text="Send us a message through our contact form or mobile app to initiate the return process." />
        <PolicyCard icon={<BadgeCheck size={22} color={P} />} title="Quality Guarantee" text="If there's a quality issue with your item, we'll replace it or provide a full refund within the return window." />
      </View>

      <SectionHeader title="How to Return Items" subtitle="Follow these simple steps to return or exchange your Dritchwear items." />
      <View style={s.stepsRow}>
        <StepItem step={1} title="Contact Us" text="Send us a message within 2 days of receiving your order. Include your order number and reason for return." />
        <StepItem step={2} title="Package Items" text="Pack items in original packaging with tags attached. Include the return authorisation number and your order details." />
        <StepItem step={3} title="Ship & Track" text="Ship your package to our Nigeria address using a trackable method. You'll cover the return shipping cost." />
      </View>

      <SectionHeader title="Return Conditions" subtitle="Please review these requirements to ensure a smooth return process." />
      <View style={s.conditionsGrid}>
        <View style={s.condCard}>
          <View style={s.condCardHeader}><CheckCircle2 size={20} color="#10B981" /><Text style={s.condCardTitle}>Eligible for Return</Text></View>
          {['Items in original condition with tags attached', 'Unworn, unwashed, and undamaged items', 'Items returned within 2 days of delivery', 'Items in original packaging when possible', 'Return authorisation obtained from customer service'].map(t => <ConditionRow key={t} text={t} good />)}
        </View>
        <View style={s.condCard}>
          <View style={s.condCardHeader}><AlertCircle size={20} color="#EF4444" /><Text style={s.condCardTitle}>Not Eligible for Return</Text></View>
          {['Items returned after 2 days of delivery', 'Personalised or customised items', 'Undergarments and swimwear (for hygiene reasons)', 'Items damaged by normal wear and tear', 'Items without return authorisation'].map(t => <ConditionRow key={t} text={t} good={false} />)}
        </View>
      </View>

      <SectionHeader title="Refund Information" subtitle="Understanding how and when you'll receive your refund." />
      <View style={s.card}>
        <Text style={s.cardTitle}>Refund Timeline</Text>
        {[
          { badge: '1–2', title: 'Business Days', text: 'Processing time once we receive your return in Nigeria' },
          { badge: '3–5', title: 'Business Days', text: 'Refund appears in your original payment method' },
          { badge: '24h', title: 'Store Credit', text: 'Instant store credit option available' },
        ].map(item => (
          <View key={item.badge} style={s.timelineItem}>
            <View style={s.timelineBadge}><Text style={s.timelineBadgeText}>{item.badge}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.timelineTitle}>{item.title}</Text>
              <Text style={s.timelineText}>{item.text}</Text>
            </View>
          </View>
        ))}
        <View style={s.divider} />
        <Text style={s.cardTitle}>Important Notes</Text>
        {[
          { title: 'Return Shipping', body: 'Customers cover the cost of return shipping to our Nigeria location. We recommend using a trackable service.' },
          { title: '2-Day Limit', body: 'Items are no longer eligible for return after 2 days of receiving your order. Contact us immediately if you need to return.' },
          { title: 'Contact Required', body: 'All returns must be initiated by contacting our customer service team first for authorisation.' },
        ].map(n => (
          <View key={n.title} style={s.noteCard}>
            <Text style={s.noteTitle}>{n.title}</Text>
            <Text style={s.noteText}>{n.body}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Our Operations" subtitle="Information about our operations and shipping." />
      <View style={s.card}>
        <View style={s.opsGrid}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Shipping Information</Text>
            {['Standard shipping: 3–5 business days within Nigeria', 'Express shipping: 1–2 business days available', 'Overnight shipping option available', 'International shipping: 7–14 business days'].map(t => (
              <View key={t} style={s.opRow}><View style={s.opDot} /><Text style={s.opText}>{t}</Text></View>
            ))}
            <View style={s.giglNotice}>
              <Text style={s.giglNoticeText}>
                Orders outside Lagos are shipped via <Text style={s.giglNoticeBold}>God Is Good Logistics (GIGL)</Text>. Delivery availability depends on GIGL's service coverage - where doorstep delivery isn't available, you'll need to collect your order from the nearest GIGL office. We currently ship only to destinations supported by GIGL.
              </Text>
            </View>
            <View style={s.giglNotice}>
              <Text style={s.giglNoticeText}>
                We're also currently unable to deliver to a few far-out Lagos areas: <Text style={s.giglNoticeBold}>Badagry</Text>, <Text style={s.giglNoticeBold}>Epe and areas past Awoyaya</Text>, <Text style={s.giglNoticeBold}>deep Ikorodu</Text> (Owutu, Igbogbo, Ijede), <Text style={s.giglNoticeBold}>Okokomaiko / Ojo / Trade Fair</Text>, and <Text style={s.giglNoticeBold}>Agbara</Text>. If you're in one of these areas, please contact us before ordering.
              </Text>
            </View>
          </View>
          <View style={s.opsDivider} />
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Return Process</Text>
            {['Contact us within 2 days of delivery', 'Customer pays return shipping to Nigeria', 'Use trackable shipping method', 'Refund processed after we receive items'].map(t => (
              <View key={t} style={s.opRow}><View style={s.opDot} /><Text style={s.opText}>{t}</Text></View>
            ))}
          </View>
        </View>
        <Text style={s.opsFooter}>Need help with your return? Our customer service team is here to assist.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  pageSubtitle: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  sectionHeader: { marginTop: 24, marginBottom: 14, alignItems: 'center' },
  sectionHeaderTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937', textAlign: 'center' },
  sectionHeaderSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', marginTop: 4 },
  policyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  policyCard: { width: '47.5%', backgroundColor: '#FFF', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  policyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  policyTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4, textAlign: 'center' },
  policyText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 16 },
  stepsRow: { gap: 12, marginBottom: 8 },
  stepItem: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  stepCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: P, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  stepNum: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#FFF' },
  stepTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 6, textAlign: 'center' },
  stepText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  conditionsGrid: { gap: 12, marginBottom: 8 },
  condCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  condCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  condCardTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1F2937' },
  condRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  condDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  condText: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 19 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 14 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  timelineBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  timelineBadgeText: { fontSize: 11, fontFamily: 'Inter-Bold', color: P, textAlign: 'center' },
  timelineTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1F2937' },
  timelineText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2, lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },
  noteCard: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 10 },
  noteTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1F2937', marginBottom: 4 },
  noteText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 18 },
  opsGrid: { flexDirection: 'row', gap: 16 },
  opsDivider: { width: 1, backgroundColor: '#F3F4F6' },
  opRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  opDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P, marginTop: 7 },
  opText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 18 },
  opsFooter: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center' },
  giglNotice: { marginTop: 12, padding: 10, backgroundColor: '#F3EFF7', borderRadius: 10, borderWidth: 1, borderColor: '#DDD3EC' },
  giglNoticeText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#4B3A63', lineHeight: 17 },
  giglNoticeBold: { fontFamily: 'Inter-Bold', color: '#3B1F57' },
});
