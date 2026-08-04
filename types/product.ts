export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  subtitle?: string | null;
  price: number;
  image_url: string;
  category?: string | null;
  categories?: string[] | null;
  sizes: string[];
  colors: string[];
  stock: number;
  is_active?: boolean;
  total_reviews?: number;
  average_rating?: number;
  updated_at?: string;
  created_at?: string;
  sales_count?: number;
  is_hot?: boolean;
  is_featured?: boolean;
  featured_position?: number;
  is_on_sale?: boolean;
  sale_label?: string | null;
  // Minimum wardrobe tier required to shop this product (Silver/Gold/Platinum).
  // null/undefined = available to everyone.
  min_tier?: string | null;
  // Original price for a real strikethrough + "-X%" badge (must be > price).
  compare_at_price?: number | null;
  // Per-size stock map, e.g. { M: 3, L: 0 }. Empty = use single `stock`.
  size_stock?: Record<string, number> | null;
  // When true, the product modal lets the customer upload a logo for the item.
  allow_logo_upload?: boolean;
}

// Discount % from compare-at price, or null when there's no real markdown.
export function discountPercent(product: StoreProduct): number | null {
  const cmp = product.compare_at_price;
  if (!cmp || cmp <= product.price) return null;
  return Math.round((1 - product.price / cmp) * 100);
}

// Stock for a specific size (falls back to the product's single stock number
// when per-size stock isn't configured).
export function sizeStock(product: StoreProduct, size: string): number {
  const map = product.size_stock;
  if (map && Object.keys(map).length > 0) return Number(map[size] ?? 0);
  return product.stock;
}

// Whether per-size stock is being tracked for this product.
export function hasSizeStock(product: StoreProduct): boolean {
  return !!product.size_stock && Object.keys(product.size_stock).length > 0;
}

export function getProductCategories(product: StoreProduct): string[] {
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    return product.categories;
  }
  return product.category ? [product.category] : [];
}
