// Dritchwear Bill-Pay Gateway - powered by Peyflex (https://client.peyflex.com.ng)
// Deploy: supabase functions deploy bill-pay
//
// Secrets required (supabase secrets set KEY=VALUE):
//   PEYFLEX_TOKEN  - your Peyflex API token
//
// Points conversion: 1 point = ₦0.10

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PEYFLEX_TOKEN    = Deno.env.get('PEYFLEX_TOKEN')!;
const PEYFLEX_BASE     = 'https://client.peyflex.com.ng';

const POINTS_TO_NAIRA  = 0.10; // 1 point = ₦0.10

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Peyflex API helpers ────────────────────────────────────────────────────────

function peyflexHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Token ${PEYFLEX_TOKEN}`,
  };
}

async function peyflexGet(path: string, params: Record<string, string> = {}) {
  const qs  = new URLSearchParams(params).toString();
  const url = `${PEYFLEX_BASE}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers: peyflexHeaders() });

  let json: any;
  try { json = await res.json(); } catch {
    throw new Error(`Peyflex GET ${path} returned non-JSON (${res.status})`);
  }

  console.log(`[Peyflex GET ${path}]`, res.status, JSON.stringify(json));

  if (!res.ok) {
    const detail = json?.message ?? json?.detail ?? json?.error ?? JSON.stringify(json);
    throw new Error(`${detail}`);
  }
  return json;
}

