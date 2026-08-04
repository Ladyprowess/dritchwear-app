import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface CartItem {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  /** Optional customer special request / preference for this item. */
  note?: string;
  /** Optional customer-uploaded logo image URL (when the product allows it). */
  logoUrl?: string;
}

export interface AppliedPromo {
  code: string;
  discount: number;         // 0–1 fraction (for percentage types; 0 for free_delivery)
  description: string;
  promoId: string;
  type: 'percentage' | 'free_delivery' | 'item_percentage';
  productId?: string;       // set for item_percentage only
}

interface CartContextType {
  items: CartItem[];
  appliedPromo: AppliedPromo | null;
  addToCart: (items: CartItem[]) => Promise<void>;
  updateQuantity: (index: number, quantity: number) => Promise<void>;
  removeItem: (index: number) => Promise<void>;
  clearCart: () => Promise<void>;
  setAppliedPromo: (promo: AppliedPromo | null) => Promise<void>;
  getTotalItems: () => number;
  getSubtotal: () => number;
  loading: boolean;
}

const CartContext = createContext<CartContextType>({
  items: [],
  appliedPromo: null,
  addToCart: async () => {},
  updateQuantity: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
  setAppliedPromo: async () => {},
  getTotalItems: () => 0,
  getSubtotal: () => 0,
  loading: false,
});

const CART_STORAGE_KEY = '@dritchwear_cart';
const PROMO_STORAGE_KEY = '@dritchwear_applied_promo';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [appliedPromo, setAppliedPromoState] = useState<AppliedPromo | null>(null);
  const [loading, setLoading] = useState(true);

  // Load cart and promo from storage on app start
  useEffect(() => {
    loadCartAndPromo();
  }, []);

  useEffect(() => {
    if (loading || !user?.id) return;
    const timer = setTimeout(() => {
      const active = items.length > 0;
      void supabase.from('cart_sessions').upsert({
        user_id: user.id,
        items,
        item_count: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal_ngn: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        status: active ? 'active' : 'cleared',
        first_reminder_at: null,
        second_reminder_at: null,
        final_reminder_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) console.warn('Cart recovery sync failed:', error.message);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [items, loading, user?.id]);

  const loadCartAndPromo = async () => {
    try {
      const [storedCart, storedPromo] = await Promise.all([
        AsyncStorage.getItem(CART_STORAGE_KEY),
        AsyncStorage.getItem(PROMO_STORAGE_KEY)
      ]);

      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);
        setItems(parsedCart);
        console.log('✅ Cart loaded from storage:', parsedCart.length, 'items');
      }

      if (storedPromo) {
        const parsedPromo = JSON.parse(storedPromo);
        setAppliedPromoState(parsedPromo);
        console.log('✅ Promo loaded from storage:', parsedPromo.code);
      }
    } catch (error) {
      console.error('❌ Error loading cart/promo:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCart = async (cartItems: CartItem[]) => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
      console.log('💾 Cart saved to storage:', cartItems.length, 'items');
    } catch (error) {
      console.error('❌ Error saving cart:', error);
    }
  };

  const savePromo = async (promo: AppliedPromo | null) => {
    try {
      if (promo) {
        await AsyncStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(promo));
        console.log('💾 Promo saved to storage:', promo.code);
      } else {
        await AsyncStorage.removeItem(PROMO_STORAGE_KEY);
        console.log('🗑️ Promo removed from storage');
      }
    } catch (error) {
      console.error('❌ Error saving promo:', error);
    }
  };

  const setAppliedPromo = async (promo: AppliedPromo | null) => {
    setAppliedPromoState(promo);
    await savePromo(promo);
  };

  const addToCart = async (newItems: CartItem[]) => {
    const updatedItems = [...items];
    
    newItems.forEach(newItem => {
      const existingIndex = updatedItems.findIndex(item =>
        item.productId === newItem.productId &&
        item.size === newItem.size &&
        item.color === newItem.color &&
        (item.note ?? '') === (newItem.note ?? '') &&
        (item.logoUrl ?? '') === (newItem.logoUrl ?? '')
      );
      
      if (existingIndex >= 0) {
        updatedItems[existingIndex].quantity += newItem.quantity;
      } else {
        updatedItems.push(newItem);
      }
    });

    setItems(updatedItems);
    await saveCart(updatedItems);
    console.log('🛒 Added to cart:', newItems.length, 'items');
  };

  const updateQuantity = async (index: number, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(index);
      return;
    }

    const updatedItems = [...items];
    updatedItems[index].quantity = quantity;
    setItems(updatedItems);
    await saveCart(updatedItems);
  };

  const removeItem = async (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    await saveCart(updatedItems);
  };

  const clearCart = async () => {
    setItems([]);
    setAppliedPromoState(null);
    await Promise.all([
      saveCart([]),
      savePromo(null)
    ]);
    console.log('🗑️ Cart and promo cleared');
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        appliedPromo,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        setAppliedPromo,
        getTotalItems,
        getSubtotal,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
