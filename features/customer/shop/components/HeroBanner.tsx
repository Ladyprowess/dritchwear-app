import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Filter } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { HERO_SLIDES } from '../constants';
import { styles } from '../styles';

interface HeroBannerProps {
  onFilterPress: () => void;
  onCustomOrderPress: () => void;
  onStyleMePress: () => void;
}

export function HeroBanner({ onFilterPress, onCustomOrderPress, onStyleMePress }: HeroBannerProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const heroFade = useRef(new Animated.Value(1)).current;

  // Gently crossfade the hero photo every 5s.
  useEffect(() => {
    if (HERO_SLIDES.length < 2) return;
    const id = setInterval(() => {
      Animated.timing(heroFade, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => {
        setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
        Animated.timing(heroFade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.hero}>
      <Animated.Image
        source={{ uri: optimizeImageUrl(HERO_SLIDES[heroIndex].url, { width: 900 }) as string }}
        style={[HERO_SLIDES[heroIndex].variant === 'cutout' ? styles.heroImageCutout : styles.heroImage, { opacity: heroFade }]}
        resizeMode={HERO_SLIDES[heroIndex].variant === 'cutout' ? 'contain' : 'cover'}
      />
      <LinearGradient
        colors={['rgba(42,20,60,0.20)', 'rgba(42,20,60,0.62)', 'rgba(42,20,60,0.96)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.heroContent}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroEyebrow}>DRITCHWEAR ORIGINALS</Text>
          <Pressable
            accessibilityLabel="Filter products"
            style={styles.heroFilterButton}
            onPress={onFilterPress}
          >
            <Filter size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <View>
          <Text style={styles.heroTitle}>Wear it. Brand it.{'\n'}Gift it.</Text>
          <Text style={styles.heroSubtitle}>Premium streetwear and branded items - made to wear, gift, and remember.</Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.heroPrimaryBtn} onPress={onCustomOrderPress}>
              <Text style={styles.heroPrimaryBtnText}>Custom Merch</Text>
            </Pressable>
            <Pressable style={styles.heroSecondaryBtn} onPress={onStyleMePress}>
              <Text style={styles.heroSecondaryBtnText}>See Work</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
