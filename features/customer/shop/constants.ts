import { SMART_COLLECTIONS, SHOP_CATEGORIES } from '@/lib/categories';
import type { StoreProduct } from '@/types/product';

export const BRAND_PURPLE = '#5A2D82';
export const BRAND_GOLD = '#FDB813';

// Hero banner slides. 'cover' = waist-up shots on purple walls (fill the banner);
// 'cutout' = the transparent full-body PNG, shown standing on the right over the gradient.
export const HERO_SLIDES: { url: string; variant: 'cover' | 'cutout' }[] = [
  { url: 'https://raw.githubusercontent.com/Ladyprowess/store-image/refs/heads/main/dritch/Hero/05C0CAC9-390E-4AA8-A1E8-3CFE11D833F1.png', variant: 'cover' },
  { url: 'https://raw.githubusercontent.com/Ladyprowess/store-image/refs/heads/main/dritch/Hero/85403A30-35A8-4EC9-887A-3B7EEDECAC63.png', variant: 'cover' },
  { url: 'https://raw.githubusercontent.com/Ladyprowess/store-image/refs/heads/main/dritch/Hero/916CEB09-031F-4FC6-9D10-4A37D123DFA4.png', variant: 'cutout' },
];

// Lifestyle lookbook cards (real scenes) - NOT currently rendered anywhere in
// this screen (the strip they were meant for was removed at some point, but
// this constant plus lookbookSection/lookbookRow/lookbookCard in styles.ts
// were left behind). Preserved as pre-existing dead code, not wired up here.
const LIFESTYLE_BASE = 'https://raw.githubusercontent.com/Ladyprowess/store-image/refs/heads/main/dritch/Hero';
export const LIFESTYLE_CARDS = [
  { label: 'Campus', url: `${LIFESTYLE_BASE}/78208FCB-FCC8-4BF0-A6B3-36875292C1E4.png` },
  { label: 'Cafe', url: `${LIFESTYLE_BASE}/E3FB4886-13EB-4BE7-A3F7-5AE7F15223E8.png` },
  { label: 'Street', url: `${LIFESTYLE_BASE}/3B86C8E8-F873-44DE-BE04-6CE731EB3B3E.png` },
];

// Real customer photos for the social-proof collage near the footer.
const COMMUNITY_BASE = `${LIFESTYLE_BASE}/Community`;
export const COMMUNITY_PHOTOS = [
  `${COMMUNITY_BASE}/0E93B554-1E2D-4C3B-A02C-750D36E3BD79.png`,
  `${COMMUNITY_BASE}/74B15EEB-2B72-4990-A1AF-1E9823632A21.png`,
  `${COMMUNITY_BASE}/9BE3A795-AE21-499C-816F-60F707000B7F.png`,
  `${COMMUNITY_BASE}/A9C3FB9E-68CA-4C40-BDAE-A862C9F3D971.png`,
  `${COMMUNITY_BASE}/104A8E7A-0834-4343-9157-9A8AC42C557D.png`,
];

// Categories come from the shared list (Trending removed per owner).
export const smartCollections = SMART_COLLECTIONS;
export const categories = SHOP_CATEGORIES;

export const SALES_MOMENTS = [
  'Earn loyalty points on every order',
  'Hot sizes are selling out fast',
  'Lock in your fit before it sells out',
];

// A product counts as "new" if it was created in the last 21 days.
export const isNewProduct = (product: StoreProduct): boolean => {
  if (!product.created_at) return false;
  const created = new Date(product.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= 21 * 24 * 60 * 60 * 1000;
};
