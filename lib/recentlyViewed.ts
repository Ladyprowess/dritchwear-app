// Tracks the products a shopper has recently opened, so returning shoppers don't
// have to search again. Logged-in users are synced via Supabase (follows them
// across devices, survives a storage clear); guests fall back to on-device storage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const KEY = '@dritchwear_recently_viewed';
const MAX = 5;

async function getLocal(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

async function addLocal(productId: string): Promise<string[]> {
  try {
    const current = await getLocal();
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export async function getRecentlyViewed(userId?: string): Promise<string[]> {
  if (!userId) return getLocal();
  try {
    const { data, error } = await supabase
      .from('recently_viewed')
      .select('product_id')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(MAX);
    if (error || !data) return getLocal();
    return data.map((r: any) => String(r.product_id));
  } catch {
    return getLocal();
  }
}

export async function addRecentlyViewed(productId: string, userId?: string): Promise<string[]> {
  if (!userId) return addLocal(productId);
  try {
    await supabase
      .from('recently_viewed')
      .upsert(
        { user_id: userId, product_id: productId, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,product_id' }
      );
    return getRecentlyViewed(userId);
  } catch {
    return getLocal();
  }
}
