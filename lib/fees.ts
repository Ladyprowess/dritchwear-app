// Delivery fees and service fee calculation utilities

export const SERVICE_FEE_PERCENTAGE = 0.02; // 2%

export const DELIVERY_FEES = {
  lagos: 3500,
  outside_lagos: 5000,
  international: 15000,
} as const;

// Currency-specific delivery fees (in local currency)
export const DELIVERY_FEES_BY_CURRENCY: Record<string, { local: number; national: number; international: number }> = {
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

export function calculateDeliveryFee(location: string, currency: string = 'NGN'): number {
  const fees = DELIVERY_FEES_BY_CURRENCY[currency] || DELIVERY_FEES_BY_CURRENCY.NGN;
  
  if (!location) return fees.local;
  
  const normalizedLocation = location.toLowerCase().trim();
  
  // Check for Lagos specifically (for NGN) or local delivery for other currencies
  if (currency === 'NGN' && normalizedLocation.includes('lagos')) {
    return fees.local;
  }
  
  // Check for other Nigerian states/cities (for NGN) or national delivery
  const nigerianStates = [
    'abia', 'adamawa', 'akwa ibom', 'anambra', 'bauchi', 'bayelsa', 'benue', 'borno',
    'cross river', 'delta', 'ebonyi', 'edo', 'ekiti', 'enugu', 'gombe', 'imo',
    'jigawa', 'kaduna', 'kano', 'katsina', 'kebbi', 'kogi', 'kwara', 'nasarawa',
    'niger', 'ogun', 'ondo', 'osun', 'oyo', 'plateau', 'rivers', 'sokoto',
    'taraba', 'yobe', 'zamfara', 'abuja', 'fct'
  ];
  
  const nigerianCities = [
    'abuja', 'kano', 'ibadan', 'kaduna', 'port harcourt', 'benin', 'maiduguri',
    'zaria', 'aba', 'jos', 'ilorin', 'oyo', 'enugu', 'abeokuta', 'abuja',
    'sokoto', 'onitsha', 'warri', 'okene', 'calabar', 'uyo', 'katsina',
    'ado-ekiti', 'awka', 'bauchi', 'akure', 'makurdi', 'lafia', 'gombe',
    'yenagoa', 'jalingo', 'owerri', 'abakaliki', 'dutse', 'damaturu',
    'gusau', 'yola', 'minna', 'birnin kebbi', 'lokoja', 'osogbo'
  ];
  
  // For NGN, check if location is in Nigeria
  if (currency === 'NGN') {
    if (normalizedLocation.includes('nigeria') || 
        nigerianStates.some(state => normalizedLocation.includes(state)) ||
        nigerianCities.some(city => normalizedLocation.includes(city))) {
      return fees.national;
    }
    return fees.international;
  }
  
  // For other currencies, assume national delivery unless specified as international
  if (normalizedLocation.includes('international') || 
      normalizedLocation.includes('worldwide') ||
      normalizedLocation.includes('global')) {
    return fees.international;
  }
  
  return fees.national;
}

export function calculateServiceFee(subtotal: number): number {
  return Math.round(subtotal * SERVICE_FEE_PERCENTAGE * 100) / 100;
}

export function calculateOrderTotal(
  subtotal: number,
  location: string,
  currency: string = 'NGN',
  discountAmount: number = 0
): {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  discountAmount: number;
  total: number;
  currency: string;
} {
  // Note: subtotal should already have discount applied if there is one
  const serviceFee = calculateServiceFee(subtotal);
  const deliveryFee = calculateDeliveryFee(location, currency);
  const total = subtotal + serviceFee + deliveryFee;

  return {
    subtotal,
    serviceFee,
    deliveryFee,
    discountAmount,
    total: Math.round(total * 100) / 100, // Round to 2 decimal places
    currency,
  };
}

// Promo code validation and application
export interface PromoCode {
  code: string;
  description: string;
  discount: number;
  isActive: boolean;
  maxUses?: number;
  currentUses?: number;
  startDate?: Date;
  endDate?: Date;
}

// Hardcoded promo codes for client-side validation
export const PROMO_CODES: Record<string, PromoCode> = {
  'WELCOME10': { code: 'WELCOME10', description: '10% off your order', discount: 0.10, isActive: true },
  'SAVE20': { code: 'SAVE20', description: '20% off your order', discount: 0.20, isActive: true },
  'FIRST15': { code: 'FIRST15', description: '15% off for first-time customers', discount: 0.15, isActive: true },
  'STUDENT': { code: 'STUDENT', description: '12% student discount', discount: 0.12, isActive: true },
  'HOLIDAY25': { code: 'HOLIDAY25', description: '25% holiday special', discount: 0.25, isActive: true },
};

export function validatePromoCode(code: string): PromoCode | null {
  const promoCode = PROMO_CODES[code];
  if (!promoCode || !promoCode.isActive) {
    return null;
  }
  
  // Check date validity if applicable
  const now = new Date();
  if (promoCode.startDate && now < promoCode.startDate) {
    return null;
  }
  if (promoCode.endDate && now > promoCode.endDate) {
    return null;
  }
  
  // Check usage limits if applicable
  if (promoCode.maxUses !== undefined && 
      promoCode.currentUses !== undefined && 
      promoCode.currentUses >= promoCode.maxUses) {
    return null;
  }
  
  return promoCode;
}

export function calculateDiscount(subtotal: number, promoCode: PromoCode): number {
  return subtotal * promoCode.discount;
}