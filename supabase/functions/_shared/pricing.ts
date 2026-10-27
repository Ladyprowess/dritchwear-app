// Server-side source of truth for checkout totals, used by place-order.
// The fee math is a line-for-line mirror of lib/fees.ts (calculateOrderTotal
// and friends) and features/customer/checkout/pricing.ts so the total the
// server charges matches what checkout displayed - keep them in sync.
// Unlike the client, every input here (prices, settings, promo, member
// tier) is loaded from the database, never taken from the request.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.43.4';

export interface DeliveryZone {
  name: string;
  matchKeywords: string[];
  feeNgn: number;
  isDefault: boolean;
}

export interface CommerceConfig {
  serviceFeePercentage: number;
  taxPercentage: number;
  minimumOrderNgn: number;
  minimumOrderQuantity: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryThresholdNgn: number;
  storeOpen: boolean;
  storeClosedMessage: string;
  deliveryZones: DeliveryZone[];
  customizationFeeNgn: number;
}

// Same defaults as DEFAULT_COMMERCE_CONFIG in lib/fees.ts.
const DEFAULT_CONFIG: CommerceConfig = {
  serviceFeePercentage: 0.02,
  taxPercentage: 0.075,
  minimumOrderNgn: 1000,
  minimumOrderQuantity: 5,
  freeDeliveryEnabled: false,
  freeDeliveryThresholdNgn: 0,
  storeOpen: true,
  storeClosedMessage: 'We are briefly closed. Please check back soon.',
  customizationFeeNgn: 2000,
  deliveryZones: [
    { name: 'Lagos', matchKeywords: ['lagos'], feeNgn: 3500, isDefault: false },
    {
      name: 'Rest of Nigeria',
      matchKeywords: [
        'nigeria', 'abia', 'adamawa', 'akwa ibom', 'anambra', 'bauchi', 'bayelsa', 'benue',
        'borno', 'cross river', 'delta', 'ebonyi', 'edo', 'ekiti', 'enugu', 'gombe', 'imo',
        'jigawa', 'kaduna', 'kano', 'katsina', 'kebbi', 'kogi', 'kwara', 'nasarawa', 'niger',
        'ogun', 'ondo', 'osun', 'oyo', 'plateau', 'rivers', 'sokoto', 'taraba', 'yobe',
        'zamfara', 'abuja', 'fct', 'ibadan', 'port harcourt', 'benin', 'maiduguri', 'zaria',
        'aba', 'jos', 'ilorin', 'onitsha', 'warri', 'okene', 'calabar', 'uyo', 'ado-ekiti',
        'awka', 'akure', 'makurdi', 'lafia', 'yenagoa', 'jalingo', 'owerri', 'abakaliki',
        'dutse', 'damaturu', 'gusau', 'yola', 'minna', 'birnin kebbi', 'lokoja', 'osogbo',
      ],
      feeNgn: 5000,
      isDefault: false,
    },
    { name: 'International', matchKeywords: [], feeNgn: 15000, isDefault: true },
  ],
};

const INTERNATIONAL_FALLBACK_FEE = 15000;

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Unlike the client's fetchCommerceConfig, a failed read throws instead of
// silently falling back to "store open, default minimums".
export async function loadCommerceConfig(supabase: SupabaseClient): Promise<CommerceConfig> {
  const [settingsRes, zonesRes] = await Promise.all([
    supabase.from('commerce_settings').select('*').eq('id', 'default').maybeSingle(),
    supabase.from('delivery_zones').select('*').eq('active', true).order('sort_order', { ascending: true }),
  ]);
  if (settingsRes.error) throw settingsRes.error;
  if (zonesRes.error) throw zonesRes.error;

  const s: any = settingsRes.data ?? {};
  const zones: DeliveryZone[] = (zonesRes.data ?? []).map((z: any) => ({
    name: z.name,
    matchKeywords: Array.isArray(z.match_keywords) ? z.match_keywords.map((k: string) => String(k).toLowerCase()) : [],
    feeNgn: toNumber(z.fee_ngn, 0),
    isDefault: !!z.is_default,
  }));

  return {
    serviceFeePercentage: toNumber(s.service_fee_percentage, DEFAULT_CONFIG.serviceFeePercentage),
    taxPercentage: toNumber(s.tax_percentage, DEFAULT_CONFIG.taxPercentage),
    minimumOrderNgn: toNumber(s.minimum_order_ngn, DEFAULT_CONFIG.minimumOrderNgn),
    minimumOrderQuantity: toNumber(s.minimum_order_quantity, DEFAULT_CONFIG.minimumOrderQuantity),
    freeDeliveryEnabled: !!s.free_delivery_enabled,
    freeDeliveryThresholdNgn: toNumber(s.free_delivery_threshold_ngn, 0),
    storeOpen: s.store_open === undefined ? true : !!s.store_open,
    storeClosedMessage: s.store_closed_message || DEFAULT_CONFIG.storeClosedMessage,
    customizationFeeNgn: toNumber(s.customization_fee_ngn, DEFAULT_CONFIG.customizationFeeNgn),
    deliveryZones: zones.length > 0 ? zones : DEFAULT_CONFIG.deliveryZones,
  };
}

