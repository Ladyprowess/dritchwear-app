import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { logEvent } from '@/lib/analytics';
import type { CartItem } from '@/contexts/CartContext';

export function useCheckoutCartData(cartData: unknown, showCheckoutNotice: (title: string, message: string) => void) {
  const router = useRouter();
  const posthog = usePostHog();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!cartData) return;

    const run = async () => {
      try {
        const parsedItems = JSON.parse(cartData as string);
        setItems(parsedItems);

        const totalValue = parsedItems.reduce(
          (sum: number, item: any) => sum + item.price * item.quantity,
          0
        );

        await logEvent('begin_checkout', {
          currency: 'NGN',
          value: totalValue,
          items_count: parsedItems.length,
        });

        posthog.capture('checkout_started', {
          currency: 'NGN',
          value: totalValue,
          items_count: parsedItems.length,
        });

        console.log('✅ Fired begin_checkout event');
      } catch (error) {
        console.error('Error parsing cart data:', error);
        showCheckoutNotice('Error', 'Invalid cart data');
        router.back();
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartData, router]);

  return { items };
}
