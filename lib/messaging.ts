import { supabase } from '@/lib/supabase';

// Messaging reuses the existing support ticket system, but tickets are an
// internal concept - the customer only ever sees one ongoing conversation.
// The first message reuses their latest open ticket, or creates one silently.

export interface ConvMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_profile?: { full_name: string | null; role: string | null } | null;
}

export interface Conversation {
  id: string;
  ticket_code: string;
  status: string;
}

export interface ConversationSummary {
  id: string;
  ticket_code: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  preview: string;
  lastSenderId: string | null; // to prefix the preview with You: / Support:
}

// Lists the user's conversations, newest first, each as its own row (not merged).
// The internal ticket `subject` is intentionally NOT returned - users never see
// agent-facing subjects (e.g. "Escalated to Operations").
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, ticket_code, status, last_message_at, created_at')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const list = (tickets as any[]) || [];
  const ids = list.map((t) => t.id);
  const previews: Record<string, { message: string; sender_id: string }> = {};
  if (ids.length) {
    const { data: msgs } = await supabase
      .from('support_messages')
      .select('ticket_id, message, sender_id, created_at')
      .in('ticket_id', ids)
      .order('created_at', { ascending: false });
    (msgs || []).forEach((m: any) => { if (!previews[m.ticket_id]) previews[m.ticket_id] = { message: m.message, sender_id: m.sender_id }; });
  }
  return list.map((t) => ({
    id: t.id,
    ticket_code: t.ticket_code,
    status: t.status,
    last_message_at: t.last_message_at,
    created_at: t.created_at,
    preview: previews[t.id]?.message || 'No messages yet',
    lastSenderId: previews[t.id]?.sender_id ?? null,
  }));
}

// Messages for a single conversation (one ticket) - never stitched across tickets.
export async function getTicketMessages(ticketId: string): Promise<ConvMessage[]> {
  const { data } = await supabase
    .from('support_messages')
    .select('id, ticket_id, sender_id, message, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  return (data as ConvMessage[]) || [];
}

export interface MessagingState {
  ticketIds: string[];          // every ticket the user owns (for the stitched thread)
  active: Conversation | null;  // latest non-closed ticket, used for sending + status
}

// Loads the user's whole messaging history handle: all their ticket ids (so the
// UI can stitch every ticket into one continuous conversation) plus the latest
// still-open ticket to append to. Never creates a ticket.
export async function getMessagingState(userId: string): Promise<MessagingState> {
  const { data } = await supabase
    .from('support_tickets')
    .select('id, ticket_code, status, last_message_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const tickets = (data as any[]) || [];
  const ticketIds = tickets.map((t) => t.id as string);
  // Latest non-closed ticket = the one we append new messages to.
  const openTickets = tickets.filter((t) => t.status !== 'closed');
  const active = openTickets.length
    ? ({ id: openTickets[openTickets.length - 1].id, ticket_code: openTickets[openTickets.length - 1].ticket_code, status: openTickets[openTickets.length - 1].status } as Conversation)
    : null;
  return { ticketIds, active };
}

// Fetches all messages across the given tickets, ordered oldest first - this is
// what makes multiple internal tickets read as one continuous conversation.
export async function getStitchedMessages(ticketIds: string[]): Promise<ConvMessage[]> {
  if (ticketIds.length === 0) return [];
  const { data } = await supabase
    .from('support_messages')
    .select('id, ticket_id, sender_id, message, created_at')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: true });
  return (data as ConvMessage[]) || [];
}

// Whether support is currently marked online by an admin. Stored on the single
// commerce_settings row so it can be toggled without a schema change per use.
export async function getSupportOnline(): Promise<boolean> {
  const { data } = await supabase.from('commerce_settings').select('support_online').eq('id', 'default').maybeSingle();
  // Default to online if the column/row is missing.
  return (data as any)?.support_online ?? true;
}

export async function setSupportOnline(online: boolean): Promise<void> {
  await supabase.from('commerce_settings').update({ support_online: online }).eq('id', 'default');
}

// Creates a fresh conversation (ticket) for the customer. Called lazily on the
// first message when no open conversation exists.
export async function createConversation(userId: string): Promise<Conversation> {
  const ticketCode = `MSG-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      ticket_code: ticketCode,
      subject: 'Conversation',
      description: 'Customer message',
      status: 'open',
      priority: 'medium',
      last_message_at: new Date().toISOString(),
    })
    .select('id, ticket_code, status')
    .single();
  if (error) throw error;
  return data as Conversation;
}
