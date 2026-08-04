import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import type { OutfitWithProducts } from '@/types/outfit';

const BRAND_GOLD = '#FDB813';

interface LookCardProps {
  look: OutfitWithProducts;
  onPress: () => void;
  variant?: 'carousel' | 'grid';
  width?: number; // carousel slide width; grid ignores (fills its column)
  ownedInfo?: { owned: number; total: number }; // "from your wardrobe" badge
}

// Editorial "magazine cover" card: a tall lifestyle photo with the occasion
// eyebrow, edit title and a one-line description set over a dark gradient.
export default function LookCard({ look, onPress, variant = 'grid', width, ownedInfo }: LookCardProps) {
  const cover = look.cover_image || look.products[0]?.image_url;
  const isCarousel = variant === 'carousel';
  const ownsAll = !!ownedInfo && ownedInfo.total > 0 && ownedInfo.owned >= ownedInfo.total;
  const ownsSome = !!ownedInfo && ownedInfo.owned > 0 && !ownsAll;

  return (
    <Pressable
      style={[styles.card, isCarousel && width ? { width } : styles.gridCard]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${look.title} fit`}
    >
      <View style={styles.imageWrap}>
        {!!cover && (
          <Image
            source={{ uri: optimizeImageUrl(cover, { width: isCarousel ? 800 : 600 }) as string }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        {(ownsAll || ownsSome) && (
          <View style={[styles.ownBadge, ownsAll && styles.ownBadgeAll]}>
            {ownsAll && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
            <Text style={styles.ownBadgeText}>{ownsAll ? 'You own this' : `Own ${ownedInfo!.owned}/${ownedInfo!.total}`}</Text>
          </View>
        )}
        <View style={styles.overlay}>
          <Text style={styles.eyebrow}>{look.occasion?.toUpperCase()}</Text>
          <Text style={[styles.title, isCarousel && styles.titleLg]} numberOfLines={2}>{look.title}</Text>
          {!!look.subtitle && (
            <Text style={styles.subtitle} numberOfLines={2}>{look.subtitle}</Text>
          )}
          <View style={styles.ctaRow}>
            <Text style={styles.cta}>Shop this fit</Text>
            <ArrowRight size={15} color={BRAND_GOLD} strokeWidth={2.5} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#17131C' },
  gridCard: { width: '100%' },
  imageWrap: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#EDEAF0' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter-Bold', color: BRAND_GOLD, letterSpacing: 1.6, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  titleLg: { fontSize: 23 },
  subtitle: { fontSize: 13, fontFamily: 'Inter-Regular', color: 'rgba(255,255,255,0.82)', marginTop: 4, lineHeight: 18 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  cta: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  ownBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(23,19,28,0.82)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ownBadgeAll: { backgroundColor: 'rgba(5,150,105,0.92)' },
  ownBadgeText: { color: '#FFFFFF', fontFamily: 'Inter-Bold', fontSize: 10.5 },
});
