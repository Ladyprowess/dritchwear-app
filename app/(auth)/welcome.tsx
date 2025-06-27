import React from 'react';
import { View, Text, StyleSheet, Pressable, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground
        source={{ uri: 'https://images.pexels.com/photos/8532616/pexels-photo-8532616.jpeg' }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(124, 58, 237, 0.8)', 'rgba(59, 130, 246, 0.9)']}
          style={styles.overlay}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.brandName}>Dritchwear</Text>
              <Text style={styles.tagline}>Premium Fashion for Everyone</Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.description}>
                Discover our collection of premium ready-to-wear fashion and custom designs tailored just for you.
              </Text>
              
              <View style={styles.buttonContainer}>
                <Pressable
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => router.push('/(auth)/register')}
                >
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>Get Started</Text>
                </Pressable>
                
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => router.push('/(auth)/login')}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>Sign In</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: height * 0.15,
    paddingBottom: 50,
  },
  header: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 48,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#F1F5F9',
    textAlign: 'center',
    opacity: 0.9,
  },
  footer: {
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#F1F5F9',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  primaryButtonText: {
    color: '#7C3AED',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
  },
});