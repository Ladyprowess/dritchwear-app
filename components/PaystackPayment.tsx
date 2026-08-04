import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

interface PaystackPaymentProps {
  email: string;
  amount: number;
  publicKey: string;
  onSuccess: (response: any) => void;
  onCancel: () => void;
  customerName?: string;
}

// ---------------------------------------------------------------------------
// Shared HTML - rendered inside WebView (native) or iframe (web)
// ---------------------------------------------------------------------------
function buildHtml(publicKey: string, email: string, amount: number, customerName: string) {
  const amountInKobo = Math.round(amount * 100);
  const cfg = JSON.stringify({ key: publicKey, email, amount: amountInKobo, currency: 'NGN', customerName });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <script src="https://js.paystack.co/v1/inline.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;
      display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;
      -webkit-tap-highlight-color:transparent}
    .card{background:#fff;padding:36px 28px;border-radius:16px;
      box-shadow:0 4px 16px rgba(0,0,0,.1);text-align:center;width:100%;max-width:400px}
    .amt{font-size:34px;font-weight:700;color:#5A2D82;margin-bottom:6px}
    .em{font-size:14px;color:#6B7280;margin-bottom:28px}
    .btn-pay{background:#5A2D82;color:#fff;border:none;padding:16px;border-radius:10px;
      font-size:16px;font-weight:600;width:100%;cursor:pointer;margin-bottom:12px;
      -webkit-appearance:none}
    .btn-pay:disabled{background:#9CA3AF;cursor:not-allowed}
    .btn-cancel{background:transparent;color:#6B7280;border:1px solid #E5E7EB;
      padding:12px;border-radius:10px;font-size:14px;width:100%;cursor:pointer;
      -webkit-appearance:none}
    .status{margin-top:14px;font-size:13px;color:#6B7280;min-height:18px}
    .status.err{color:#EF4444}
  </style>
</head>
<body>
<div class="card">
  <div class="amt">&#8358;${amount.toLocaleString()}</div>
  <div class="em">${email}</div>
  <button id="payBtn" class="btn-pay" onclick="startPayment()">Pay with Paystack</button>
  <button class="btn-cancel" onclick="cancelPayment()">Cancel</button>
  <div id="status" class="status"></div>
</div>

<script>
var CFG = ${cfg};
var payBtn = document.getElementById('payBtn');
var statusEl = document.getElementById('status');
var done = false;

// Works for both WebView (ReactNativeWebView.postMessage) and iframe (parent.postMessage)
function notify(data) {
  var msg = JSON.stringify(data);
  try {
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); return; }
  } catch(e) {}
  try { window.parent.postMessage(msg, '*'); } catch(e) {}
}

function setStatus(msg, isErr) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isErr ? ' err' : '');
}
function resetBtn() { payBtn.disabled = false; payBtn.textContent = 'Pay with Paystack'; }

function onPaySuccess(response) {
  done = true; resetBtn(); setStatus('');
  notify({ type: 'success', data: response });
}
function onPayClose() {
  if (!done) { resetBtn(); setStatus(''); notify({ type: 'cancel' }); }
}
function startPayment() {
  if (done) return;
  if (typeof PaystackPop === 'undefined') {
    setStatus('Payment system loading - please try again in a moment.'); return;
  }
  payBtn.disabled = true; payBtn.textContent = 'Opening payment...'; setStatus('');
  try {
    var handler = PaystackPop.setup({
      key: CFG.key, email: CFG.email, amount: CFG.amount, currency: CFG.currency,
      ref: 'dw_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      metadata: { custom_fields: [{ display_name: 'Customer', variable_name: 'customer_name', value: CFG.customerName }] },
      callback: onPaySuccess,
      onClose: onPayClose
    });
    handler.openIframe();
  } catch(e) { resetBtn(); setStatus('Error: ' + e.message, true); notify({ type: 'error', message: e.message }); }
}
function cancelPayment() { if (!done) notify({ type: 'cancel' }); }

window.addEventListener('load', function() {
  setTimeout(function() {
    if (!done && typeof PaystackPop !== 'undefined') startPayment();
  }, 1200);
});
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Web renderer - uses a plain <iframe> via srcdoc (Safari compatible)
// ---------------------------------------------------------------------------
function PaystackWeb({ email, amount, publicKey, onSuccess, onCancel, customerName }: PaystackPaymentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = buildHtml(publicKey, email, amount, customerName ?? 'Customer');

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'success') onSuccess(data.data);
        else if (data.type === 'cancel') onCancel();
        else if (data.type === 'error') onCancel();
      } catch {
        // ignore unrelated messages
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSuccess, onCancel]);

  // Use a blob URL so Paystack's popup isn't blocked by Safari's iframe sandbox
  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);

  return (
    <View style={{ flex: 1 }}>
      {/* @ts-ignore - iframe is a valid web element via react-native-web */}
      <iframe
        ref={iframeRef}
        src={blobUrl}
        style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
        allow="payment"
        title="Paystack Payment"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Native renderer - uses react-native-webview
// ---------------------------------------------------------------------------
function PaystackNative({ email, amount, publicKey, onSuccess, onCancel, customerName }: PaystackPaymentProps) {
  // Lazy require so the native module is never touched on web
  const { WebView } = require('react-native-webview');
  const html = buildHtml(publicKey, email, amount, customerName ?? 'Customer');

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success')     onSuccess(data.data);
      else if (data.type === 'cancel') onCancel();
      else if (data.type === 'error')  onCancel();
    } catch {
      onCancel();
    }
  };

  return (
    <WebView
      source={{ html, baseUrl: 'https://js.paystack.co' }}
      style={{ flex: 1 }}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      startInLoadingState
      bounces={false}
      scrollEnabled={false}
      mixedContentMode="compatibility"
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      allowsBackForwardNavigationGestures={false}
      onError={() => onCancel()}
      onHttpError={() => onCancel()}
      onContentProcessDidTerminate={() => onCancel()}
    />
  );
}

// ---------------------------------------------------------------------------
// Exported component - auto-selects the right renderer
// ---------------------------------------------------------------------------
export default function PaystackPayment(props: PaystackPaymentProps) {
  if (!props.publicKey) {
    console.warn(
      '[PaystackPayment] publicKey is empty. ' +
      'Env variables are not available in Expo Go - use a development build.'
    );
    props.onCancel();
    return null;
  }

  return Platform.OS === 'web'
    ? <PaystackWeb {...props} />
    : <PaystackNative {...props} />;
}
