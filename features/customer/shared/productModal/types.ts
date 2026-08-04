import type { StoreProduct } from '@/types/product';

export interface ProductImage {
  id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
}

export interface ProductModalProps {
  product: StoreProduct | null;
  visible: boolean;
  onClose: () => void;
  onOrderSuccess: () => void;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
}
