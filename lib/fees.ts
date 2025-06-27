export const SERVICE_FEE_PERCENTAGE = 0.02; // 2%

export const DELIVERY_FEES = {
  lagos: 3500,
  outside_lagos: 5000,
  international: 15000,
} as const;

export function calculateDeliveryFee(location: string): number {
  if (!location) return DELIVERY_FEES.lagos;
  
  const normalizedLocation = location.toLowerCase().trim();
  
  // Check for Lagos specifically
  if (normalizedLocation.includes('lagos')) {
    return DELIVERY_FEES.lagos;
  }
  
  // Check for other Nigerian states/cities
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
  
  // Check if location contains Nigeria or any Nigerian state/city
  if (normalizedLocation.includes('nigeria') || 
      nigerianStates.some(state => normalizedLocation.includes(state)) ||
      nigerianCities.some(city => normalizedLocation.includes(city))) {
    return DELIVERY_FEES.outside_lagos;
  }
  
  // If not in Nigeria, international shipping
  return DELIVERY_FEES.international;
}

export function calculateServiceFee(subtotal: number): number {
  return Math.round(subtotal * SERVICE_FEE_PERCENTAGE);
}

export function calculateOrderTotal(
  subtotal: number,
  location: string,
  discountAmount: number = 0
): {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  discountAmount: number;
  total: number;
} {
  const discountedSubtotal = subtotal - discountAmount;
  const serviceFee = calculateServiceFee(discountedSubtotal);
  const deliveryFee = calculateDeliveryFee(location);
  const total = discountedSubtotal + serviceFee + deliveryFee;

  return {
    subtotal,
    serviceFee,
    deliveryFee,
    discountAmount,
    total,
  };
}