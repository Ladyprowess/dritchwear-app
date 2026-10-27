import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { logEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { CartItem } from '@/contexts/CartContext';

export function useCheckoutCartData(cartData: unknown, showCheckoutNotice: (title: string, message: string) => void) {
  const router = useRouter();
  const posthog = usePostHog();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!cartData) return;

    const run = async () => {
      try {
        const parsedItems: CartItem[] = JSON.parse(cartData as string);
        setItems(parsedItems);

        // The cart remembers the price from when each item was added, but
        // place-order charges the current product price - reprice here so
        // the total shown is the total charged.
        const productIds = [...new Set(parsedItems.map((item) => item.productId).filter(Boolean))];
        if (productIds.length > 0) {
          const { data: products } = await supabase.from('products').select('id, price').in('id', productIds);
          if (products) {
            const priceById = new Map(products.map((p: { id: string; price: number }) => [p.id, Number(p.price)]));
            setItems(parsedItems.map((item) =>
              priceById.has(item.productId) ? { ...item, price: priceById.get(item.productId)! } : item
            ));
          }
        }

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
