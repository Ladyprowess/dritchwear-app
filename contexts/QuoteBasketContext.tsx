import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QuoteBasketItem {
  productId: string;
  productName: string;
  photoUrl: string | null;
  quantity: number;
  /** 'package' items are priced per-person (event packages), not per-piece. */
  type?: 'product' | 'package';
}

interface QuoteBasketContextType {
  items: QuoteBasketItem[];
  addItem: (item: QuoteBasketItem) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  getTotalPieces: () => number;
  loading: boolean;
}

const STORAGE_KEY = 'dritchwear:quote_basket';

const QuoteBasketContext = createContext<QuoteBasketContextType>({
  items: [],
  addItem: async () => {},
  updateQuantity: async () => {},
  removeItem: async () => {},
  clear: async () => {},
  getTotalPieces: () => 0,
  loading: false,
});

export function QuoteBasketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<QuoteBasketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setItems(JSON.parse(raw));
      } catch {
        // Best effort - an empty basket is a safe fallback.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (next: QuoteBasketItem[]) => {
    setItems(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best effort.
    }
  };

  const addItem = async (item: QuoteBasketItem) => {
    const existing = items.find((i) => i.productId === item.productId);
    if (existing) {
      await persist(items.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i)));
    } else {
      await persist([...items, item]);
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(productId);
      return;
    }
    await persist(items.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  };

  const removeItem = async (productId: string) => {
    await persist(items.filter((i) => i.productId !== productId));
  };

  const clear = async () => {
    await persist([]);
  };

  const getTotalPieces = () => items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <QuoteBasketContext.Provider value={{ items, addItem, updateQuantity, removeItem, clear, getTotalPieces, loading }}>
      {children}
    </QuoteBasketContext.Provider>
  );
}

export function useQuoteBasket() {
  return useContext(QuoteBasketContext);
}
