import { useEffect, useState } from 'react';
import { convertFromNGN, formatCurrency } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import type { AppliedPromo } from '@/contexts/CartContext';

interface UsePromoCodeArgs {
  profileId: string | undefined;
  userCurrency: string;
  subtotalInUserCurrency: number;
  totalItems: number;
  appliedPromo: AppliedPromo | null;
  setAppliedPromo: (promo: AppliedPromo | null) => Promise<void>;
}

export function usePromoCode({ profileId, userCurrency, subtotalInUserCurrency, totalItems, appliedPromo, setAppliedPromo }: UsePromoCodeArgs) {
  const [promoError, setPromoError] = useState('');
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  const [showPromoDropdown, setShowPromoDropdown] = useState(false);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [validatingPromo, setValidatingPromo] = useState(false);

  useEffect(() => {
    const fetchPromos = async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('is_active', true);

      if (!error) setAvailablePromos(data || []);
    };

    fetchPromos();
  }, []);

  // Check if user has already used this promo code in any completed order
  const checkPromoUsage = async (promoId: string, userId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('promo_code_id', promoId)
      .limit(1);

    if (error) {
      console.error('Error checking promo usage:', error);
      return false;
    }

    return data && data.length > 0;
  };

  const validateExistingPromo = async () => {
    if (!appliedPromo || !profileId) return;

    setValidatingPromo(true);
    try {
      const hasUsed = await checkPromoUsage(appliedPromo.promoId, profileId);

      if (hasUsed) {
        // Remove the promo immediately from context
        await setAppliedPromo(null);
        setPromoError('This promo code has already been used and cannot be applied again');
        setTimeout(() => setPromoError(''), 5000);
      }
    } catch (error) {
      console.error('Error validating existing promo:', error);
      await setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  };

  // Re-validate applied promo when cart screen loads or user changes
  useEffect(() => {
    if (appliedPromo && profileId) {
      validateExistingPromo();
    }
    // Validation intentionally runs only when the promo identity or customer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedPromo?.promoId, profileId]);

  const handleSelectPromo = async (promo: any) => {
    if (!profileId) {
      setPromoError('Please sign in to use promo codes');
      return;
    }

    // Tapping an already-applied promo removes it
    if (appliedPromo?.promoId === promo.id) {
      await setAppliedPromo(null);
      setPromoError('');
      return;
    }

    setApplyingPromo(true);
    setPromoError('');

    try {
      const hasUsedPromo = await checkPromoUsage(promo.id, profileId);
      if (hasUsedPromo) { setPromoError('You have already used this promo code'); return; }

      if (promo.max_usage !== null && promo.used_count >= promo.max_usage) {
        setPromoError('This promo code has reached its usage limit'); return;
      }

      const now = new Date();
      if (promo.expires_at && new Date(promo.expires_at) < now) {
        setPromoError('This promo code has expired'); return;
      }

      if (promo.min_order_amount && subtotalInUserCurrency < convertFromNGN(promo.min_order_amount, userCurrency)) {
        setPromoError(`Minimum order of ${formatCurrency(convertFromNGN(promo.min_order_amount, userCurrency), userCurrency)} required`);
        return;
      }

      if (promo.min_quantity && totalItems < promo.min_quantity) {
        setPromoError(`Add at least ${promo.min_quantity} items to use this code`);
        return;
      }

      if (promo.first_time_only) {
        const { count, error: countError } = await supabase
          .from('orders').select('id', { count: 'exact', head: true }).eq('user_id', profileId);
        if (countError) { setPromoError('Could not validate eligibility. Please try again.'); return; }
        if ((count || 0) > 0) { setPromoError('This promo code is for first-time users only'); return; }
      }

      await setAppliedPromo({
        code: promo.code,
        discount: promo.discount_percentage / 100,
        description: promo.description || (
          promo.type === 'free_delivery'
            ? 'Free Delivery!'
            : promo.type === 'item_percentage'
            ? `${promo.discount_percentage}% off selected item`
            : `${promo.discount_percentage}% off`
        ),
        promoId: promo.id,
        type: (promo.type ?? 'percentage') as 'percentage' | 'free_delivery' | 'item_percentage',
        productId: promo.applicable_product_id ?? undefined,
      });

      setShowPromoDropdown(false);
    } catch (e) {
      console.error('Error applying promo code:', e);
      setPromoError('Error applying promo code. Please try again.');
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleRemovePromo = async () => {
    await setAppliedPromo(null);
    setPromoError('');
  };

  return {
    promoError,
    setPromoError,
    availablePromos,
    showPromoDropdown,
    setShowPromoDropdown,
    applyingPromo,
    validatingPromo,
    checkPromoUsage,
    handleSelectPromo,
    handleRemovePromo,
  };
}
