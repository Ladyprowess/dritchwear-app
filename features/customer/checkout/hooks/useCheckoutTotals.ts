import { calculateOrderTotal, calculateServiceFee, calculateCustomizationFeeTotal, type CommerceConfig } from '@/lib/fees';
import { convertFromNGN } from '@/lib/currency';
import type { CartItem, AppliedPromo } from '@/contexts/CartContext';
import { calculateDiscountNGN } from '../pricing';

interface UseCheckoutTotalsArgs {
  items: CartItem[];
  appliedPromo: AppliedPromo | null;
  config: CommerceConfig;
  userCurrency: string;
  deliveryAddress: string;
  deliveryState: string;
  deliveryCountry: string;
  memberFreeDelivery: boolean;
}

export function useCheckoutTotals({
  items,
  appliedPromo,
  config,
  userCurrency,
  deliveryAddress,
  deliveryState,
  deliveryCountry,
  memberFreeDelivery,
}: UseCheckoutTotalsArgs) {
  const getTotalItems = () => items.reduce((sum, item) => sum + item.quantity, 0);

  const getSubtotalInNGN = () => items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const hasDeliveryAddress = () =>
    deliveryAddress.trim().length > 0 &&
    deliveryState.trim().length > 0 &&
    deliveryCountry.trim().length > 0;

  const getFullDeliveryAddress = () =>
    `${deliveryAddress.trim()}, ${deliveryState.trim()}, ${deliveryCountry.trim()}`;

  // Delivery is free when the applied promo grants it OR the member's tier does.
  const effectivePromoType = (promoType?: string) =>
    memberFreeDelivery ? 'free_delivery' : promoType;

  const subtotalNGN = getSubtotalInNGN();
  const discountNGN = calculateDiscountNGN(items, appliedPromo, subtotalNGN);
  const discountedSubtotalNGN = subtotalNGN - discountNGN;

  // Only calculate delivery fee if address is provided
  const composedAddress = hasDeliveryAddress() ? getFullDeliveryAddress() : '';
  const noAddrServiceFee = calculateServiceFee(discountedSubtotalNGN, config);
  const customizationFeeTotal = calculateCustomizationFeeTotal(items, config);

  const orderTotals = hasDeliveryAddress()
    ? calculateOrderTotal(discountedSubtotalNGN, composedAddress, 'NGN', 0, effectivePromoType(appliedPromo?.type), config, customizationFeeTotal)
    : {
        subtotal: discountedSubtotalNGN,
        serviceFee: noAddrServiceFee,
        deliveryFee: 0,
        tax: 0,
        discountAmount: discountNGN,
        customizationFee: customizationFeeTotal,
        total: Math.round((discountedSubtotalNGN + noAddrServiceFee + customizationFeeTotal) * 100) / 100,
        currency: 'NGN',
      };

  // Convert to user currency for display
  const displayTotals = {
    subtotal: userCurrency === 'NGN' ? subtotalNGN : convertFromNGN(subtotalNGN, userCurrency),
    discount: userCurrency === 'NGN' ? discountNGN : convertFromNGN(discountNGN, userCurrency),
    serviceFee: userCurrency === 'NGN' ? orderTotals.serviceFee : convertFromNGN(orderTotals.serviceFee, userCurrency),
    deliveryFee: userCurrency === 'NGN' ? orderTotals.deliveryFee : convertFromNGN(orderTotals.deliveryFee, userCurrency),
    tax: userCurrency === 'NGN' ? orderTotals.tax : convertFromNGN(orderTotals.tax, userCurrency),
    customizationFee: userCurrency === 'NGN' ? orderTotals.customizationFee : convertFromNGN(orderTotals.customizationFee, userCurrency),
    total: userCurrency === 'NGN' ? orderTotals.total : convertFromNGN(orderTotals.total, userCurrency),
  };

  return {
    getTotalItems,
    getSubtotalInNGN,
    hasDeliveryAddress,
    getFullDeliveryAddress,
    effectivePromoType,
    subtotalNGN,
    discountNGN,
    discountedSubtotalNGN,
    orderTotals,
    displayTotals,
  };
}
