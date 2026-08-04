import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type GiftCardTemplate = Database['public']['Tables']['gift_card_templates']['Row'];
export type GiftCardRow = Database['public']['Tables']['gift_cards']['Row'];
export type GiftCardPreview = Database['public']['Functions']['get_gift_card_preview']['Returns'][number];
export type IssueGiftCardResult = Database['public']['Functions']['issue_gift_card']['Returns'][number];
export type RedeemGiftCardResult = Database['public']['Functions']['redeem_gift_card']['Returns'][number];

export async function fetchGiftCardTemplates() {
  return supabase
    .from('gift_card_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
}

export async function fetchMyGiftCards() {
  return supabase
    .from('gift_cards')
    .select(`
      *,
      gift_card_templates (
        id,
        slug,
        name,
        category,
        image_path,
        start_color,
        end_color,
        accent_color,
        is_active,
        sort_order,
        created_at
      )
    `)
    .order('created_at', { ascending: false });
}

export async function issueGiftCard(input: {
  templateSlug: string;
  originalAmount: number;
  currency: string;
  recipientName: string;
  senderName: string;
  recipientEmail?: string | null;
  deliveryMethod: 'link' | 'email';
  message?: string | null;
}) {
  const { data, error } = await supabase.rpc('issue_gift_card', {
    p_template_slug: input.templateSlug,
    p_original_amount: input.originalAmount,
    p_currency: input.currency,
    p_recipient_name: input.recipientName,
    p_sender_name: input.senderName,
    p_recipient_email: input.recipientEmail ?? null,
    p_delivery_method: input.deliveryMethod,
    p_message: input.message ?? null,
  });

  return {
    data: (data?.[0] ?? null) as IssueGiftCardResult | null,
    error,
  };
}

export async function previewGiftCard(identifier: string) {
  const { data, error } = await supabase.rpc('get_gift_card_preview', {
    p_identifier: identifier.trim().toUpperCase(),
  });

  return {
    data: (data?.[0] ?? null) as GiftCardPreview | null,
    error,
  };
}

export async function redeemGiftCard(identifier: string) {
  const { data, error } = await supabase.rpc('redeem_gift_card', {
    p_identifier: identifier.trim().toUpperCase(),
  });

  return {
    data: (data?.[0] ?? null) as RedeemGiftCardResult | null,
    error,
  };
}
