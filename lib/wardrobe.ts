import { supabase } from '@/lib/supabase';

// Orders that count as "owned" for the wardrobe (paid or fulfilled).
const SUCCESS_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'completed'];

// Wardrobe levels - earned purely by the number of Dritchwear pieces owned.
// `freeDelivery` is the one perk we actually enforce at checkout today.
export const TIERS = [
  { name: 'Bronze', min: 0, color: '#B87333', freeDelivery: false, perks: ['Wardrobe stats & fit tracking'] },
  { name: 'Silver', min: 6, color: '#8E9099', freeDelivery: false, perks: ['Early access to new drops', 'Priority support'] },
  { name: 'Gold', min: 15, color: '#D4A017', freeDelivery: true, perks: ['Free delivery', 'Exclusive member drops'] },
  { name: 'Platinum', min: 30, color: '#5A2D82', freeDelivery: true, perks: ['VIP styling sessions', 'First dibs on limited pieces', 'Everything in Gold'] },
] as const;

export type Tier = typeof TIERS[number];

export const tierIndexFor = (n: number): number => {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (n >= TIERS[i].min) idx = i;
  return idx;
};

export const getTier = (n: number): Tier => TIERS[tierIndexFor(n)];

// Rank (index in TIERS) of a tier name - used to gate products by min_tier.
// Unknown/empty (e.g. no gate) resolves to 0 (Bronze / everyone).
export const tierRankByName = (name?: string | null): number => {
  if (!name) return 0;
  const i = TIERS.findIndex((t) => t.name === name);
  return i < 0 ? 0 : i;
};

// The set of product ids a shopper owns (from successful orders) - powers
// "you already own this" ownership badges on fits.
export async function getOwnedProductIds(userId: string): Promise<Set<string>> {
  const owned = new Set<string>();
  const { data: orders, error } = await supabase
    .from('orders')
    .select('items, payment_status, order_status')
    .eq('user_id', userId);
  if (error || !orders) return owned;
  orders.forEach((o: any) => {
    const ok = o.payment_status === 'paid' || SUCCESS_STATUSES.includes((o.order_status || '').toLowerCase());
    if (!ok || !Array.isArray(o.items)) return;
    o.items.forEach((it: any) => { if (it?.product_id) owned.add(String(it.product_id)); });
  });
  return owned;
}

// Distinct owned-piece count for many users in a single query - for the admin
// support inbox to badge/sort tickets by the requester's wardrobe tier.
export async function getOwnedCountsForUsers(userIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!userIds.length) return result;

  const { data: orders, error } = await supabase
    .from('orders')
    .select('user_id, items, payment_status, order_status')
    .in('user_id', userIds);

  if (error || !orders) return result;

  const byUser = new Map<string, Set<string>>();
  orders.forEach((o: any) => {
    const ok = o.payment_status === 'paid' || SUCCESS_STATUSES.includes((o.order_status || '').toLowerCase());
    if (!ok || !Array.isArray(o.items) || !o.user_id) return;
    const set = byUser.get(o.user_id) ?? new Set<string>();
    o.items.forEach((it: any) => { if (it?.product_id) set.add(String(it.product_id)); });
    byUser.set(o.user_id, set);
  });
  byUser.forEach((set, uid) => result.set(uid, set.size));
  return result;
}

// Distinct Dritchwear pieces the shopper owns, derived from their successful
// orders (same rule the wardrobe screen uses). Returns 0 on any error.
export async function getOwnedPieceCount(userId: string): Promise<number> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('items, payment_status, order_status')
    .eq('user_id', userId);

  if (error || !orders) return 0;

  const owned = new Set<string>();
  orders.forEach((o: any) => {
    const ok = o.payment_status === 'paid' || SUCCESS_STATUSES.includes((o.order_status || '').toLowerCase());
    if (!ok || !Array.isArray(o.items)) return;
    o.items.forEach((it: any) => { if (it?.product_id) owned.add(String(it.product_id)); });
  });
  return owned.size;
}
