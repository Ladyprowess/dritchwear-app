import type { StoreProduct } from './product';

// Occasions power the "Where are you going?" stylist picker.
export const OCCASIONS = ['Everyday', 'Work', 'Date Night', 'Church', 'Campus', 'Vacation', 'Gift'] as const;
export type Occasion = typeof OCCASIONS[number];

// Who a look is styled for (admin-set on each outfit).
export const GENDERS = ['Unisex', 'Men', 'Women'] as const;
export type Gender = typeof GENDERS[number];

// Budget tiers for the stylist quiz (a look's total price in NGN must fall in range).
export const BUDGET_TIERS: { label: string; min: number; max: number | null }[] = [
  { label: 'Any budget', min: 0, max: null },
  { label: 'Under ₦15k', min: 0, max: 15000 },
  { label: '₦15k–30k', min: 15000, max: 30000 },
  { label: '₦30k–50k', min: 30000, max: 50000 },
  { label: '₦50k+', min: 50000, max: null },
];

export interface Outfit {
  id: string;
  title: string;
  occasion: string;
  gender: string;
  subtitle: string | null;
  // Short editorial "Why this works" stylist note (optional; add the column +
  // admin input later to fill it - the look page renders it only when present).
  stylist_note?: string | null;
  cover_image: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  product_id: string;
  position: number;
}

// An outfit joined with its product details, ready to render / add to cart.
export interface OutfitWithProducts extends Outfit {
  products: StoreProduct[];
}
