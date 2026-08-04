// Single source of truth for shop categories (streetwear-first, male-leaning).
// Smart collections are derived from product signals (no DB column).
export const SMART_COLLECTIONS: string[] = ['New', 'Featured'];

export const PRODUCT_CATEGORIES: string[] = [
  'T-Shirts', 'Shirts', 'Hoodies', 'Polos', 'Joggers', 'Jackets',
  'Sweatshirt', 'Shorts', 'Trousers', 'Merch', 'Others',
];

// The categories shown as tiles on the shop (admin can set a photo for each).
export const SHOP_CATEGORIES: string[] = ['All', ...SMART_COLLECTIONS, ...PRODUCT_CATEGORIES];
