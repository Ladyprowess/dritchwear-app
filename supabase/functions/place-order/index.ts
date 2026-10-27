// Creates every checkout order (card, Pay for Me link, wallet). Customers
// can no longer insert orders directly (see 202610270001 migration): prices
// come from `products`, fees/minimums/store status from commerce_settings
// and delivery_zones, and the promo and member-tier perks are re-validated
// here, so a tampered cart or URL can't change what gets charged.
//
//   payment_method 'paystack' → pending_payment order; the client opens
//                               Paystack with the returned total and
//                               confirm-order-payment / the webhook settle it.
//   payment_method 'pay_link' → pending_payment order + payment_links row.
//   payment_method 'wallet'   → order paid from the wallet atomically via
//                               place_wallet_order (debit + paid order +
//                               ledger in one DB transaction).
//
// Deploy: supabase functions deploy place-order

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import {
  calculateCustomizationFeeTotal,
  calculateOrderTotal,
  loadCommerceConfig,
  memberHasFreeDelivery,
} from '../_shared/pricing.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const PAY_LINK_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_LINE_QUANTITY = 10000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return json({ success: false, error, ...extra }, status);
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return fail(405, 'Method not allowed');

  const accessToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) return fail(401, 'Not authenticated');
  const userId = authData.user.id;

  const body = await req.json().catch(() => ({})) as any;
  const paymentMethod = str(body.payment_method);
  if (!['paystack', 'pay_link', 'wallet'].includes(paymentMethod)) {
    return fail(400, 'Unsupported payment method');
  }

  const deliveryAddress = str(body.delivery_address);
  const deliveryState = str(body.delivery_state);
  const deliveryCountry = str(body.delivery_country);
  const contactPhone = str(body.contact_phone);
  const notes = str(body.notes) || null;
  if (!deliveryAddress || !deliveryState || !deliveryCountry) {
    return fail(400, 'Please enter your delivery address, state, and country.');
  }
  if (contactPhone.replace(/\D/g, '').length < 10) {
    return fail(400, 'Please enter a valid contact phone number.');
  }
  const fullDeliveryAddress = `${deliveryAddress}, ${deliveryState}, ${deliveryCountry}`;

  // ── Items: price, name and customization fee come from products ─────────
  const requestedItems: any[] = Array.isArray(body.items) ? body.items : [];
  if (requestedItems.length === 0) return fail(400, 'Your cart is empty.');
  for (const item of requestedItems) {
    const quantity = Number(item?.quantity);
    if (!str(item?.product_id) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      return fail(400, 'Your cart contains an invalid item. Please remove it and try again.');
    }
  }

  const productIds = [...new Set(requestedItems.map((item) => str(item.product_id)))];
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, image_url, is_active, allow_logo_upload')
    .in('id', productIds);
  if (productsError) return fail(500, 'Could not load products. Please try again.');
  const productsById = new Map((products ?? []).map((p: any) => [p.id, p]));

  const orderItems: any[] = [];
  for (const item of requestedItems) {
    const product: any = productsById.get(str(item.product_id));
    if (!product || product.is_active === false) {
      return fail(409, 'An item in your cart is no longer available. Please remove it and try again.');
    }
    const note = str(item.note) || null;
    const logoUrl = str(item.logo_url) || null;
    orderItems.push({
      product_id: product.id,
      image: str(item.image) || product.image_url || null,
      name: product.name,
      price: Number(product.price),
      quantity: Number(item.quantity),
      size: str(item.size) || null,
      color: str(item.color) || null,
      note,
      logo_url: logoUrl,
      // Same rule as useAddToCart: a design request only carries the fee on
      // products that actually offer branding.
      has_customization_fee: !!product.allow_logo_upload && !!(note || logoUrl),
    });
  }

  // ── Store status and minimums ───────────────────────────────────────────
  let config;
  try {
    config = await loadCommerceConfig(supabase);
  } catch (error) {
    console.error('place-order: commerce settings unavailable', error);
    return fail(503, 'Checkout is temporarily unavailable. Please try again in a moment.');
  }
  if (!config.storeOpen) return fail(409, config.storeClosedMessage, { code: 'store_closed' });

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  if (subtotal < config.minimumOrderNgn) {
    return fail(409, `Orders must be at least ₦${config.minimumOrderNgn.toLocaleString()}. Please add more items to continue.`, { code: 'minimum_order' });
  }
  if (totalQuantity < config.minimumOrderQuantity) {
    return fail(409, `We require at least ${config.minimumOrderQuantity} items per order. Please add more items to continue.`, { code: 'minimum_quantity' });
  }

  const { error: stockError } = await supabase.rpc('validate_stock_availability', { order_items: orderItems });
  if (stockError) return fail(409, `Some items are no longer available: ${stockError.message}`, { code: 'stock' });

  // ── Promo (same rules as useCheckoutOffers, checked against the DB) ─────
  let discountAmount = 0;
  let promoFreeDelivery = false;
  let promo: any = null;
  const promoCodeId = str(body.promo_code_id);
  if (promoCodeId) {
    const { data } = await supabase.from('promo_codes').select('*').eq('id', promoCodeId).maybeSingle();
    promo = data;
    const promoError = (message: string) => fail(409, message, { code: 'promo_invalid' });
    if (!promo || !promo.is_active) return promoError('This offer is no longer available.');
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return promoError('This offer has expired.');
    if (promo.max_usage != null && (promo.used_count ?? 0) >= promo.max_usage) return promoError('This offer has reached its usage limit.');
    if (promo.min_order_amount && subtotal < Number(promo.min_order_amount)) return promoError('Your order no longer meets this offer\'s minimum.');
    if (promo.min_quantity && totalQuantity < promo.min_quantity) return promoError(`This offer needs at least ${promo.min_quantity} items in your order.`);

    // Only orders that were actually paid count as "used" here, so an
    // abandoned Paystack attempt doesn't burn the customer's promo.
    const { count: priorUses } = await supabase
      .from('orders').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('promo_code_id', promo.id).neq('payment_status', 'pending_payment');
    if ((priorUses ?? 0) > 0) return promoError('You have already used this offer.');
    if (promo.first_time_only) {
      const { count: priorOrders } = await supabase
        .from('orders').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).neq('payment_status', 'pending_payment');
      if ((priorOrders ?? 0) > 0) return promoError('This offer is for first-time customers only.');
    }

    const rate = Number(promo.discount_percentage || 0) / 100;
    const type = promo.type ?? 'percentage';
    if (type === 'free_delivery') {
      promoFreeDelivery = true;
    } else if (type === 'item_percentage' && promo.applicable_product_id) {
      discountAmount = orderItems.reduce((sum, item) =>
        item.product_id === promo.applicable_product_id ? sum + item.price * item.quantity * rate : sum, 0);
    } else {
      discountAmount = subtotal * rate;
    }
  }

  const freeDelivery = promoFreeDelivery || await memberHasFreeDelivery(supabase, userId);
  const totals = calculateOrderTotal(
    subtotal - discountAmount,
    fullDeliveryAddress,
    freeDelivery,
    config,
    calculateCustomizationFeeTotal(orderItems, config),
    discountAmount,
  );

  // Checkout showed the customer a total; never charge more than that
  // without telling them first (e.g. a price changed while in their cart).
  const expectedTotal = Number(body.expected_total);
  if (Number.isFinite(expectedTotal) && totals.total > expectedTotal + 1) {
    return fail(409, 'Some prices in your cart have changed. Please review your new total and try again.', {
      code: 'price_changed',
      totals,
    });
  }

  // ── Create the order ────────────────────────────────────────────────────
  const orderRow = {
    user_id: userId,
    items: orderItems,
    subtotal: totals.subtotal,
    service_fee: totals.serviceFee,
    delivery_fee: totals.deliveryFee,
    tax: totals.tax,
    customization_fee: totals.customizationFee,
    total: totals.total,
    delivery_address: fullDeliveryAddress,
    delivery_state: deliveryState,
    delivery_country: deliveryCountry,
    contact_phone: contactPhone,
    promo_code: promo?.code ?? null,
    promo_code_id: promo?.id ?? null,
    discount_amount: discountAmount,
    notes,
  };

  if (paymentMethod === 'wallet') {
    const { data: walletOrderId, error: payError } = await supabase.rpc('place_wallet_order', { p_order: orderRow });
    if (payError) {
      if (/insufficient_wallet_balance/.test(payError.message || '')) {
        return fail(402, 'Your wallet balance is too low for this order. Please fund your wallet and try again.', {
          code: 'insufficient_balance',
          totals,
        });
      }
      if (/insufficient stock/i.test(payError.message || '')) {
        return fail(409, 'Sorry, an item in your order just sold out.', { code: 'stock' });
      }
      if (/promo_unavailable/i.test(payError.message || '')) {
        return fail(409, 'This offer is no longer available for your order. Remove it and try again.', { code: 'promo_invalid' });
      }
      console.error('place-order: wallet payment failed', payError);
      return fail(500, 'Your wallet payment could not be completed. You have not been charged.');
    }
    return json({ success: true, orderId: walletOrderId, totals });
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      ...orderRow,
      payment_method: paymentMethod,
      payment_status: 'pending_payment',
      order_status: 'pending_payment',
      currency: 'NGN',
      original_amount: totals.total,
      description: paymentMethod === 'paystack' ? notes : null,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    console.error('place-order: insert failed', orderError);
    return fail(500, 'Could not start checkout. Please try again.');
  }

  const discardOrder = () =>
    supabase.from('orders').delete().eq('id', order.id).eq('payment_status', 'pending_payment');

  if (paymentMethod === 'pay_link') {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    const token = order.id.replace(/-/g, '').slice(0, 16);
    const { error: linkError } = await supabase.from('payment_links').insert({
      order_id: order.id,
      user_id: userId,
      token,
      amount_ngn: totals.total,
      status: 'pending',
      requester_name: profile?.full_name || 'Someone',
      items: orderItems,
      expires_at: new Date(Date.now() + PAY_LINK_TTL_MS).toISOString(),
    });
    if (linkError) {
      await discardOrder();
      console.error('place-order: payment link insert failed', linkError);
      return fail(500, 'Could not generate payment link. Please try again.');
    }
    return json({ success: true, orderId: order.id, token, totals });
  }

  return json({ success: true, orderId: order.id, totals });
});