export function calculateDeliveryFee(location: string, subtotalNgn: number, config: CommerceConfig): number {
  if (config.freeDeliveryEnabled) return 0;
  if (config.freeDeliveryThresholdNgn > 0 && subtotalNgn >= config.freeDeliveryThresholdNgn) return 0;

  const zones = config.deliveryZones ?? [];
  const defaultZone = zones.find((zone) => zone.isDefault);
  const normalizedLocation = (location || '').toLowerCase().trim();

  if (normalizedLocation) {
    const matched = zones.find(
      (zone) => !zone.isDefault && zone.matchKeywords.some((keyword) => normalizedLocation.includes(keyword))
    );
    if (matched) return matched.feeNgn;
  }
  if (defaultZone) return defaultZone.feeNgn;
  return INTERNATIONAL_FALLBACK_FEE;
}

export function calculateServiceFee(subtotal: number, config: CommerceConfig): number {
  return Math.round(subtotal * config.serviceFeePercentage * 100) / 100;
}

export function calculateTax(subtotal: number, config: CommerceConfig): number {
  // Checkout always prices in NGN, which is taxed.
  return Math.round(subtotal * config.taxPercentage * 100) / 100;
}

export function calculateCustomizationFeeTotal(
  items: Array<{ has_customization_fee: boolean; quantity: number }>,
  config: CommerceConfig
): number {
  return items.reduce((sum, item) => (item.has_customization_fee ? sum + config.customizationFeeNgn * item.quantity : sum), 0);
}

export interface OrderTotals {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  tax: number;
  discountAmount: number;
  customizationFee: number;
  total: number;
}

// `subtotal` is the already-discounted subtotal, same as the client passes it.
export function calculateOrderTotal(
  subtotal: number,
  location: string,
  freeDelivery: boolean,
  config: CommerceConfig,
  customizationFeeTotal: number,
  discountAmount: number,
): OrderTotals {
  const serviceFee = calculateServiceFee(subtotal, config);
  const deliveryFee = freeDelivery ? 0 : calculateDeliveryFee(location, subtotal, config);
  const tax = calculateTax(subtotal, config);
  const total = Math.round(subtotal + serviceFee + deliveryFee + tax + customizationFeeTotal);
  return { subtotal, serviceFee, deliveryFee, tax, discountAmount, customizationFee: customizationFeeTotal, total };
}

// Mirrors lib/wardrobe.ts getOwnedPieceCount + TIERS: Gold (15+ distinct
// pieces owned) and above get free delivery.
const SUCCESS_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'completed'];
const FREE_DELIVERY_MIN_PIECES = 15;

export async function memberHasFreeDelivery(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('items, payment_status, order_status')
    .eq('user_id', userId);
  if (error || !orders) return false;

  const owned = new Set<string>();
  orders.forEach((o: any) => {
    const ok = o.payment_status === 'paid' || SUCCESS_STATUSES.includes((o.order_status || '').toLowerCase());
    if (!ok || !Array.isArray(o.items)) return;
    o.items.forEach((it: any) => { if (it?.product_id) owned.add(String(it.product_id)); });
  });
  return owned.size >= FREE_DELIVERY_MIN_PIECES;
}
