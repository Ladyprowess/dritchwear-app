import { supabase } from '@/lib/supabase';
import {
  CommerceConfig,
  DEFAULT_COMMERCE_CONFIG,
  DeliveryZone,
} from '@/lib/fees';

// Small in-memory cache so checkout and other screens don't refetch on every
// render. Falls back to DEFAULT_COMMERCE_CONFIG on any error so the store never
// breaks if the settings table is briefly unreachable.
const CACHE_TTL_MS = 60_000;
let cached: { value: CommerceConfig; at: number } | null = null;

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function fetchCommerceConfig(force = false): Promise<CommerceConfig> {
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const [settingsRes, zonesRes] = await Promise.all([
      supabase.from('commerce_settings').select('*').eq('id', 'default').single(),
      supabase
        .from('delivery_zones')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (zonesRes.error) throw zonesRes.error;

    const s: any = settingsRes.data ?? {};
    const zones: DeliveryZone[] = (zonesRes.data ?? []).map((z: any) => ({
      name: z.name,
      matchKeywords: Array.isArray(z.match_keywords)
        ? z.match_keywords.map((k: string) => String(k).toLowerCase())
        : [],
      feeNgn: toNumber(z.fee_ngn, 0),
      isDefault: !!z.is_default,
    }));

    const config: CommerceConfig = {
      serviceFeePercentage: toNumber(s.service_fee_percentage, DEFAULT_COMMERCE_CONFIG.serviceFeePercentage),
      taxPercentage: toNumber(s.tax_percentage, DEFAULT_COMMERCE_CONFIG.taxPercentage),
      minimumOrderNgn: toNumber(s.minimum_order_ngn, DEFAULT_COMMERCE_CONFIG.minimumOrderNgn),
      minimumOrderQuantity: toNumber(s.minimum_order_quantity, DEFAULT_COMMERCE_CONFIG.minimumOrderQuantity),
      freeDeliveryEnabled: !!s.free_delivery_enabled,
      freeDeliveryThresholdNgn: toNumber(s.free_delivery_threshold_ngn, 0),
      storeOpen: s.store_open === undefined ? true : !!s.store_open,
      storeClosedMessage: s.store_closed_message || DEFAULT_COMMERCE_CONFIG.storeClosedMessage,
      customizationFeeNgn: toNumber(s.customization_fee_ngn, DEFAULT_COMMERCE_CONFIG.customizationFeeNgn),
      // Keep the hardcoded defaults if the admin hasn't defined any zones yet.
      deliveryZones: zones.length > 0 ? zones : DEFAULT_COMMERCE_CONFIG.deliveryZones,
    };

    cached = { value: config, at: Date.now() };
    return config;
  } catch (error) {
    console.warn('fetchCommerceConfig failed, using defaults:', error);
    return DEFAULT_COMMERCE_CONFIG;
  }
}

// Call after an admin saves settings so the next read reflects the change.
export function invalidateCommerceConfig() {
  cached = null;
}
