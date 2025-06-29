import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { resendConfirmation } from '@/lib/auth';
import { ArrowLeft, Mail, CheckCircle, RefreshCw } from 'lucide-react-native';

export default function ConfirmEmailScreen() {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const email = params.email as string;

  useEffect(() => {
    // Auto-confirm if we have the necessary tokens from the URL
    if (params.access_token && params.refresh_token) {
      handleAutoConfirm();
    }
  }, [params]);

  const handleAutoConfirm = async () => {
    setLoading(true);
    try {
      // The session should be automatically set by Supabase when the user clicks the confirmation link
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        Alert.alert('Confirmation Error', 'Failed to confirm your email. Please try again.');
      } else if (session) {
        setConfirmed(true);
      }
    } catch (error) {
      console.error('Auto-confirm error:', error);
      Alert.alert('Confirmation Error', 'Failed to confirm your email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address not found. Please try registering again.');
      return;
    }

    setResendLoading(true);
    const { error } = await resendConfirmation(email);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Email Sent',
        'A new confirmation email has been sent to your email address.'
      );
    }
    setResendLoading(false);
  };

  const handleContinue = () => {
    router.replace('/(auth)/login');
  };

  if (confirmed) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <CheckCircle size={64} color="#10B981" />
            </View>
            
            <Text style={styles.successTitle}>Email Confirmed!</Text>
            <Text style={styles.successSubtitle}>
              Your email has been successfully confirmed. You can now sign in to your Dritchwear account.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={handleContinue}
            >
              <Text style={styles.primaryButtonText}>Continue to Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </Pressable>
          
          <Text style={styles.title}>Confirm Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a confirmation email to verify your Dritchwear account.
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.emailIcon}>
            <Mail size={64} color="#7C3AED" />
          </View>

          <Text style={styles.instructionTitle}>Check Your Email</Text>
          
          {email && (
            <Text style={styles.emailText}>
              We sent a confirmation link to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
          )}

          <Text style={styles.instructionText}>
            Click the link in the email to confirm your account and start shopping at Dritchwear. If you don't see the email, check your spam folder.
          </Text>

          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.resendButton, resendLoading && styles.resendButtonDisabled]}
              onPress={handleResendConfirmation}
              disabled={resendLoading}
            >
              <RefreshCw size={16} color="#7C3AED" />
              <Text style={styles.resendButtonText}>
                {resendLoading ? 'Sending...' : 'Resend Confirmation Email'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/resend-confirmation')}
            >
              <Text style={styles.secondaryButtonText}>Use Different Email</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Already confirmed?{' '}
              <Text 
                style={styles.footerLink}
                onPress={() => router.push('/(auth)/login')}
              >
                Sign In
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  emailIcon: {
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  emailHighlight: {
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7C3AED',
    gap: 8,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  secondaryButton: {
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  footerLink: {
    color: '#7C3AED',
    fontFamily: 'Inter-SemiBold',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});