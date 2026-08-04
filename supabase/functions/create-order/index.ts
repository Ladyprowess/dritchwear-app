// Dritchwear Partner Order API
// External platforms call this after collecting payment from their customer.
//
// POST /functions/v1/create-order
// Header: x-api-key: <your PARTNER_API_KEY secret>
//
// Request body:
// {
//   items:            [{ name, quantity, price, size?, color?, product_id? }],
//   customer_name:    "Ada Okonkwo",
//   customer_email:   "ada@example.com",
//   customer_phone:   "08012345678",
//   delivery_address: "12 Broad St, Lagos",
//   total_ngn:        25000,          // total amount in NGN collected by partner
//   currency?:        "NGN",          // currency partner charged in (default: NGN)
//   original_amount?: 25000,          // amount in partner's currency if not NGN
//   partner_ref:      "PAY-ABC123",   // partner's payment reference (required)
//   partner_name?:    "MyShop",       // name of the integrating platform
//   notes?:           "Leave at gate"
// }
//
// Response (success):
// { success: true, order_id: "uuid", message: "..." }
//
// Response (error):
// { success: false, error: "reason" }
//
// Deploy: supabase functions deploy create-order

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PARTNER_API_KEY = Deno.env.get('PARTNER_API_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  // ── 1. Validate API key ────────────────────────────────────────────────────
  const apiKey = req.headers.get('x-api-key') ?? '';
  if (!PARTNER_API_KEY || apiKey !== PARTNER_API_KEY) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  // ── 2. Parse and validate body ─────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const {
    items,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    total_ngn,
    currency       = 'NGN',
    original_amount,
    partner_ref,
    partner_name,
    notes,
    delivery_fee,
    service_fee,
    tax,
    promo_code,
    discount_amount,
  } = body as Record<string, unknown>;

  if (!Array.isArray(items) || items.length === 0) {
    return json({ success: false, error: 'items must be a non-empty array' }, 400);
  }
  if (!customer_name || typeof customer_name !== 'string') {
    return json({ success: false, error: 'customer_name is required' }, 400);
  }
  if (!customer_email || typeof customer_email !== 'string' || !customer_email.includes('@')) {
    return json({ success: false, error: 'customer_email must be a valid email' }, 400);
  }
  if (!delivery_address || typeof delivery_address !== 'string') {
    return json({ success: false, error: 'delivery_address is required' }, 400);
  }
  if (!total_ngn || typeof total_ngn !== 'number' || total_ngn <= 0) {
    return json({ success: false, error: 'total_ngn must be a positive number' }, 400);
  }
  if (!partner_ref || typeof partner_ref !== 'string') {
    return json({ success: false, error: 'partner_ref (payment reference) is required' }, 400);
  }

  const email      = (customer_email as string).toLowerCase().trim();
  const name       = (customer_name as string).trim();
  const phone      = typeof customer_phone === 'string' ? customer_phone.trim() : null;
  const partnerTag = typeof partner_name === 'string' ? partner_name.trim() : 'External Partner';

  // ── 3. Find or create customer account ────────────────────────────────────
  let userId: string;

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile) {
    userId = existingProfile.id;
  } else {
    // Create a Supabase auth user for the customer (email confirmed, no password needed now)
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createErr) {
      // Email already registered in auth but profile row is missing - look it up again
      if (createErr.message?.toLowerCase().includes('already been registered')) {
        const { data: retryProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (retryProfile) {
          userId = retryProfile.id;
        } else {
          console.error('Auth user exists but no profile row found:', email);
          return json({ success: false, error: 'Customer account conflict. Contact support.' }, 500);
        }
      } else {
        console.error('createUser error:', createErr.message);
        return json({ success: false, error: `Failed to set up customer account: ${createErr.message}` }, 500);
      }
    } else {
      userId = created.user.id;

      // Upsert profile in case the DB trigger did not fire
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: name,
        phone,
        role: 'customer',
        wallet_balance: 0,
        preferred_currency: typeof currency === 'string' ? currency : 'NGN',
      }, { onConflict: 'id', ignoreDuplicates: true });
    }
  }

  // ── 4. Build order row ─────────────────────────────────────────────────────
  // Subtotal from item prices; partner already handled fees/delivery their side
  const subtotal = (items as Array<{ price: number; quantity: number }>)
    .reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const orderNotes = [
    `Via: ${partnerTag}`,
    `Partner Ref: ${partner_ref}`,
    typeof notes === 'string' && notes.trim() ? `Note: ${notes.trim()}` : null,
  ].filter(Boolean).join(' | ');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id:          userId,
      items:            items as unknown[],
      subtotal,
      service_fee:      typeof service_fee === 'number' ? service_fee : 0,
      delivery_fee:     typeof delivery_fee === 'number' ? delivery_fee : 0,
      tax:              typeof tax === 'number' ? tax : 0,
      total:            total_ngn as number,
      payment_method:   'partner_payment',
      payment_status:   'paid',
      promo_code:       typeof promo_code === 'string' ? promo_code : null,
      discount_amount:  typeof discount_amount === 'number' ? discount_amount : 0,
      order_status:     'in_review',
      delivery_address: delivery_address as string,
      contact_phone:    phone,
      currency:         typeof currency === 'string' ? currency : 'NGN',
      original_amount:  typeof original_amount === 'number' ? original_amount : (total_ngn as number),
      notes:            orderNotes,
      description:      `Order via ${partnerTag}`,
    })
    .select('id')
    .single();

  if (orderError) {
    console.error('Order insert error:', orderError.message);
    return json({ success: false, error: `Failed to create order: ${orderError.message}` }, 500);
  }

  const orderId = order.id as string;
  const shortId = orderId.slice(0, 8).toUpperCase();

  // ── 5. Notify all admins (in-app + push) ──────────────────────────────────
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (admins && admins.length > 0) {
    const adminIds: string[] = admins.map((a: { id: string }) => a.id);

    // In-app notifications
    await supabase.from('notifications').insert(
      adminIds.map((adminId) => ({
        user_id: adminId,
        title:   'New Partner Order',
        message: `Paid order #${shortId} from ${name} via ${partnerTag} - ready to fulfil.`,
        type:    'order',
      }))
    );

    // Push notifications (best-effort)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-push-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          userIds: adminIds,
          title:   'New Partner Order',
          message: `Paid order #${shortId} from ${name} via ${partnerTag} - ready to fulfil.`,
          type:    'order',
        }),
      });
    } catch (pushErr) {
      console.error('Push notification failed (non-fatal):', pushErr);
    }
  }

  // ── 6. Return success ─────────────────────────────────────────────────────
  return json({
    success:  true,
    order_id: orderId,
    message:  `Order #${shortId} created successfully. Your customer will receive fulfilment updates.`,
  });
});
