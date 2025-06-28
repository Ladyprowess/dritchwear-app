// Currency conversion and management utilities

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  isDefault?: boolean;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬', isDefault: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', flag: '🇬🇭' },
];

// Exchange rates relative to NGN (Nigerian Naira as base)
// In production, these should be fetched from a real-time API
export const EXCHANGE_RATES: Record<string, number> = {
  NGN: 1, // Base currency
  USD: 0.00067, // 1 NGN = 0.00067 USD (approximately 1500 NGN = 1 USD)
  EUR: 0.00061, // 1 NGN = 0.00061 EUR
  GBP: 0.00053, // 1 NGN = 0.00053 GBP
  CAD: 0.00091, // 1 NGN = 0.00091 CAD
  AUD: 0.00099, // 1 NGN = 0.00099 AUD
  JPY: 0.097, // 1 NGN = 0.097 JPY
  CHF: 0.00059, // 1 NGN = 0.00059 CHF
  CNY: 0.0048, // 1 NGN = 0.0048 CNY
  INR: 0.056, // 1 NGN = 0.056 INR
  ZAR: 0.012, // 1 NGN = 0.012 ZAR
  KES: 0.086, // 1 NGN = 0.086 KES
  GHS: 0.0099, // 1 NGN = 0.0099 GHS
};

export function getCurrencyByCode(code: string): Currency | undefined {
  return SUPPORTED_CURRENCIES.find(currency => currency.code === code);
}

export function getDefaultCurrency(): Currency {
  return SUPPORTED_CURRENCIES.find(currency => currency.isDefault) || SUPPORTED_CURRENCIES[0];
}

export function convertFromNGN(amountInNGN: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES[targetCurrency];
  if (!rate) {
    console.warn(`Exchange rate not found for currency: ${targetCurrency}, using NGN rate`);
    return amountInNGN;
  }
  return Math.round((amountInNGN * rate) * 100) / 100; // Round to 2 decimal places
}

export function convertToNGN(amount: number, fromCurrency: string): number {
  const rate = EXCHANGE_RATES[fromCurrency];
  if (!rate) {
    console.warn(`Exchange rate not found for currency: ${fromCurrency}, using direct amount`);
    return amount;
  }
  return Math.round((amount / rate) * 100) / 100; // Round to 2 decimal places
}

