import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#7C3AED', '#3B82F6']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Logo/Brand Section */}
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>D</Text>
            </View>
            <Text style={styles.brandName}>Dritchwear</Text>
            <Text style={styles.tagline}>Premium Fashion, Delivered</Text>
          </View>

          {/* Hero Content */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>
              Welcome to{'\n'}Your Style Journey
            </Text>
            <Text style={styles.heroSubtitle}>
              Discover premium fashion pieces crafted with excellence and delivered with care
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </Pressable>
            
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/login')}
            >
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
    </SafeAreaView>
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
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
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
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
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
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  secondaryButton: {
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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