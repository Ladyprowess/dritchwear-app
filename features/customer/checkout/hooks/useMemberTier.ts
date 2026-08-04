import { useEffect, useState } from 'react';
import { getOwnedPieceCount, getTier } from '@/lib/wardrobe';

// Wardrobe-level perk enforcement: Gold+ members get free delivery.
export function useMemberTier(userId: string | undefined) {
  const [memberTier, setMemberTier] = useState<{ name: string; freeDelivery: boolean } | null>(null);

  useEffect(() => {
    if (!userId) { setMemberTier(null); return; }
    let active = true;
    getOwnedPieceCount(userId).then((count) => {
      if (!active) return;
      const tier = getTier(count);
      setMemberTier({ name: tier.name, freeDelivery: tier.freeDelivery });
    });
    return () => { active = false; };
  }, [userId]);

  return { memberTier, memberFreeDelivery: !!memberTier?.freeDelivery };
}
