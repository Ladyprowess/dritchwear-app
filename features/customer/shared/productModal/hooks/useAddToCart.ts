import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { PostHog } from 'posthog-react-native';
import type { StoreProduct } from '@/types/product';
import type { ProductImage } from '../types';

interface AddToCartItem {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  note?: string;
  logoUrl?: string;
}

interface UseAddToCartArgs {
  product: StoreProduct | null;
  productImages: ProductImage[];
  lockedTier: string | null;
  addToCart: (items: AddToCartItem[]) => Promise<void>;
  posthog: Pick<PostHog, 'capture'>;
  onContinueShopping: () => void;
  onViewCart: () => void;
  // Mirrors the original resetModal() call after a successful add: clears
  // size/color/note/quantity/logo selections plus images/reviews state, all
  // owned outside this hook (by the shell and useProductModalData).
  onAddedToCart: () => void;
}

export function useAddToCart({ product, productImages, lockedTier, addToCart, posthog, onContinueShopping, onViewCart, onAddedToCart }: UseAddToCartArgs) {
  const [loading, setLoading] = useState(false);
  const [cartError, setCartError] = useState('');
  const [showCartConfirmation, setShowCartConfirmation] = useState(false);
  const [addedItemsCount, setAddedItemsCount] = useState(0);

  const closeCartConfirmation = () => {
    setShowCartConfirmation(false);
    setAddedItemsCount(0);
  };

  const handleAddToCart = async (
    selectedSizes: string[],
    selectedColors: string[],
    quantity: number,
    note: string,
    logoUrl: string | null
  ) => {
    setCartError('');
    if (!product) return;
    if (lockedTier) { setCartError(`This piece is for ${lockedTier} members and above.`); return; }

    const sizesRequired = product.sizes && product.sizes.length > 0;
    const colorsRequired = product.colors && product.colors.length > 0;

    if (sizesRequired && selectedSizes.length === 0) {
      Alert.alert('Size Required', 'Please select at least one size');
      return;
    }

    if (colorsRequired && selectedColors.length === 0) {
      Alert.alert('Color Required', 'Please select at least one color');
      return;
    }

    setLoading(true);

    try {
      const newItems: AddToCartItem[] = [];

      if (sizesRequired && colorsRequired) {
        selectedSizes.forEach(size => {
          selectedColors.forEach(color => {
            newItems.push({
              productId: product.id,
              productName: product.name,
              productImage: productImages[0]?.image_url || product.image_url,
              price: product.price,
              size,
              color,
              quantity
            });
          });
        });
      } else if (sizesRequired) {
        selectedSizes.forEach(size => {
          newItems.push({
            productId: product.id,
            productName: product.name,
            productImage: productImages[0]?.image_url || product.image_url,
            price: product.price,
            size,
            color: 'N/A',
            quantity
          });
        });
      } else if (colorsRequired) {
        selectedColors.forEach(color => {
          newItems.push({
            productId: product.id,
            productName: product.name,
            productImage: productImages[0]?.image_url || product.image_url,
            price: product.price,
            size: 'N/A',
            color,
            quantity
          });
        });
      } else {
        newItems.push({
          productId: product.id,
          productName: product.name,
          productImage: productImages[0]?.image_url || product.image_url,
          price: product.price,
          size: 'N/A',
          color: 'N/A',
          quantity
        });
      }

      const trimmedNote = note.trim();
      const itemsToAdd = newItems.map((it) => ({
        ...it,
        ...(trimmedNote ? { note: trimmedNote } : {}),
        ...(logoUrl ? { logoUrl } : {}),
      }));

      await addToCart(itemsToAdd);

      posthog.capture('product_added_to_cart', {
        product_id: product.id,
        product_name: product.name,
        price_ngn: product.price,
        quantity,
        sizes: selectedSizes,
        colors: selectedColors,
      });

      const totalAdded = newItems.length;
      if (Platform.OS === 'web') {
        setAddedItemsCount(totalAdded);
        setShowCartConfirmation(true);
      } else {
        Alert.alert(
          'Added to Cart',
          `Added ${totalAdded} item${totalAdded > 1 ? 's' : ''} to your cart`,
          [
            { text: 'Continue Shopping', onPress: onContinueShopping },
            { text: 'View Cart', onPress: onViewCart }
          ]
        );
      }

      // Stock will be reduced automatically when order is placed
      // No need to reduce stock when adding to cart
      onAddedToCart();
    } catch (error) {
      console.error('Error adding to cart:', error);
      if (Platform.OS === 'web') setCartError('We could not add this product to your cart. Please try again.');
      else Alert.alert('Error', 'Failed to add items to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    cartError,
    showCartConfirmation,
    addedItemsCount,
    closeCartConfirmation,
    handleAddToCart,
  };
}