async function peyflexPost(path: string, body: Record<string, unknown>) {
  const url = `${PEYFLEX_BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: peyflexHeaders(),
    body: JSON.stringify(body),
  });

  let json: any;
  try { json = await res.json(); } catch {
    throw new Error(`Peyflex POST ${path} returned non-JSON (${res.status})`);
  }

  console.log(`[Peyflex POST ${path}]`, res.status, JSON.stringify(json));

  if (!res.ok) {
    // Surface the actual Peyflex error detail (could be in message, detail, or error field)
    const detail = json?.message ?? json?.detail ?? json?.error ?? JSON.stringify(json);
    throw new Error(`${detail}`);
  }
  if (json?.status === 'FAILED') {
    throw new Error(json?.message ?? `${path} transaction failed`);
  }
  return json;
}

// ── CORS / error helpers ───────────────────────────────────────────────────────

function cors(body: string | null, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type',
    },
  });
}
const err = (msg: string, status = 400) => cors(JSON.stringify({ error: msg }), status);

// ── Supabase balance helpers ───────────────────────────────────────────────────

async function insertTx({
  userId, amount, description, reference, type,
}: {
  userId: string; amount: number; description: string; reference: string; type: 'credit' | 'debit';
}) {
  const { error } = await supabase.from('transactions').insert({
    user_id: userId, type, amount: Math.abs(amount), currency: 'NGN',
    original_amount: Math.abs(amount), description, reference,
    status: 'completed', payment_provider: 'peyflex',
  });
  if (error) throw new Error(`Failed to save transaction: ${error.message}`);
}

async function deductWallet(userId: string, amount: number, description: string, reference: string) {
  const { data, error } = await supabase.rpc('deduct_wallet', { uid: userId, amount });
  if (error) throw new Error(`Failed to deduct wallet: ${error.message}`);
  if (!data)  throw new Error('Insufficient wallet balance');
  await insertTx({ userId, amount, description, reference, type: 'debit' });
}

async function refundWallet(userId: string, amount: number, description: string, reference: string) {
  const { error } = await supabase.rpc('fund_wallet', { uid: userId, amount });
  if (error) throw new Error(`Failed to refund wallet: ${error.message}`);
  await insertTx({ userId, amount, description, reference, type: 'credit' });
}

async function deductPoints(userId: string, points: number, description: string, reference: string) {
  // deduct_points() checks-and-deducts atomically under a row lock (mirrors
  // deduct_wallet) - increment_points() with a negative delta just floors at
  // 0, which let two concurrent bill payments both "succeed" off one balance.
  const { data, error } = await supabase.rpc('deduct_points', { uid: userId, amount: points });
  if (error) throw new Error(`Failed to deduct points: ${error.message}`);
  if (!data) throw new Error('Insufficient points balance');
  await supabase.from('points_transactions').insert({
    user_id: userId, type: 'spent', amount: points, description, reference,
  });
}

async function refundPoints(userId: string, points: number, reference: string) {
  await supabase.rpc('increment_points', { uid: userId, delta: points });
  await supabase.from('points_transactions').delete().eq('reference', reference).eq('user_id', userId);
}

async function saveOrder({
  userId, serviceType, provider, amount, pointsUsed, walletAmount,
  reference, beneficiary, status, response,
}: {
  userId: string; serviceType: string; provider: string; amount: number;
  pointsUsed: number; walletAmount: number; reference: string;
  beneficiary: string; status: string; response: unknown;
}) {
  await supabase.from('bill_transactions').upsert({
    user_id: userId,
    service_type: serviceType,
    service_provider: provider,
    amount,
    payment_source: pointsUsed > 0 && walletAmount > 0 ? 'mixed' : pointsUsed > 0 ? 'points' : 'wallet',
    points_used: pointsUsed,
    vtpass_reference: reference,
    vtpass_response: response,
    status,
    beneficiary,
  }, { onConflict: 'vtpass_reference' });
}

// ── Main handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return cors(null, 204);

    // Auth - verify the user's Supabase session
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return err('Missing authorization token', 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return err(`Auth failed: ${authErr?.message ?? 'Invalid token'}`, 401);

    let body: any;
    try { body = await req.json(); } catch { return err('Invalid JSON body'); }

    // ── Read-only: fetch data networks list ──────────────────────────────────
    if (body.action === 'get_data_networks') {
      try {
        const result = await peyflexGet('/api/data/networks/');
        return cors(JSON.stringify({ success: true, networks: result.networks ?? [] }));
      } catch (e: any) {
        return err(e?.message ?? 'Failed to fetch data networks');
      }
    }

    // ── Read-only: fetch data plans (query param, not path segment) ──────────
    if (body.action === 'get_data_variations') {
      const { network } = body;
      if (!network) return err('network required');
      try {
        // Correct Peyflex URL: /api/data/plans/?network=<id>
        const result = await peyflexGet('/api/data/plans/', { network });
        return cors(JSON.stringify({ success: true, plans: result.plans ?? [] }));
      } catch (e: any) {
        return err(e?.message ?? 'Failed to fetch data plans');
      }
    }

    // ── Read-only: fetch cable providers list ────────────────────────────────
    if (body.action === 'get_cable_providers') {
      try {
        const result = await peyflexGet('/api/cable/providers/');
        return cors(JSON.stringify({ success: true, providers: result.providers ?? result ?? [] }));
      } catch (e: any) {
        return err(e?.message ?? 'Failed to fetch cable providers');
      }
    }

    // ── Read-only: fetch cable TV plans ─────────────────────────────────────
    if (body.action === 'get_cable_variations') {
      const { provider } = body;
      if (!provider) return err('provider required');
      try {
        // Try path param first, fall back to query param
        const result = await peyflexGet(`/api/cable/plans/${provider}/`);
        return cors(JSON.stringify({ success: true, plans: result.plans ?? [] }));
      } catch (e: any) {
        return err(e?.message ?? 'Failed to fetch cable plans');
      }
    }

    // ── Read-only: fetch electricity plans (DISCOs) ──────────────────────────
    if (body.action === 'get_electricity_plans') {
      try {
        const result = await peyflexGet('/api/electricity/plans/', { identifier: 'electricity' });
        return cors(JSON.stringify({ success: true, plans: result.plans ?? result ?? [] }));
      } catch (e: any) {
        return err(e?.message ?? 'Failed to fetch electricity plans');
      }
    }

    // ── Read-only: verify meter / smartcard ─────────────────────────────────
    if (body.action === 'verify_customer') {
      const { customerId, serviceId, variationId, phone } = body;
      if (!customerId || !serviceId) return err('Missing customerId or serviceId');

      if (body.serviceType === 'electricity' || serviceId.includes('electric')) {
        const cleanPhone = String(phone ?? '').replace(/\D/g, '');

        try {
          const result = await peyflexGet('/api/electricity/verify/', {
            identifier: 'electricity',
            meter: String(customerId),
            plan: String(serviceId),
            type: String(variationId ?? 'prepaid'),
            ...(cleanPhone ? { phone: cleanPhone } : {}),
          });
          return cors(JSON.stringify({ success: true, customer: result ?? {} }));
        } catch (e: any) {
          return err(e?.message ?? 'Meter verification failed');
        }
      } else {
        try {
          const result = await peyflexPost('/api/cable/verify/', {
            identifier: String(serviceId),
            iuc: String(customerId),
          });
          return cors(JSON.stringify({ success: true, customer: result ?? {} }));
        } catch (e: any) {
          return err(e?.message ?? 'Smartcard verification failed');
        }
      }
    }

    // ── Bill payment ────────────────────────────────────────────────────────
    const {
      serviceType,   // 'airtime' | 'data' | 'electricity' | 'cable'
      provider,      // network/provider id (e.g. 'mtn', 'dstv', 'benin-electric')
      amount,        // total NGN cost
      beneficiary,   // phone | meter number | smartcard
      variationId,   // data plan_code | meter type (prepaid/postpaid) | cable plan_code
      reference,     // unique ref from client
      phone,         // contact phone (for electricity)
      // Payment split
      pointsToUse,   // number of points (converted at ₦0.10 each)
      walletAmount,  // NGN from wallet
    } = body;

    // Basic validation
    if (!serviceType || !provider || !amount || !beneficiary || !reference) {
      return err('Missing required fields');
    }
    if (!['airtime', 'data', 'electricity', 'cable'].includes(serviceType)) return err('Invalid serviceType');
    if (typeof amount !== 'number' || amount <= 0) return err('Invalid amount');

    // Validate payment split
    const pts      = Number(pointsToUse ?? 0);
    const wal      = Number(walletAmount ?? 0);
    const ptsNaira = parseFloat((pts * POINTS_TO_NAIRA).toFixed(2));
    const covered  = parseFloat((ptsNaira + wal).toFixed(2));

    if (pts < 0 || wal < 0) return err('pointsToUse and walletAmount must be non-negative');
    if (pts === 0 && wal === 0) return err('No payment source provided');
    if (Math.abs(covered - amount) > 0.02) {
      return err(`Payment split ₦${ptsNaira} (points) + ₦${wal} (wallet) = ₦${covered}, but service costs ₦${amount}`);
    }

    // Service-specific validation
    if (serviceType === 'airtime'     && amount < 50)    return err('Minimum airtime is ₦50');
    if (serviceType === 'electricity' && amount < 500)   return err('Minimum electricity is ₦500');
    if (serviceType === 'data'        && !variationId)   return err('variationId (plan_code) required for data');
    if (serviceType === 'electricity' && !variationId)   return err('variationId (prepaid/postpaid) required for electricity');
    if (serviceType === 'cable'       && !variationId)   return err('variationId (plan_code) required for cable TV');

    // Idempotency
    const { data: existing } = await supabase
      .from('bill_transactions')
      .select('id, status, vtpass_response')
      .eq('vtpass_reference', reference)
      .maybeSingle();

    if (existing?.status === 'success') {
      return cors(JSON.stringify({ success: true, message: 'Transaction already processed.', reference }));
    }

    // Server-side balance check
    const { data: profile, error: profErr } = await supabase
      .from('profiles').select('wallet_balance, points_balance').eq('id', user.id).single();

    if (profErr || !profile) return err('Profile not found', 404);

    if (pts > 0 && Number(profile.points_balance) < pts) {
      return err(`Insufficient points. You have ${profile.points_balance} but need ${pts}.`);
    }
    if (wal > 0 && Number(profile.wallet_balance) < wal) {
      return err(`Insufficient wallet balance. Available: ₦${Number(profile.wallet_balance).toLocaleString()}`);
    }

    const labelMap: Record<string, string> = {
      airtime:     `${provider.toUpperCase()} airtime`,
      data:        `${provider.toUpperCase()} data`,
      electricity: `${provider} electricity`,
      cable:       `${provider.toUpperCase()} cable TV`,
    };
    const label = labelMap[serviceType] ?? serviceType;
    const cleanBeneficiary = String(beneficiary).replace(/\D/g, '');
    const cleanPhone = String(phone ?? beneficiary).replace(/\D/g, '');
    const cleanProvider = String(provider).trim();
    const cleanVariationId = String(variationId ?? '').trim();

    // Save pending record
    await saveOrder({
      userId: user.id, serviceType, provider, amount,
      pointsUsed: pts, walletAmount: wal, reference,
      beneficiary, status: 'pending',
      response: { started_at: new Date().toISOString() },
    });

    // ── Step 1: Deduct balances ─────────────────────────────────────────────
    let pointsDeducted = false;
    let walletDeducted = false;

    try {
      if (pts > 0) {
        await deductPoints(user.id, pts, `Bill payment – ${label}`, reference);
        pointsDeducted = true;
      }
      if (wal > 0) {
        await deductWallet(user.id, wal, `Bill payment – ${label}`, reference);
        walletDeducted = true;
      }
    } catch (deductErr: any) {
      if (pointsDeducted) await refundPoints(user.id, pts, reference).catch(() => {});
      if (walletDeducted) await refundWallet(user.id, wal, `Refund – ${label}`, reference).catch(() => {});
      return err(deductErr?.message ?? 'Failed to deduct balance');
    }

    // ── Step 2: Call Peyflex ────────────────────────────────────────────────
    let peyflexResponse: any;

    try {
      if (serviceType === 'airtime') {
        peyflexResponse = await peyflexPost('/api/airtime/topup/', {
          network:       cleanProvider,
          amount,
          mobile_number: cleanBeneficiary,
        });
      } else if (serviceType === 'data') {
        peyflexResponse = await peyflexPost('/api/data/purchase/', {
          network:       cleanProvider,
          mobile_number: cleanBeneficiary,
          plan_code:     cleanVariationId,
        });
      } else if (serviceType === 'electricity') {
        peyflexResponse = await peyflexPost('/api/electricity/subscribe/', {
          identifier: 'electricity',
          meter: cleanBeneficiary,
          plan: cleanProvider,
          amount: String(amount),
          type: cleanVariationId || 'prepaid',
          phone: cleanPhone,
        });
      } else {
        peyflexResponse = await peyflexPost('/api/cable/subscribe/', {
          identifier: cleanProvider,
          iuc: cleanBeneficiary,
          plan_code: cleanVariationId,
          phone: cleanPhone,
        });
      }
    } catch (apiErr: any) {
      // Refund user's balance on API failure
      if (pointsDeducted) await refundPoints(user.id, pts, reference).catch(() => {});
      if (walletDeducted) await refundWallet(user.id, wal, `Refund – ${label}`, reference).catch(() => {});

      await saveOrder({
        userId: user.id, serviceType, provider, amount,
        pointsUsed: pts, walletAmount: wal, reference,
        beneficiary, status: 'failed',
        response: { error: apiErr?.message },
      });

      return err(apiErr?.message ?? 'Bill payment failed. Your balance has been refunded.', 502);
    }

    // ── Step 3: Record success ──────────────────────────────────────────────
    const isSuccess  = peyflexResponse?.status === 'SUCCESS';
    const token: string | null = peyflexResponse?.token ?? null;

    await saveOrder({
      userId: user.id, serviceType, provider, amount,
      pointsUsed: pts, walletAmount: wal, reference,
      beneficiary, status: isSuccess ? 'success' : 'pending',
      response: peyflexResponse,
    });

    const payNote =
      pts > 0 && wal > 0 ? `(${pts} pts + ₦${wal.toLocaleString()} wallet)` :
      pts > 0             ? `(${pts} pts)` :
                            `(₦${wal.toLocaleString()} wallet)`;

    let message = '';
    if (!isSuccess) {
      // Peyflex accepted the request but hasn't confirmed delivery yet (e.g.
      // a queued/pending status rather than an outright failure, which
      // peyflexPost already throws on). Balance stays deducted - telling the
      // customer this succeeded when it hasn't actually delivered yet would
      // be a lie, and refunding now risks double-refunding if it later
      // completes. Being processed is recorded as 'pending' for follow-up.
      message = 'Your payment was received and is being processed. This can take a few minutes - check your bill history for the final status.';
    } else if (serviceType === 'airtime')   message = `₦${amount.toLocaleString()} airtime sent to ${beneficiary}.`;
    else if (serviceType === 'data')        message = `Data bundle sent to ${beneficiary}.`;
    else if (serviceType === 'electricity') {
      message = `₦${amount.toLocaleString()} electricity payment submitted.`;
      if (token) message += ` Token: ${token}`;
    } else                                  message = `${provider.toUpperCase()} subscription processed for ${beneficiary}.`;

    return cors(JSON.stringify({
      success: isSuccess,
      message: `${message} ${payNote}`.trim(),
      token,
      transactionId: peyflexResponse?.transaction_id ?? null,
      status:        peyflexResponse?.status ?? 'SUCCESS',
      reference:     peyflexResponse?.reference ?? reference,
    }));

  } catch (fatal: any) {
    console.error('Unhandled bill-pay error:', fatal);
    return err(`Internal error: ${fatal?.message ?? 'Unknown'}`, 500);
  }
});
