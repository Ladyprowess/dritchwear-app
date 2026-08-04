// Dritchwear Public Products API
// Returns all active products for partner platforms to display.
//
// GET /functions/v1/get-products
//
// Response:
// { success: true, products: [{ id, name, price, image_url, category, sizes, colors, stock }] }
//
// Deploy: supabase functions deploy get-products

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, image_url, category, sizes, colors, stock')
    .eq('is_active', true)
    .gt('stock', 0)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Merge primary images from product_images table (some products store image there instead of image_url column)
  const productList = products ?? [];
  try {
    const ids = productList.map((p: any) => p.id);
    if (ids.length > 0) {
      const { data: primaryImages } = await supabase
        .from('product_images')
        .select('product_id, image_url')
        .eq('is_primary', true)
        .in('product_id', ids);

      if (primaryImages && primaryImages.length > 0) {
        const imageMap: Record<string, string> = {};
        for (const img of primaryImages) {
          imageMap[(img as any).product_id] = (img as any).image_url;
        }
        for (const p of productList as any[]) {
          if (imageMap[p.id]) p.image_url = imageMap[p.id];
        }
      }
    }
  } catch {
    // Non-fatal - products still returned with whatever image_url they have
  }

  // Normalize GitHub blob URLs to raw.githubusercontent.com for direct image loading
  for (const p of productList as any[]) {
    if (p.image_url) {
      p.image_url = p.image_url
        .replace(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(\?raw=true)?$/, 'https://raw.githubusercontent.com/$1/$2/$3/$4')
        .replace(/^http:\/\//, 'https://')
    }
  }

  return new Response(JSON.stringify({ success: true, products: productList }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
