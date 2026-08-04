import { useEffect, useState } from 'react';
import { usePostHog } from 'posthog-react-native';
import { supabase } from '@/lib/supabase';
import { convertFromNGN, formatCurrency } from '@/lib/currency';
import type { AppliedPromo } from '@/contexts/CartContext';
import type { Profile } from '@/lib/auth';
import type { AvailableOffer } from '../types';

interface UseCheckoutOffersArgs {
  user: { id: string } | null;
  profile: Profile | null;
  appliedPromo: AppliedPromo | null;
  setAppliedPromo: (promo: AppliedPromo | null) => Promise<void>;
  userCurrency: string;
  getSubtotalInNGN: () => number;
  getTotalItems: () => number;
  showCheckoutNotice: (title: string, message: string) => void;
}

export function useCheckoutOffers({
  user,
  profile,
  appliedPromo,
  setAppliedPromo,
  userCurrency,
  getSubtotalInNGN,
  getTotalItems,
  showCheckoutNotice,
}: UseCheckoutOffersArgs) {
  const posthog = usePostHog();
  const [availableOffers, setAvailableOffers] = useState<AvailableOffer[]>([]);
  const [showOffers, setShowOffers] = useState(false);
  const [applyingOffer, setApplyingOffer] = useState(false);

  // Fetch active promo codes to display as available offers
  useEffect(() => {
    const fetchOffers = async () => {
      const { data } = await supabase
        .from('promo_codes')
        .select('id, code, discount_percentage, description')
        .eq('is_active', true)
        .order('discount_percentage', { ascending: false });
      if (data) setAvailableOffers(data as AvailableOffer[]);
    };
    fetchOffers();
  }, []);

  const handleApplyOffer = async (offer: AvailableOffer) => {
    if (appliedPromo?.code === offer.code) {
      // Already applied - remove it
      await setAppliedPromo(null);
      return;
    }
    setApplyingOffer(true);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', offer.code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) { showCheckoutNotice('Invalid', 'This offer is no longer available.'); return; }

      // Enforce the full promo-code settings (mirrors cart validation) so offers
      // tapped here cannot bypass expiry, usage, minimum-order or eligibility rules.
      if (!user || !profile) {
        showCheckoutNotice('Sign in required', 'Please sign in to use offers.'); return;
      }

      const now = new Date();
      if (data.expires_at && new Date(data.expires_at) < now) {
        showCheckoutNotice('Expired', 'This offer has expired.'); return;
      }
      if (data.max_usage != null && (data.used_count ?? 0) >= data.max_usage) {
        showCheckoutNotice('Unavailable', 'This offer has reached its usage limit.'); return;
      }

      // Already redeemed by this customer on a previous order?
      const { data: prior, error: priorErr } = await supabase
        .from('orders').select('id').eq('user_id', user.id).eq('promo_code_id', data.id).limit(1);
      if (priorErr) { showCheckoutNotice('Error', 'Could not validate this offer. Please try again.'); return; }
      if (prior && prior.length > 0) { showCheckoutNotice('Already used', 'You have already used this offer.'); return; }

      // Minimum order (stored in NGN, the source of truth).
      if (data.min_order_amount && getSubtotalInNGN() < data.min_order_amount) {
        const minInUserCurrency = userCurrency === 'NGN'
          ? data.min_order_amount
          : convertFromNGN(data.min_order_amount, userCurrency);
        showCheckoutNotice('Minimum order not met', `This offer needs a minimum order of ${formatCurrency(minInUserCurrency, userCurrency)}.`); return;
      }

      // Minimum quantity (e.g. free delivery on 3+ items).
      if (data.min_quantity && getTotalItems() < data.min_quantity) {
        showCheckoutNotice('Add more items', `This offer needs at least ${data.min_quantity} item${data.min_quantity > 1 ? 's' : ''} in your order.`); return;
      }

      // First-time customers only.
      if (data.first_time_only) {
        const { count, error: countError } = await supabase
          .from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        if (countError) { showCheckoutNotice('Error', 'Could not validate eligibility. Please try again.'); return; }
        if ((count || 0) > 0) { showCheckoutNotice('First-time users only', 'This offer is for first-time customers only.'); return; }
      }

      await setAppliedPromo({
        code: data.code,
        discount: data.discount_percentage / 100,
        description: data.type === 'free_delivery'
          ? 'Free Delivery!'
          : data.type === 'item_percentage'
          ? `${data.discount_percentage}% off selected item`
          : `${data.discount_percentage}% off`,
        promoId: data.id,
        type: (data.type ?? 'percentage') as 'percentage' | 'free_delivery' | 'item_percentage',
        productId: data.applicable_product_id ?? undefined,
      });
      posthog.capture('promo_code_applied', {
        promo_code: data.code,
        discount_percentage: data.discount_percentage,
        promo_type: data.type ?? 'percentage',
      });
      setShowOffers(false);
    } catch {
      showCheckoutNotice('Error', 'Could not apply offer. Please try again.');
    } finally {
      setApplyingOffer(false);
    }
  };

  return {
    availableOffers,
    showOffers,
    setShowOffers,
    applyingOffer,
    handleApplyOffer,
  };
}
