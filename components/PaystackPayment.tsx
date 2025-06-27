import React from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface PaystackPaymentProps {
  email: string;
  amount: number;
  publicKey: string;
  onSuccess: (response: any) => void;
  onCancel: () => void;
  customerName?: string;
}

export default function PaystackPayment({
  email,
  amount,
  publicKey,
  onSuccess,
  onCancel,
  customerName = 'Customer'
}: PaystackPaymentProps) {
  // Convert amount to kobo (Paystack uses kobo)
  const amountInKobo = amount * 100;

  const paystackHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Paystack Payment</title>
        <script src="https://js.paystack.co/v1/inline.js"></script>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f8f9fa;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                text-align: center;
                max-width: 400px;
                width: 100%;
            }
            .amount {
                font-size: 32px;
                font-weight: bold;
                color: #7C3AED;
                margin-bottom: 20px;
            }
            .email {
                color: #6B7280;
                margin-bottom: 30px;
            }
            .pay-button {
                background: #7C3AED;
                color: white;
                border: none;
                padding: 16px 32px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                margin-bottom: 16px;
            }
            .pay-button:hover {
                background: #6D28D9;
            }
            .cancel-button {
                background: transparent;
                color: #6B7280;
                border: 1px solid #E5E7EB;
                padding: 12px 32px;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
                width: 100%;
            }
            .cancel-button:hover {
                background: #F3F4F6;
            }
            .loading {
                display: none;
                color: #6B7280;
                margin-top: 20px;
            }
            .loading.show {
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="amount">₦${(amount || 0).toLocaleString()}</div>
            <div class="email">${email}</div>
            <button class="pay-button" onclick="payWithPaystack()" id="payButton">
                Pay with Paystack
            </button>
            <button class="cancel-button" onclick="cancelPayment()">
                Cancel
            </button>
            <div class="loading" id="loading">Processing payment...</div>
        </div>

        <script>
            let paymentInProgress = false;

            function showLoading() {
                document.getElementById('loading').classList.add('show');
                document.getElementById('payButton').disabled = true;
                document.getElementById('payButton').textContent = 'Processing...';
            }

            function hideLoading() {
                document.getElementById('loading').classList.remove('show');
                document.getElementById('payButton').disabled = false;
                document.getElementById('payButton').textContent = 'Pay with Paystack';
            }

            function payWithPaystack() {
                if (paymentInProgress) return;
                
                paymentInProgress = true;
                showLoading();

                try {
                    const handler = PaystackPop.setup({
                        key: '${publicKey}',
                        email: '${email}',
                        amount: ${amountInKobo},
                        currency: 'NGN',
                        ref: 'dw_' + Math.floor((Math.random() * 1000000000) + 1),
                        metadata: {
                            custom_fields: [
                                {
                                    display_name: "Customer Name",
                                    variable_name: "customer_name",
                                    value: "${customerName}"
                                }
                            ]
                        },
                        callback: function(response) {
                            paymentInProgress = false;
                            hideLoading();
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'success',
                                data: response
                            }));
                        },
                        onClose: function() {
                            paymentInProgress = false;
                            hideLoading();
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'cancel'
                            }));
                        }
                    });
                    handler.openIframe();
                } catch (error) {
                    paymentInProgress = false;
                    hideLoading();
                    console.error('Paystack error:', error);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'error',
                        message: 'Failed to initialize payment'
                    }));
                }
            }

            function cancelPayment() {
                if (paymentInProgress) return;
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'cancel'
                }));
            }

            // Auto-trigger payment on load for better UX
            setTimeout(() => {
                if (!paymentInProgress) {
                    payWithPaystack();
                }
            }, 1000);
        </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'success') {
        onSuccess(data.data);
      } else if (data.type === 'cancel') {
        onCancel();
      } else if (data.type === 'error') {
        console.error('Paystack error:', data.message);
        onCancel();
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      onCancel();
    }
  };

  return (
    <WebView
      source={{ html: paystackHTML }}
      style={{ flex: 1 }}
      onMessage={handleMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={true}
      onError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView error: ', nativeEvent);
        onCancel();
      }}
      onHttpError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView HTTP error: ', nativeEvent);
        onCancel();
      }}
    />
  );
}