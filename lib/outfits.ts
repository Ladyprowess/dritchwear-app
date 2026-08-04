import { supabase } from '@/lib/supabase';
import type { StoreProduct } from '@/types/product';
import type { OutfitWithProducts } from '@/types/outfit';

// Joins outfit rows with their products (in position order) and swaps in each
// product's primary gallery image - the same presentation the shop uses.
async function hydrateOutfits(outfitRows: any[]): Promise<OutfitWithProducts[]> {
  if (!outfitRows?.length) return [];

  const ids = outfitRows.map((o) => o.id);
  const { data: itemRows } = await supabase
    .from('outfit_items')
    .select('outfit_id, position, products(*)')
    .in('outfit_id', ids)
    .order('position', { ascending: true });

  const byOutfit = new Map<string, StoreProduct[]>();
  (itemRows ?? []).forEach((row: any) => {
    // PostgREST returns a to-one embed as an object, but normalize defensively.
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product || product.is_active === false) return;
    const list = byOutfit.get(row.outfit_id) ?? [];
    list.push(product as StoreProduct);
    byOutfit.set(row.outfit_id, list);
  });

  const merged = outfitRows
    .map((o) => ({ ...o, products: byOutfit.get(o.id) ?? [] }))
    .filter((o) => o.products.length > 0);

  const allProductIds = [...new Set(merged.flatMap((o) => o.products.map((p: StoreProduct) => p.id)))];
  if (allProductIds.length) {
    const { data: imgs } = await supabase
      .from('product_images')
      .select('product_id, image_url')
      .eq('is_primary', true)
      .in('product_id', allProductIds);
    const primary = new Map<string, string>((imgs ?? []).map((r: any) => [String(r.product_id), r.image_url]));
    merged.forEach((o) => o.products.forEach((p: StoreProduct) => { const u = primary.get(p.id); if (u) p.image_url = u; }));
  }

  return merged as OutfitWithProducts[];
}

// All active looks, ordered for display. Returns [] on any error so callers can
// simply hide the section when there is nothing to show.
export async function fetchLooks(): Promise<OutfitWithProducts[]> {
  const { data: outfitRows, error } = await supabase
    .from('outfits')
    .select('*')
    .eq('is_active', true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (error || !outfitRows?.length) return [];
  return hydrateOutfits(outfitRows);
}

// A single look for the look-detail page. RLS returns only active looks to
// customers, so an inactive/unknown id resolves to null.
export async function fetchLookById(id: string): Promise<OutfitWithProducts | null> {
  const { data: outfitRows, error } = await supabase
    .from('outfits')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error || !outfitRows?.length) return null;
  const [look] = await hydrateOutfits(outfitRows);
  return look ?? null;
}

export const lookTotalNGN = (look: OutfitWithProducts): number =>
  look.products.reduce((sum, p) => sum + p.price, 0);
