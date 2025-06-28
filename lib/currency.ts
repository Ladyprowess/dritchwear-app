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
    throw new Error(`Exchange rate not found for currency: ${targetCurrency}`);
  }
  return Math.round((amountInNGN * rate) * 100) / 100; // Round to 2 decimal places
}

export function convertToNGN(amount: number, fromCurrency: string): number {
  const rate = EXCHANGE_RATES[fromCurrency];
  if (!rate) {
    throw new Error(`Exchange rate not found for currency: ${fromCurrency}`);
  }
  return Math.round((amount / rate) * 100) / 100; // Round to 2 decimal places
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = getCurrencyByCode(currencyCode);
  if (!currency) {
    return `${amount}`;
  }

  // Special formatting for different currencies
  switch (currencyCode) {
    case 'JPY':
    case 'KRW':
      // No decimal places for these currencies
      return `${currency.symbol}${Math.round(amount).toLocaleString()}`;
    case 'NGN':
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
      }).format(amount);
    default:
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(amount);
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