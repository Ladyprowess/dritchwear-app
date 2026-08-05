export const SERVICE_FEE_PERCENTAGE = 0.02; // 2%

// Keep this if you still want a default/fallback (optional)
// But we’ll mainly use getTaxRateByLocation().
export const TAX_PERCENTAGE = 0.075; // 7%

export const DELIVERY_FEES = {
  lagos: 3500,
  outside_lagos: 5000,
  international: 15000,
} as const;

// Currency-specific delivery fees (in local currency)
export const DELIVERY_FEES_BY_CURRENCY: Record<
  string,
  { local: number; national: number; international: number }
> = {
  NGN: { local: 3500, national: 5000, international: 15000 },
  USD: { local: 5, national: 8, international: 25 },
  EUR: { local: 4, national: 7, international: 20 },
  GBP: { local: 4, national: 6, international: 18 },
  CAD: { local: 6, national: 9, international: 28 },
  AUD: { local: 6, national: 9, international: 30 },
  JPY: { local: 500, national: 800, international: 2500 },
  CHF: { local: 4, national: 7, international: 20 },
  CNY: { local: 30, national: 50, international: 150 },
  INR: { local: 300, national: 500, international: 1500 },
  ZAR: { local: 80, national: 120, international: 400 },
};

// A single delivery zone the admin can configure from the admin panel.
export interface DeliveryZone {
  name: string;
  matchKeywords: string[]; // lowercased substrings matched against the address
  feeNgn: number;
  isDefault: boolean; // fallback used when no zone keyword matches
}

// Admin-configurable commerce settings. All monetary values are in NGN, which is
// the source of truth used at checkout (other currencies are converted for display).
export interface CommerceConfig {
  serviceFeePercentage: number;
  taxPercentage: number;
  minimumOrderNgn: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryThresholdNgn: number; // 0 = disabled
  storeOpen: boolean;
  storeClosedMessage: string;
  deliveryZones: DeliveryZone[];
  customizationFeeNgn: number; // flat fee per item that has a custom logo/design
}

// Defaults reproduce the previously hardcoded behaviour, so any call site that
// does not pass a config (e.g. before settings have loaded) behaves as before.
export const DEFAULT_COMMERCE_CONFIG: CommerceConfig = {
  serviceFeePercentage: SERVICE_FEE_PERCENTAGE,
  taxPercentage: TAX_PERCENTAGE,
  minimumOrderNgn: 1000,
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

export function calculateDeliveryFee(
  location: string,
  subtotalNgn: number = 0,
  config: CommerceConfig = DEFAULT_COMMERCE_CONFIG
): number {
  // Free delivery for everyone, or free once the cart passes a threshold.
  if (config.freeDeliveryEnabled) return 0;
  if (config.freeDeliveryThresholdNgn > 0 && subtotalNgn >= config.freeDeliveryThresholdNgn) {
    return 0;
  }

  const zones = config.deliveryZones ?? [];
  const defaultZone = zones.find((zone) => zone.isDefault);

  const normalizedLocation = (location || '').toLowerCase().trim();

  if (normalizedLocation) {
    const matched = zones.find(
      (zone) =>
        !zone.isDefault &&
        zone.matchKeywords.some((keyword) => normalizedLocation.includes(keyword))
    );
    if (matched) return matched.feeNgn;
  }

  if (defaultZone) return defaultZone.feeNgn;

  // Absolute fallback if no zones are configured at all.
  return DELIVERY_FEES.international;
}

export function calculateServiceFee(
  subtotal: number,
  config: CommerceConfig = DEFAULT_COMMERCE_CONFIG
): number {
  return Math.round(subtotal * config.serviceFeePercentage * 100) / 100;
}

export function getTaxRateByLocation(
  location: string,
  currency: string = 'NGN',
  config: CommerceConfig = DEFAULT_COMMERCE_CONFIG
): number {
  // Tax is charged for the currencies we collect it in; other currencies remain
  // untaxed as before. The rate itself is now admin-configurable.
  if (currency === 'NGN' || currency === 'GBP' || currency === 'EUR' || currency === 'USD') {
    return config.taxPercentage;
  }
  return 0;
}

export function calculateTax(
  subtotal: number,
  location: string,
  currency: string = 'NGN',
  config: CommerceConfig = DEFAULT_COMMERCE_CONFIG
): number {
  const rate = getTaxRateByLocation(location, currency, config);
  return Math.round(subtotal * rate * 100) / 100;
}

// Flat fee per unit for any cart item flagged as a custom logo/design request
// (image and/or description, on a product that allows branding) - not itself
// subject to service fee % or tax, same treatment as delivery fee.
export function calculateCustomizationFeeTotal(
  items: Array<{ hasCustomizationFee?: boolean; quantity: number }>,
  config: CommerceConfig = DEFAULT_COMMERCE_CONFIG
): number {
  return items.reduce((sum, item) => (item.hasCustomizationFee ? sum + config.customizationFeeNgn * item.quantity : sum), 0);
}

export function calculateOrderTotal(
  subtotal: number,
  location: string,
  currency: string = 'NGN',
  discountAmount: number = 0,
  promoType?: string,
  config: CommerceConfig = DEFAULT_COMMERCE_CONFIG,
  customizationFeeTotal: number = 0,
): {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  tax: number;
  discountAmount: number;
  customizationFee: number;
  total: number;
  currency: string;
} {
  const discountedSubtotal = subtotal - discountAmount;

  const serviceFee = calculateServiceFee(discountedSubtotal, config);
  const deliveryFee = promoType === 'free_delivery'
    ? 0
    : calculateDeliveryFee(location, discountedSubtotal, config);
  const tax = calculateTax(discountedSubtotal, location, currency, config);

  const rawTotal = discountedSubtotal + serviceFee + deliveryFee + tax + customizationFeeTotal;
  // NGN has no fractional kobo in practice - round to whole naira so the
  // stored amount_ngn, the order summary display, and Paystack all agree.
  const total = currency === 'NGN'
    ? Math.round(rawTotal)
    : Math.round(rawTotal * 100) / 100;

  return {
    subtotal,
    serviceFee,
    deliveryFee,
    tax,
    discountAmount,
    customizationFee: customizationFeeTotal,
    total,
    currency,
  };
}