export function formatCurrency(amount: number, currencyCode: string): string {
  if (isNaN(amount)) {
    console.warn(`Invalid amount for formatting: ${amount}`);
    amount = 0;
  }
  
  const currency = getCurrencyByCode(currencyCode);
  if (!currency) {
    console.warn(`Unknown currency code: ${currencyCode}, using plain number`);
    return `${amount.toFixed(2)}`;
  }

  // Special formatting for different currencies
  switch (currencyCode) {
    case 'JPY':
    case 'KRW':
      // No decimal places for these currencies
      return `${currency.symbol}${Math.round(amount).toLocaleString()}`;
    case 'NGN':
      return `₦${amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    case 'KES':
      return `KES ${amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;
    default:
      // Use Intl.NumberFormat for consistent formatting
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch (error) {
        // Fallback if Intl.NumberFormat fails
        console.warn(`Error formatting currency ${currencyCode}:`, error);
        return `${currency.symbol}${amount.toFixed(2)}`;
      }
  }
}

export function getPaymentProvider(currencyCode: string): 'paystack' | 'paypal' {
  return currencyCode === 'NGN' ? 'paystack' : 'paypal';
}

export function isNairaCurrency(currencyCode: string): boolean {
  return currencyCode === 'NGN';
}

// Get minimum order amounts for different currencies
export function getMinimumOrderAmount(currencyCode: string): number {
  switch (currencyCode) {
    case 'NGN':
      return 1000; // ₦1,000
    case 'USD':
      return 1; // $1
    case 'EUR':
      return 1; // €1
    case 'GBP':
      return 1; // £1
    case 'CAD':
      return 1; // C$1
    case 'AUD':
      return 1; // A$1
    case 'JPY':
      return 100; // ¥100
    case 'CHF':
      return 1; // CHF 1
    case 'CNY':
      return 5; // ¥5
    case 'INR':
      return 50; // ₹50
    case 'ZAR':
      return 10; // R10
    case 'KES':
      return 100; // KSh100
    case 'GHS':
      return 5; // ₵5
    default:
      return 1;
  }
}

// Update exchange rates (in production, this would fetch from an API)
export async function updateExchangeRates(): Promise<void> {
  // In production, implement API call to get real-time rates
  // For now, we'll use static rates
  console.log('Exchange rates updated (using static rates for demo)');
}

// Format budget range in user's preferred currency
export function formatBudgetRange(budgetRange: string, preferredCurrency: string): string {
  // Parse the budget range from NGN format (e.g., "₦10,000 - ₦25,000")
  const matches = budgetRange.match(/₦([\d,]+)\s*-\s*₦([\d,]+)/);
  
  if (!matches || matches.length < 3) {
    // If not in expected format, return as is
    return budgetRange;
  }
  
  // Parse the min and max values, removing commas
  const minNGN = parseFloat(matches[1].replace(/,/g, ''));
  const maxNGN = parseFloat(matches[2].replace(/,/g, ''));
  
  if (isNaN(minNGN) || isNaN(maxNGN)) {
    return budgetRange;
  }
  
  // If already in NGN and preferred currency is NGN, return as is
  if (preferredCurrency === 'NGN') {
    return budgetRange;
  }
  
  // Convert to preferred currency
  const minConverted = convertFromNGN(minNGN, preferredCurrency);
  const maxConverted = convertFromNGN(maxNGN, preferredCurrency);
  
  // Format the values in the preferred currency
  return `${formatCurrency(minConverted, preferredCurrency)} - ${formatCurrency(maxConverted, preferredCurrency)}`;
}

// Parse budget range from any currency to NGN for storage
export function parseBudgetRangeToNGN(budgetRange: string, fromCurrency: string): string {
  if (fromCurrency === 'NGN') {
    return budgetRange;
  }
  
  // Try to extract numeric values from the budget range
  // This regex should match patterns like "$10 - $25", "€10-€25", "10 USD - 25 USD", etc.
  const regex = /(\d[\d,.]*)\s*(?:[^\d\s-]+)?\s*-\s*(\d[\d,.]*)/;
  const matches = budgetRange.match(regex);
  
  if (!matches || matches.length < 3) {
    // If not in expected format, return as is
    return budgetRange;
  }
  
  // Parse the min and max values, removing commas
  const minValue = parseFloat(matches[1].replace(/,/g, ''));
  const maxValue = parseFloat(matches[2].replace(/,/g, ''));
  
  if (isNaN(minValue) || isNaN(maxValue)) {
    return budgetRange;
  }
  
  // Convert to NGN
  const minNGN = convertToNGN(minValue, fromCurrency);
  const maxNGN = convertToNGN(maxValue, fromCurrency);
  
  // Format as NGN budget range
  return `₦${Math.round(minNGN).toLocaleString()} - ₦${Math.round(maxNGN).toLocaleString()}`;
}

// Parse KES budget range to customer's preferred currency
export function parseKESBudgetRange(budgetRange: string, targetCurrency: string): string {
  // Check if the budget range is in KES format (e.g., "KES 860.00 - KES 2,150.00")
  const kesRegex = /KES\s+([\d,.]+)\s*-\s*KES\s+([\d,.]+)/;
  const matches = budgetRange.match(kesRegex);
  
  if (!matches || matches.length < 3) {
    // If not in expected format, return as is
    return budgetRange;
  }
  
  // Parse the min and max values, removing commas
  const minKES = parseFloat(matches[1].replace(/,/g, ''));
  const maxKES = parseFloat(matches[2].replace(/,/g, ''));
  
  if (isNaN(minKES) || isNaN(maxKES)) {
    return budgetRange;
  }
  
  // If target currency is already KES, return formatted
  if (targetCurrency === 'KES') {
    return `KES ${minKES.toLocaleString()} - KES ${maxKES.toLocaleString()}`;
  }
  
  // Convert KES to NGN first (intermediate step)
  const minNGN = convertToNGN(minKES, 'KES');
  const maxNGN = convertToNGN(maxKES, 'KES');
  
  // Then convert NGN to target currency
  const minTarget = convertFromNGN(minNGN, targetCurrency);
  const maxTarget = convertFromNGN(maxNGN, targetCurrency);
  
  // Format in target currency
  return `${formatCurrency(minTarget, targetCurrency)} - ${formatCurrency(maxTarget, targetCurrency)}`;
}

// Generate a budget range in the user's preferred currency
export function generateBudgetRanges(preferredCurrency: string): string[] {
  if (preferredCurrency === 'NGN') {
    return [
      '₦10,000 - ₦25,000',
      '₦25,000 - ₦50,000',
      '₦50,000 - ₦100,000',
      '₦100,000 - ₦200,000',
      '₦200,000+'
    ];
  }
  
  const currency = getCurrencyByCode(preferredCurrency);
  if (!currency) {
    return [
      '₦10,000 - ₦25,000',
      '₦25,000 - ₦50,000',
      '₦50,000 - ₦100,000',
      '₦100,000 - ₦200,000',
      '₦200,000+'
    ];
  }
  
  // Convert NGN ranges to preferred currency
  const ranges = [
    [10000, 25000],
    [25000, 50000],
    [50000, 100000],
    [100000, 200000]
  ];
  
  const formattedRanges = ranges.map(([min, max]) => {
    const minConverted = convertFromNGN(min, preferredCurrency);
    const maxConverted = convertFromNGN(max, preferredCurrency);
    
    // Round to appropriate values based on currency
    const roundedMin = Math.round(minConverted);
    const roundedMax = Math.round(maxConverted);
    
    return `${formatCurrency(roundedMin, preferredCurrency)} - ${formatCurrency(roundedMax, preferredCurrency)}`;
  });
  
  // Add the "plus" range
  const highestMin = convertFromNGN(200000, preferredCurrency);
  formattedRanges.push(`${formatCurrency(Math.round(highestMin), preferredCurrency)}+`);
  
  return formattedRanges;
}