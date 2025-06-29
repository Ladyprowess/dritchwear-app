import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (items: CartItem[]) => Promise<void>;
  updateQuantity: (index: number, quantity: number) => Promise<void>;
  removeItem: (index: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getTotalItems: () => number;
  getSubtotal: () => number;
  loading: boolean;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: async () => {},
  updateQuantity: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
  getTotalItems: () => 0,
  getSubtotal: () => 0,
  loading: false,
});

const CART_STORAGE_KEY = '@dritchwear_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load cart from storage on app start
  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);
        setItems(parsedCart);
        console.log('✅ Cart loaded from storage:', parsedCart.length, 'items');
      }
    } catch (error) {
      console.error('❌ Error loading cart:', error);
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

  const addToCart = async (newItems: CartItem[]) => {
    const updatedItems = [...items];
    
    newItems.forEach(newItem => {
      // Check if this combination already exists
      const existingIndex = updatedItems.findIndex(item => 
        item.productId === newItem.productId && 
        item.size === newItem.size && 
        item.color === newItem.color
      );
      
      if (existingIndex >= 0) {
        // Update quantity if item exists
        updatedItems[existingIndex].quantity += newItem.quantity;
      } else {
        // Add new item
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
    await saveCart([]);
    console.log('🗑️ Cart cleared');
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
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
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