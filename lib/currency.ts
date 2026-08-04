// Currency conversion and management utilities

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  isDefault?: boolean;
}

// Only Paystack-accepted currencies are supported
export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬', isDefault: true },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', flag: '🇬🇭' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
];

// Exchange rates relative to NGN (Nigerian Naira as base)
export const EXCHANGE_RATES: Record<string, number> = {
  NGN: 1,       // Base currency
  GHS: 0.007,   // 1 NGN ≈ 0.007 GHS (1 GHS ≈ 143 NGN)
  ZAR: 0.012,   // 1 NGN ≈ 0.012 ZAR (1 ZAR ≈ 83 NGN)
  USD: 0.00067, // 1 NGN ≈ 0.00067 USD (1 USD ≈ 1500 NGN)
  KES: 0.087,   // 1 NGN ≈ 0.087 KES (1 KES ≈ 11.5 NGN)
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

// Composed helper used by checkout/cart/shop to price a line item in the
// customer's preferred currency. Was reimplemented separately (identically)
// in all three screens as getItemPriceInUserCurrency/getProductPriceInUserCurrency.
export function getItemPriceInUserCurrency(priceInNGN: number, preferredCurrency?: string | null): number {
  if (!preferredCurrency || preferredCurrency === 'NGN') {
    return priceInNGN;
  }
  return convertFromNGN(priceInNGN, preferredCurrency);
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
    case 'NGN':
      return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case 'GHS':
      return `₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'KES':
      return `KSh ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case 'ZAR':
      return `R ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// All displayed currencies are Paystack-accepted
export function getPaymentProvider(currencyCode: string): 'paystack' | 'unavailable' {
  const paystackCurrencies = ['NGN', 'GHS', 'ZAR', 'USD', 'KES'];
  return paystackCurrencies.includes(currencyCode) ? 'paystack' : 'unavailable';
}

export function isNairaCurrency(currencyCode: string): boolean {
  return currencyCode === 'NGN';
}

// Card payments (Paystack) only work in NGN for now.
// Other currencies must use the wallet.
export function canPayByCard(currencyCode: string): boolean {
  return currencyCode === 'NGN';
}

// Get minimum order amounts for different currencies
export function getMinimumOrderAmount(currencyCode: string): number {
  switch (currencyCode) {
    case 'NGN': return 1000;   // ₦1,000
    case 'GHS': return 10;     // ₵10
    case 'ZAR': return 20;     // R20
    case 'USD': return 1;      // $1
    case 'KES': return 150;    // KSh150
    default: return 1;
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