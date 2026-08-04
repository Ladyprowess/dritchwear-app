import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { SpecialOffer } from '../types';

export function useSpecialOffer() {
  const [activeOffer, setActiveOffer] = useState<SpecialOffer | null>(null);
  const [showOffer, setShowOffer] = useState(false);

  useEffect(() => {
    const fetchActiveOffer = async () => {
      const { data } = await supabase
        .from('special_offers')
        .select('id, title, subtitle, promo_code')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;
      setActiveOffer(data);
      const seen = await AsyncStorage.getItem(`@dritchwear_offer_seen_${data.id}`);
      if (!seen) setTimeout(() => setShowOffer(true), 700);
    };

    void fetchActiveOffer();
  }, []);

  const dismissOffer = async () => {
    setShowOffer(false);
    if (activeOffer) await AsyncStorage.setItem(`@dritchwear_offer_seen_${activeOffer.id}`, '1');
  };

  return { activeOffer, showOffer, dismissOffer };
}
