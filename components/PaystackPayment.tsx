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
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
        <title>Paystack Payment</title>
        <script src="https://js.paystack.co/v1/inline.js"></script>
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f8f9fa;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
                -webkit-user-select: none;
                -webkit-touch-callout: none;
                -webkit-tap-highlight-color: transparent;
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
                font-size: 14px;
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
                transition: background-color 0.2s;
                -webkit-appearance: none;
                -webkit-tap-highlight-color: transparent;
            }
            
            .pay-button:hover {
                background: #6D28D9;
            }
            
            .pay-button:disabled {
                background: #9CA3AF;
                cursor: not-allowed;
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
                transition: background-color 0.2s;
                -webkit-appearance: none;
                -webkit-tap-highlight-color: transparent;
            }
            
            .cancel-button:hover {
                background: #F3F4F6;
            }
            
            .loading {
                display: none;
                color: #6B7280;
                margin-top: 20px;
                font-size: 14px;
            }
            
            .loading.show {
                display: block;
            }
            
            .error {
                display: none;
                color: #EF4444;
                margin-top: 20px;
                font-size: 14px;
                padding: 12px;
                background: #FEE2E2;
                border-radius: 8px;
            }
            
            .error.show {
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="amount">₦${amount.toLocaleString()}</div>
            <div class="email">${email}</div>
            <button class="pay-button" onclick="payWithPaystack()" id="payButton">
                Pay with Paystack
            </button>
            <button class="cancel-button" onclick="cancelPayment()">
                Cancel
            </button>
            <div class="loading" id="loading">Processing payment...</div>
            <div class="error" id="error"></div>
        </div>

        <script>
            let paymentInProgress = false;
            let retryCount = 0;
            const maxRetries = 3;

            function showLoading() {
                document.getElementById('loading').classList.add('show');
                document.getElementById('error').classList.remove('show');
                document.getElementById('payButton').disabled = true;
                document.getElementById('payButton').textContent = 'Processing...';
            }

            function hideLoading() {
                document.getElementById('loading').classList.remove('show');
                document.getElementById('payButton').disabled = false;
                document.getElementById('payButton').textContent = 'Pay with Paystack';
            }

            function showError(message) {
                const errorEl = document.getElementById('error');
                errorEl.textContent = message;
                errorEl.classList.add('show');
                hideLoading();
            }

            function postMessage(data) {
                try {
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify(data));
                    } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ReactNativeWebView) {
                        window.webkit.messageHandlers.ReactNativeWebView.postMessage(JSON.stringify(data));
                    } else {
                        console.log('Message:', data);
                    }
                } catch (error) {
                    console.error('Error posting message:', error);
                }
            }

            function payWithPaystack() {
                if (paymentInProgress) {
                    console.log('Payment already in progress');
                    return;
                }
                
                // Check if Paystack is loaded
                if (typeof PaystackPop === 'undefined') {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        showError('Loading payment system... Please try again.');
                        setTimeout(() => {
                            document.getElementById('error').classList.remove('show');
                        }, 2000);
                        return;
                    } else {
                        showError('Payment system failed to load. Please check your internet connection.');
                        return;
                    }
                }
                
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
                            console.log('Payment successful:', response);
                            paymentInProgress = false;
                            hideLoading();
                            postMessage({
                                type: 'success',
                                data: response
                            });
                        },
                        onClose: function() {
                            console.log('Payment modal closed');
                            paymentInProgress = false;
                            hideLoading();
                            postMessage({
                                type: 'cancel'
                            });
                        }
                    });
                    
                    // Small delay to ensure DOM is ready
                    setTimeout(() => {
                        try {
                            handler.openIframe();
                        } catch (error) {
                            console.error('Error opening Paystack iframe:', error);
                            paymentInProgress = false;
                            showError('Failed to open payment window. Please try again.');
                            postMessage({
                                type: 'error',
                                message: 'Failed to open payment window'
                            });
                        }
                    }, 100);
                    
                } catch (error) {
                    console.error('Paystack setup error:', error);
                    paymentInProgress = false;
                    showError('Payment setup failed. Please try again.');
                    postMessage({
                        type: 'error',
                        message: 'Payment setup failed: ' + error.message
                    });
                }
            }

            function cancelPayment() {
                if (paymentInProgress) {
                    console.log('Cannot cancel - payment in progress');
                    return;
                }
                
                console.log('Payment cancelled by user');
                postMessage({
                    type: 'cancel'
                });
            }

            // Wait for page to fully load before enabling payment
            window.addEventListener('load', function() {
                console.log('Page loaded, Paystack available:', typeof PaystackPop !== 'undefined');
                
                // Auto-trigger payment after a short delay for better UX
                setTimeout(() => {
                    if (!paymentInProgress && typeof PaystackPop !== 'undefined') {
                        console.log('Auto-triggering payment');
                        payWithPaystack();
                    }
                }, 1500);
            });

            // Handle page errors
            window.addEventListener('error', function(event) {
                console.error('Page error:', event.error);
                if (!paymentInProgress) {
                    showError('An error occurred. Please try again.');
                }
            });
        </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Received message from WebView:', data);
      
      if (data.type === 'success') {
        console.log('Payment successful, calling onSuccess');
        onSuccess(data.data);
      } else if (data.type === 'cancel') {
        console.log('Payment cancelled, calling onCancel');
        onCancel();
      } else if (data.type === 'error') {
        console.error('Payment error:', data.message);
        onCancel();
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
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
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo={false}
      bounces={false}
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      // iOS specific props
      allowsBackForwardNavigationGestures={false}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      // Enhanced security and compatibility
      mixedContentMode="compatibility"
      thirdPartyCookiesEnabled={true}
      sharedCookiesEnabled={true}
      // Error handling
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
      onLoadStart={() => {
        console.log('WebView started loading');
      }}
      onLoadEnd={() => {
        console.log('WebView finished loading');
      }}
      // iOS specific error handling
      onContentProcessDidTerminate={() => {
        console.error('WebView content process terminated');
        onCancel();
      }}
    />
  );
}