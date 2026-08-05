import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

interface PaystackPaymentProps {
  email: string;
  amount: number;
  publicKey: string;
  onSuccess: (response: any) => void;
  onCancel: () => void;
  customerName?: string;
  // The pre-created order this payment settles. Embedded in Paystack's
  // metadata (same custom_fields shape the pay-for-me link page uses) so the
  // webhook/reconciliation job can identify which order to mark paid,
  // independent of whether onSuccess ever fires client-side.
  orderId?: string;
}

// ---------------------------------------------------------------------------
// Shared HTML - rendered inside WebView (native) or iframe (web)
// ---------------------------------------------------------------------------
function buildHtml(publicKey: string, email: string, amount: number, customerName: string, orderId: string) {
  const amountInKobo = Math.round(amount * 100);
  const cfg = JSON.stringify({ key: publicKey, email, amount: amountInKobo, currency: 'NGN', customerName, orderId });

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
      metadata: { custom_fields: [
        { display_name: 'Customer', variable_name: 'customer_name', value: CFG.customerName },
        { display_name: 'Order Token', variable_name: 'token', value: CFG.orderId || '' },
      ] },
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
// Web renderer - loads Paystack's inline.js directly into the top-level
// document and calls openIframe() from there, same as /pay/[token].tsx.
// openIframe() isn't meant to run inside a nested <iframe> - Paystack can
// fall back to navigating the top-level page when it's invoked from one,
// which used to blow away the whole app (reload straight to the home
// screen) the moment "Pay with Paystack" was tapped, before the customer
// ever saw a payment screen.
// ---------------------------------------------------------------------------
function PaystackWeb({ email, amount, publicKey, onSuccess, onCancel, customerName, orderId }: PaystackPaymentProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    const script = (document as any).createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setScriptReady(true);
    script.onerror = () => setScriptReady(true); // let startPayment surface the error
    (document as any).head.appendChild(script);

    // The immediate "your order is waiting" payment reminder can insert a
    // notification the instant this order is created - which, on a PWA, can
    // pop a native OS notification right as this overlay is opening and
    // interrupt/reload the page before the customer ever sees Paystack. This
    // flag (checked in the customer layout's realtime handler) skips that one
    // native popup while a payment is actively in progress.
    (window as any).__dritchwearPaymentActive = true;

    return () => {
      try { (document as any).head.removeChild(script); } catch {}
      (window as any).__dritchwearPaymentActive = false;
    };
  }, []);

  const startPayment = () => {
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) return;
    // Nothing was catching a throw here - an uncaught error inside this
    // effect can, on some Android WebView/PWA runtimes, trigger the
    // browser's own crash-recovery reload instead of just failing quietly,
    // which looks identical to the app dumping the customer back on the
    // home screen mid-payment. Fail closed (back to the checkout screen)
    // instead of letting that happen.
    try {
    const handler = PaystackPop.setup({
      key: publicKey,
      email,
      amount: Math.round(amount * 100),
      currency: 'NGN',
      ref: 'dw_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      metadata: { custom_fields: [
        { display_name: 'Customer', variable_name: 'customer_name', value: customerName ?? 'Customer' },
        { display_name: 'Order Token', variable_name: 'token', value: orderId || '' },
      ] },
      callback: (response: any) => onSuccess(response),
      onClose: () => onCancel(),
    });
    handler.openIframe();
    } catch (e) {
      console.error('[PaystackPayment] setup/openIframe failed:', e);
      onCancel();
    }
  };

  useEffect(() => {
    if (scriptReady && !openedRef.current) {
      openedRef.current = true;
      startPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <ActivityIndicator size="large" color="#5A2D82" />
      <Text style={{ fontSize: 14, color: '#6B7280' }}>
        {scriptReady ? 'Opening secure payment…' : 'Loading payment…'}
      </Text>
      <Pressable onPress={onCancel} style={{ paddingVertical: 10, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 14, color: '#6B7280' }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Native renderer - uses react-native-webview
// ---------------------------------------------------------------------------
function PaystackNative({ email, amount, publicKey, onSuccess, onCancel, customerName, orderId }: PaystackPaymentProps) {
  // Lazy require so the native module is never touched on web
  const { WebView } = require('react-native-webview');
  const html = buildHtml(publicKey, email, amount, customerName ?? 'Customer', orderId ?? '');

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
