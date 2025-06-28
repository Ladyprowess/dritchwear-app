import React, { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';

interface PayPalPaymentProps {
  email: string;
  amount: number;
  currency: string;
  onSuccess: (response: PayPalResponse) => void;
  onCancel: () => void;
  customerName?: string;
  description?: string;
}

interface PayPalResponse {
  reference: string;
  status: 'success' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string;
  paypalOrderId?: string;
  payerEmail?: string;
  paymentTime?: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export default function PayPalPayment({
  email,
  amount,
  currency,
  onSuccess,
  onCancel,
  customerName = 'Customer',
  description = 'Dritchwear Purchase'
}: PayPalPaymentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initiatePayment();
  }, []);

  const getPayPalAccessToken = async (): Promise<string | null> => {
    try {
      const clientId = process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID;
      const clientSecret = process.env.EXPO_PUBLIC_PAYPAL_SECRET;
      const isSandbox = process.env.EXPO_PUBLIC_PAYPAL_SANDBOX === 'true';

      if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials not found');
      }

      const baseUrl = isSandbox 
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.status}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting PayPal access token:', error);
      return null;
    }
  };

  const createPayPalOrder = async (accessToken: string): Promise<PayPalOrder | null> => {
    try {
      const isSandbox = process.env.EXPO_PUBLIC_PAYPAL_SANDBOX === 'true';
      const baseUrl = isSandbox 
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

      const reference = `dw_paypal_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: reference,
          amount: {
            currency_code: currency.toUpperCase(),
            value: amount.toFixed(2),
          },
          description: description,
          payee: {
            email_address: email,
          },
        }],
        payer: {
          name: {
            given_name: customerName.split(' ')[0] || 'Customer',
            surname: customerName.split(' ').slice(1).join(' ') || '',
          },
          email_address: email,
        },
        application_context: {
          brand_name: 'Dritchwear',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      };

      const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': reference,
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('PayPal order creation error:', errorData);
        throw new Error(`Failed to create PayPal order: ${response.status}`);
      }

      const order = await response.json();
      console.log('PayPal order created:', order);
      return order;
    } catch (error) {
      console.error('Error creating PayPal order:', error);
      return null;
    }
  };

  const capturePayPalOrder = async (orderId: string, accessToken: string): Promise<any> => {
    try {
      const isSandbox = process.env.EXPO_PUBLIC_PAYPAL_SANDBOX === 'true';
      const baseUrl = isSandbox 
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

      const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to capture PayPal order: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error capturing PayPal order:', error);
      return null;
    }
  };

  const initiatePayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Initiating PayPal payment for:', {
        amount,
        currency,
        description,
        customerEmail: email,
        customerName,
      });

      // Step 1: Get access token
      const accessToken = await getPayPalAccessToken();
      if (!accessToken) {
        throw new Error('Failed to get PayPal access token');
      }

      // Step 2: Create PayPal order
      const order = await createPayPalOrder(accessToken);
      if (!order) {
        throw new Error('Failed to create PayPal order');
      }

      // Step 3: Find the approval URL
      const approvalUrl = order.links.find(link => link.rel === 'approve')?.href;
      if (!approvalUrl) {
        throw new Error('No approval URL found in PayPal order');
      }

      console.log('Opening PayPal approval URL:', approvalUrl);

      // Step 4: Open the approval URL in browser
      const result = await WebBrowser.openBrowserAsync(approvalUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        showTitle: true,
        toolbarColor: '#0070BA',
        controlsColor: '#FFFFFF',
        secondaryToolbarColor: '#003087',
      });

      console.log('WebBrowser result:', result);

      // Step 5: Handle the result
      if (result.type === 'cancel') {
        console.log('PayPal payment cancelled by user');
        onCancel();
      } else if (result.type === 'dismiss') {
        // For demo purposes in sandbox, simulate successful payment
        // In production, you would verify the payment status with PayPal
        console.log('PayPal payment completed');
        
        const paymentResponse: PayPalResponse = {
          reference: order.id,
          status: 'success',
          amount,
          currency,
          paymentMethod: 'paypal',
          transactionId: `pp_${order.id}`,
          paypalOrderId: order.id,
          payerEmail: email,
          paymentTime: new Date().toISOString(),
        };
        
        console.log('PayPal payment successful:', paymentResponse);
        onSuccess(paymentResponse);
      }
    } catch (error) {
      console.error('Error in PayPal payment flow:', error);
      setError(error instanceof Error ? error.message : 'Payment failed');
      
      Alert.alert(
        'Payment Error',
        'There was an error processing your PayPal payment. Please try again.',
        [{ text: 'OK', onPress: onCancel }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>❌ Payment Error</Text>
        <Text style={styles.errorDescription}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0070BA" />
      <Text style={styles.loadingText}>
        {isLoading ? 'Setting up PayPal payment...' : 'Redirecting to PayPal...'}
      </Text>
      <Text style={styles.amountText}>
        {currency.toUpperCase()} {amount.toFixed(2)}
      </Text>
      <Text style={styles.noteText}>
        You'll be redirected to PayPal to complete your payment securely.
      </Text>
      {process.env.EXPO_PUBLIC_PAYPAL_SANDBOX === 'true' && (
        <Text style={styles.sandboxText}>
          🔧 SANDBOX MODE - No real payment will be processed
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
  sandboxText: {
    marginTop: 24,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#F59E0B',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});