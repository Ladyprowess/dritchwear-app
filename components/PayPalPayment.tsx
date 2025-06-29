import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';

interface PayPalPaymentProps {
  email: string;
  amount: number;
  currency: string;
  onSuccess: (response: any) => void;
  onCancel: () => void;
  customerName?: string;
  description?: string;
  userId?: string;
}

export default function PayPalPayment({
  email,
  amount,
  currency,
  onSuccess,
  onCancel,
  customerName = 'Customer',
  description = 'Dritchwear Purchase',
  userId
}: PayPalPaymentProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  useEffect(() => {
    createPayPalOrder();
  }, []);

  const createPayPalOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🚀 Creating PayPal order with enhanced data:', {
        amount,
        currency,
        email,
        customerName,
        description,
        userId
      });

      const requestBody = {
        action: 'create-order',
        amount: amount,
        currency: currency,
        customerEmail: email,
        customerName: customerName,
        description: description,
        userId: userId,
        metadata: {
          source: 'mobile_app',
          platform: 'react_native',
          timestamp: new Date().toISOString()
        }
      };

      console.log('📤 Sending enhanced request:', JSON.stringify(requestBody, null, 2));

      // Call the enhanced edge function
      const { data, error: functionError } = await supabase.functions.invoke('paypal-payment', {
        body: requestBody
      });
      

      console.log('📥 Enhanced function response:', { data, error: functionError });

      if (functionError) {
        console.error('❌ Enhanced function error:', functionError);
        throw new Error(`Function error: ${functionError.message || 'Unknown error'}`);
      }

      if (!data) {
        console.error('❌ No data returned from enhanced function');
        throw new Error('No data returned from PayPal function');
      }

      if (!data.success) {
        console.error('❌ Enhanced PayPal order creation failed:', data.error);
        throw new Error(data.error || 'Failed to create PayPal order');
      }

      if (!data.approvalUrl || !data.orderId) {
        console.error('❌ Missing required data in enhanced response:', data);
        throw new Error('Invalid response from PayPal service');
      }

      setCurrentOrderId(data.orderId);
      console.log('🎯 Opening enhanced PayPal approval URL:', data.approvalUrl);
      await openPayPalApproval(data.approvalUrl, data.orderId);

    } catch (error) {
      console.error('💥 Error in enhanced createPayPalOrder:', error);
      
      let errorMessage = 'Failed to initialize PayPal payment';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Enhanced error stack:', error.stack);
      }
      
      setError(errorMessage);
      
      Alert.alert(
        'Payment Error',
        'Unable to initialize PayPal payment. Please try again or contact support.',
        [{ text: 'OK', onPress: onCancel }]
      );
    } finally {
      setLoading(false);
    }
  };

  const openPayPalApproval = async (approvalUrl: string, orderId: string) => {
    try {
      console.log('🌐 Opening enhanced PayPal approval URL:', approvalUrl);

      const result = await WebBrowser.openBrowserAsync(approvalUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        showTitle: true,
        toolbarColor: '#0070BA',
        controlsColor: '#FFFFFF',
        secondaryToolbarColor: '#003087',
        browserPackage: undefined, // Let the system choose the best browser
      });

      console.log('🔄 Enhanced WebBrowser result:', result);

      if (result.type === 'cancel') {
        console.log('❌ Enhanced PayPal payment cancelled by user');
        onCancel();
      } else if (result.type === 'dismiss') {
        console.log('✅ Enhanced PayPal flow completed, capturing payment...');
        await capturePayPalOrder(orderId);
      }

    } catch (error) {
      console.error('💥 Error opening enhanced PayPal approval:', error);
      setError('Failed to open PayPal payment page');
      Alert.alert(
        'Payment Error',
        'Unable to open PayPal payment page. Please try again.',
        [{ text: 'OK', onPress: onCancel }]
      );
    }
  };

  const capturePayPalOrder = async (orderId: string) => {
    try {
      setLoading(true);
      console.log('💰 Capturing enhanced PayPal order:', orderId);

      const { data, error: functionError } = await supabase.functions.invoke('paypal-payment', {
        body: {
          action: 'capture-order',
          orderId,
          userId
        }
      });
      

      console.log('📥 Enhanced capture response:', { data, error: functionError });

      if (functionError) {
        console.error('❌ Enhanced capture function error:', functionError);
        throw new Error(functionError.message || 'Failed to capture PayPal payment');
      }

      if (!data || !data.success) {
        console.error('❌ Enhanced PayPal capture failed:', data);
        throw new Error(data?.error || 'Failed to capture PayPal payment');
      }

      console.log('🎉 Enhanced PayPal payment captured successfully:', data);

      const successResponse = {
        reference: data.transactionId || `pp_${orderId}`,
        status: 'success',
        amount,
        currency,
        paymentMethod: 'paypal',
        transactionId: data.transactionId,
        paypalOrderId: orderId,
        captureResult: data.captureResult,
        requestId: data.requestId
      };

      onSuccess(successResponse);

    } catch (error) {
      console.error('💥 Error capturing enhanced PayPal payment:', error);
      
      // Provide more helpful error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      Alert.alert(
        'Payment Processing Error',
        `There was an issue processing your payment: ${errorMessage}\n\nOrder ID: ${orderId}\n\nPlease contact support if this issue persists.`,
        [
          { text: 'Retry', onPress: () => capturePayPalOrder(orderId) },
          { text: 'Cancel', onPress: onCancel }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const checkOrderStatus = async () => {
    if (!currentOrderId) return;

    try {
      console.log('📋 Checking enhanced order status:', currentOrderId);
      
      const { data, error } = await supabase.functions.invoke('paypal-payment', {
        body: {
          action: 'order-status',
          orderId: currentOrderId
        }
      });

      if (data?.success && data.order) {
        console.log('📊 Enhanced order status:', data.order.status);
        return data.order;
      }
    } catch (error) {
      console.error('❌ Error checking enhanced order status:', error);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <Text style={styles.noteText}>
          Please try again or contact support if the problem persists.
        </Text>
        {currentOrderId && (
          <Text style={styles.debugText}>
            Order ID: {currentOrderId}
          </Text>
        )}
        <Text style={styles.debugText}>
          Debug: Check console logs for detailed error information
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0070BA" />
      <Text style={styles.loadingText}>
        {loading ? 'Setting up secure PayPal payment...' : 'Processing payment...'}
      </Text>
      <Text style={styles.amountText}>
        {currency} {amount.toFixed(2)}
      </Text>
      <Text style={styles.noteText}>
        You'll be redirected to PayPal to complete your secure payment.
      </Text>
      <Text style={styles.productionText}>
        🔒 Payment will be processed securely in minutes.
      </Text>
      {currentOrderId && (
        <Text style={styles.orderIdText}>
          Order: {currentOrderId.slice(0, 8)}...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#0070BA',
    textAlign: 'center',
  },
  amountText: {
    marginTop: 12,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  noteText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  productionText: {
    marginTop: 24,
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    textAlign: 'center',
  },
  orderIdText: {
    marginTop: 8,
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  debugText: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});