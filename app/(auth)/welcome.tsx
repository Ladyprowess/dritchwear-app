import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEdgeToEdge } from '@/hooks/useEdgeToEdge';

const BRAND_PURPLE = '#5A2D82';
const BRAND_YELLOW = '#FDB813';

export default function WelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string | string[] }>();
  const { getSafePadding } = useEdgeToEdge();
  const referralParam = Array.isArray(params.ref) ? params.ref[0] : params.ref;

  useEffect(() => {
    if (!referralParam) return;

    router.replace({
      pathname: '/(auth)/register',
      params: { ref: String(referralParam).trim().toUpperCase() },
    });
  }, [router, referralParam]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        // ✅ Brand-safe purple gradient (premium, not neon)
        colors={['#5A2D82', '#4B2169', '#3F185E']}
        style={[
          styles.gradient,
          {
            paddingTop: getSafePadding('top'),
            paddingBottom: getSafePadding('bottom'),
            paddingLeft: getSafePadding('left'),
            paddingRight: getSafePadding('right'),
          },
        ]}
      >
        <View style={styles.content}>
          {/* Logo/Brand Section */}
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
            </View>

            <Text style={styles.brandName}>Dritchwear</Text>
            <Text style={styles.tagline}>Wear it. Brand it. Gift it.</Text>

            {/* Optional tiny accent line (subtle brand yellow) */}
            <View style={styles.accentLine} />
          </View>

          {/* Hero Content */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Custom Streetwear {'\n'}& Branded Pieces</Text>
            <Text style={styles.heroSubtitle}>
            Streetwear and custom-branded products that represent your brand.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                router.push({
                  pathname: '/(auth)/register',
                  params: referralParam ? { ref: String(referralParam).trim().toUpperCase() } : undefined,
                })
              }
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.secondaryButtonText}>I Already Have an Account</Text>
            </Pressable>
          </View>

          {/* Features */}
          <View style={styles.featuresSection}>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🚚</Text>
              <Text style={styles.featureText}>Fast Delivery</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>💎</Text>
              <Text style={styles.featureText}>Premium Quality</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🌍</Text>
              <Text style={styles.featureText}>Global Shipping</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },

  brandSection: {
    alignItems: 'center',
    marginTop: 20,
  },

  // ✅ White badge so purple logo pops
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,

    // subtle premium shadow
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  logo: {
    width: 52,
    height: 52,
    resizeMode: 'contain',
  },

  brandName: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },

  tagline: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
  },

  accentLine: {
    marginTop: 12,
    height: 3,
    width: 50,
    borderRadius: 2,
    backgroundColor: BRAND_YELLOW,
    opacity: 0.9,
  },

  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  heroTitle: {
    fontSize: 31,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 16,
  },

  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255, 255, 255, 0.82)',
    textAlign: 'center',
    lineHeight: 24,
  },

  actionSection: {
    gap: 16,
  },

  primaryButton: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ✅ Use brand purple (not neon)
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: BRAND_PURPLE,
  },

  secondaryButton: {
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },

  featuresSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
  },

  feature: {
    alignItems: 'center',
  },

  featureIcon: {
    fontSize: 24,
    marginBottom: 8,
  },

  featureText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
