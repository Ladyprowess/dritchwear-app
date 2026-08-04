import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Send, ChevronDown, ChevronRight, Search, Phone, Mail, MessageCircle, Paperclip, X, Camera, Image as ImageIcon, FileText, RotateCcw, Plus } from 'lucide-react-native';
import { smartBack } from '@/lib/navigation';
import {
  listConversations, getTicketMessages, createConversation, getSupportOnline,
  type Conversation, type ConversationSummary, type ConvMessage,
} from '@/lib/messaging';
import {
  pickImagesFromLibrary, takePhoto, pickDocuments, uploadAttachment, loadAttachmentsForMessages,
  validateFile, isImage, type PickedFile, type UploadedAttachment, type AttachmentRow,
} from '@/lib/attachments';
import MessageAttachments from '@/components/MessageAttachments';

const BRAND_PURPLE = '#5A2D82';

const FAQS = [
  { q: 'How do I track my order?', a: 'Go to the Orders tab. Each order shows its current status and estimated delivery time.' },
  { q: 'What payment methods do you accept?', a: 'Wallet, and online payments through Paystack (cards, bank transfers, USSD) for Nigeria, plus PayPal for international. You can also use Pay for Me to let someone else pay.' },
  { q: 'How long does delivery take?', a: 'Usually 2 to 7 business days within Nigeria. International delivery takes 3 to 4 weeks.' },
  { q: 'Can I return or exchange items?', a: 'Yes, within 2 days of receiving your items. Items must be in original condition with tags attached.' },
  { q: 'How do custom or branded orders work?', a: 'On the product page you can upload your logo or describe what you want, then add it to cart. Our team reviews it and gets it made.' },
];

interface Pending { key: string; file: PickedFile; status: 'uploading' | 'done' | 'error'; uploaded?: UploadedAttachment; }
type Screen = 'home' | 'list' | 'thread';

function presence(status: string | undefined, online: boolean): { label: string; color: string } {
  if (status === 'resolved' || status === 'closed') return { label: 'Resolved', color: '#9A93A1' };
  if (!online) return { label: 'Away', color: '#9A93A1' };
  if (status === 'waiting_customer') return { label: 'Waiting for your reply', color: '#F59E0B' };
  return { label: "We're here", color: '#1B9C63' };
}
const isClosed = (status: string | undefined) => status === 'resolved' || status === 'closed';
function dotColor(status: string): string {
  if (status === 'waiting_customer') return '#F59E0B';
  if (status === 'resolved' || status === 'closed') return '#C9BFD6';
  return '#1B9C63';
}
// Users only ever see a neutral conversation title - never the internal subject.
function statusLabel(status: string): string {
  if (status === 'waiting_customer') return 'Waiting';
  if (status === 'resolved' || status === 'closed') return 'Resolved';
  return 'Active';
}
function relTime(iso: string | null): string {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
function dayLabel(iso: string): string {
  const d = new Date(iso); const now = new Date();
  const s = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((s(now) - s(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export default function MessagingScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [view, setView] = useState<Screen>('home');
  const [supportOnline, setSupportOnline] = useState(true);
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Messages list
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convQuery, setConvQuery] = useState('');

  // Smart auto-scroll: only follow new messages when already at the bottom.
  const [showNewPill, setShowNewPill] = useState(false);
  const atBottomRef = useRef(true);

  // Active thread
  const [activeTicket, setActiveTicket] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, AttachmentRow[]>>({});
  const [pending, setPending] = useState<Pending[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const threadFromRef = useRef<Screen>('home');
  const attKeyRef = useRef<string>('');
  const scrollRef = useRef<ScrollView>(null);
  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 90);

  useEffect(() => {
    void getSupportOnline().then(setSupportOnline).catch(() => {});
    if (user?.id) void refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshConversations = useCallback(async () => {
    if (!user?.id) return;
    setConvLoading(true);
    try { setConversations(await listConversations(user.id)); }
    finally { setConvLoading(false); }
  }, [user?.id]);

  // Load + subscribe for the open thread.
  useEffect(() => {
    if (view !== 'thread' || !activeTicket?.id) return;
    const ticketId = activeTicket.id;
    let alive = true;

    const reload = async (forceAtt = false) => {
      const msgs = await getTicketMessages(ticketId);
      if (!alive) return;
      setMessages(msgs);
      const key = msgs.map((m) => m.id).join(',');
      if (forceAtt || key !== attKeyRef.current) {
        attKeyRef.current = key;
        setAttachmentsMap(await loadAttachmentsForMessages(msgs.map((m) => m.id)));
      }
    };

    setThreadLoading(true);
    reload().then(() => { if (alive) { setThreadLoading(false); scrollToEnd(); } });

    const channel = supabase
      .channel(`msg-thread-${ticketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` }, (payload) => {
        const row = payload.new as ConvMessage;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        // Only auto-follow if the reader is already at the bottom; otherwise nudge.
        if (row.sender_id === user?.id || atBottomRef.current) scrollToEnd();
        else setShowNewPill(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_message_attachments', filter: `ticket_id=eq.${ticketId}` }, () => { void reload(true).then(scrollToEnd); })
      // Reflect admin closing/reopening the conversation on the customer side.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticketId}` }, (payload) => {
        const t = payload.new as any;
        setActiveTicket((prev) => (prev && prev.id === ticketId ? { ...prev, status: t.status } : prev));
      })
      .subscribe();

    // Poll fallback: also re-check the ticket status (covers no-realtime setups).
    const refreshStatus = async () => {
      const { data } = await supabase.from('support_tickets').select('status').eq('id', ticketId).maybeSingle();
      if (alive && data) setActiveTicket((prev) => (prev && prev.id === ticketId ? { ...prev, status: (data as any).status } : prev));
    };
    const poll = setInterval(() => { void reload(); void refreshStatus(); void getSupportOnline().then(setSupportOnline).catch(() => {}); }, 20000);

    return () => { alive = false; void supabase.removeChannel(channel); clearInterval(poll); };
  }, [view, activeTicket?.id]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const openList = () => { setView('list'); void refreshConversations(); };
  const openThread = (conv: ConversationSummary | Conversation, from: Screen) => {
    threadFromRef.current = from;
    setMessages([]); setAttachmentsMap({}); attKeyRef.current = ''; setPending([]); setInput('');
    setActiveTicket({ id: conv.id, ticket_code: conv.ticket_code, status: conv.status });
    setView('thread');
  };
  const startNew = (from: Screen) => {
    threadFromRef.current = from;
    setMessages([]); setAttachmentsMap({}); attKeyRef.current = ''; setPending([]); setInput('');
    setActiveTicket(null);
    setView('thread');
  };
  const backFromThread = () => {
    const from = threadFromRef.current;
    setActiveTicket(null);
    if (from === 'list') openList(); else { setView('home'); void refreshConversations(); }
  };

  // ── Attachments ───────────────────────────────────────────────────────────
  const addFiles = async (files: PickedFile[]) => {
    setShowAttachMenu(false);
    if (files.length === 0 || !user?.id) return;
    const room = 5 - pending.length;
    if (room <= 0) { Alert.alert('Limit reached', 'You can attach up to 5 files per message.'); return; }
    for (const file of files.slice(0, room)) {
      const err = validateFile(file);
      if (err) { Alert.alert('Cannot attach', err); continue; }
      const key = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setPending((p) => [...p, { key, file, status: 'uploading' }]);
      try {
        const uploaded = await uploadAttachment(user.id, file);
        setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'done', uploaded } : x)));
      } catch {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'error' } : x)));
      }
    }
  };
  const retryUpload = async (key: string) => {
    if (!user?.id) return;
    const item = pending.find((p) => p.key === key); if (!item) return;
    setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'uploading' } : x)));
    try { const uploaded = await uploadAttachment(user.id, item.file); setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'done', uploaded } : x))); }
    catch { setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'error' } : x))); }
  };
  const removePending = (key: string) => setPending((p) => p.filter((x) => x.key !== key));

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    const ready = pending.filter((p) => p.status === 'done' && p.uploaded);
    if ((!text && ready.length === 0) || sending || !user?.id) return;
    if (pending.some((p) => p.status === 'uploading')) { Alert.alert('Please wait', 'Your files are still uploading.'); return; }
    setSending(true); setInput('');
    try {
      let conv = activeTicket;
      if (!conv) { conv = await createConversation(user.id); setActiveTicket(conv); }

      const { data, error } = await supabase
        .from('support_messages')
        .insert({ ticket_id: conv.id, ticket_code: conv.ticket_code, sender_id: user.id, message: text, is_internal: false })
        .select('id, ticket_id, sender_id, message, created_at')
        .single();
      if (error) throw error;

      if (data && ready.length > 0) {
        await supabase.from('support_message_attachments').insert(ready.map((p) => ({
          message_id: (data as any).id, ticket_id: conv!.id,
          file_name: p.uploaded!.file_name, file_size: p.uploaded!.file_size, mime_type: p.uploaded!.mime_type, storage_path: p.uploaded!.storage_path,
        })));
      }
      setPending([]);
      if (data) {
        setMessages((prev) => (prev.some((m) => m.id === (data as any).id) ? prev : [...prev, data as ConvMessage]));
        if (ready.length > 0) { attKeyRef.current = ''; setAttachmentsMap(await loadAttachmentsForMessages([...messages.map((m) => m.id), (data as any).id])); }
      }
      scrollToEnd();

      await supabase.from('support_tickets').update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', conv.id);
      // Push-notify the admin(s), even if their app is closed. Best-effort.
      const am = text || `Sent ${ready.length} attachment${ready.length !== 1 ? 's' : ''}`;
      supabase.functions.invoke('send-push-notifications', {
        body: { toAdmins: true, title: 'New customer message', message: am.length > 90 ? `${am.slice(0, 90)}…` : am, type: 'custom', url: '/help-support' },
      }).catch(() => {});
    } catch { setInput(text); }
    finally { setSending(false); }
  };

  const faqs = query.trim() ? FAQS.filter((f) => (f.q + ' ' + f.a).toLowerCase().includes(query.trim().toLowerCase())) : FAQS;
  const homeChip = presence(undefined, supportOnline);

  // ─────────────────────────────────────────────────────────────────────────
  // HOME
  if (view === 'home') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => smartBack(router, '/(customer)')} hitSlop={8}><ArrowLeft size={22} color="#17131C" /></Pressable>
          <Text style={styles.headerTitle}>Messaging</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.hi}>How can we help?</Text>
          <View style={styles.homeStatus}>
            <View style={[styles.chipDot, { backgroundColor: homeChip.color }]} />
            <Text style={styles.homeStatusText}>{homeChip.label}</Text>
          </View>

          {(() => {
            const activeConv = conversations.find((c) => c.status !== 'closed' && c.status !== 'resolved');
            return (
              <Pressable style={styles.sendCard} onPress={() => (activeConv ? openThread(activeConv, 'home') : startNew('home'))}>
                <View style={styles.sendCardIcon}><MessageCircle size={20} color="#FFFFFF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sendCardTitle}>{activeConv ? 'Continue conversation' : 'Send us a message'}</Text>
                  <Text style={styles.sendCardSub}>{supportOnline ? 'We reply as soon as possible' : 'We are away, leave a message'}</Text>
                </View>
                <ChevronRight size={20} color="rgba(255,255,255,0.9)" />
              </Pressable>
            );
          })()}

          <Pressable style={styles.rowCard} onPress={openList}>
            <View style={styles.rowIcon}><MessageCircle size={18} color={BRAND_PURPLE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Messages</Text>
              <Text style={styles.rowSub}>{conversations.length > 0 ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}` : 'View your conversations'}</Text>
            </View>
            <ChevronRight size={18} color="#B4ADBC" />
          </Pressable>

          <Text style={styles.sectionLabel}>Help</Text>
          <View style={styles.searchBox}>
            <Search size={16} color="#9A93A1" />
            <TextInput style={[styles.searchInput, Platform.OS === 'web' && ({ fontSize: 16 } as any)]} value={query} onChangeText={setQuery} placeholder="Search help…" placeholderTextColor="#9A93A1" />
          </View>
          {faqs.map((item) => {
            const idx = FAQS.indexOf(item); const open = openFaq === idx;
            return (
              <Pressable key={item.q} style={styles.faqCard} onPress={() => setOpenFaq(open ? null : idx)}>
                <View style={styles.faqQRow}><Text style={styles.faqQ}>{item.q}</Text><ChevronDown size={18} color="#8B8391" style={open ? { transform: [{ rotate: '180deg' }] } : undefined} /></View>
                {open && <Text style={styles.faqA}>{item.a}</Text>}
              </Pressable>
            );
          })}
          {faqs.length === 0 && <Text style={styles.noFaq}>No matching help articles.</Text>}
          <View style={styles.contactRow}>
            <Pressable style={styles.contactBtn} onPress={() => Linking.openURL('tel:+2349110163722')}><Phone size={15} color={BRAND_PURPLE} /><Text style={styles.contactText}>Call</Text></Pressable>
            <Pressable style={styles.contactBtn} onPress={() => Linking.openURL('mailto:support@dritchwear.com')}><Mail size={15} color={BRAND_PURPLE} /><Text style={styles.contactText}>Email</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGES LIST
  if (view === 'list') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => setView('home')} hitSlop={8}><ArrowLeft size={22} color="#17131C" /></Pressable>
          <Text style={styles.headerTitle}>Messages</Text>
          <Pressable style={styles.newBtn} onPress={() => startNew('list')} hitSlop={8}><Plus size={20} color={BRAND_PURPLE} /></Pressable>
        </View>
        {convLoading ? (
          <View style={styles.center}><ActivityIndicator color={BRAND_PURPLE} /></View>
        ) : conversations.length === 0 ? (
          <View style={styles.center}>
            <MessageCircle size={34} color="#C9BFD6" />
            <Text style={styles.emptyText}>No messages yet.</Text>
            <Pressable style={styles.emptyCta} onPress={() => startNew('list')}><Text style={styles.emptyCtaText}>Send us a message</Text></Pressable>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.listSearchWrap}>
              <View style={styles.searchBox}>
                <Search size={16} color="#9A93A1" />
                <TextInput style={[styles.searchInput, Platform.OS === 'web' && ({ fontSize: 16 } as any)]} value={convQuery} onChangeText={setConvQuery} placeholder="Search messages…" placeholderTextColor="#9A93A1" />
              </View>
            </View>
            {conversations
              .filter((c) => !convQuery.trim() || c.preview.toLowerCase().includes(convQuery.trim().toLowerCase()))
              .map((c) => {
                const prefix = c.preview === 'No messages yet' ? '' : (c.lastSenderId && c.lastSenderId === user?.id ? 'You: ' : 'Support: ');
                return (
                  <Pressable key={c.id} style={styles.convRow} onPress={() => openThread(c, 'list')}>
                    <View style={styles.convAvatar}><MessageCircle size={18} color={BRAND_PURPLE} /></View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.convTop}>
                        <Text style={styles.convName} numberOfLines={1}>Conversation</Text>
                        <Text style={styles.convTime}>{relTime(c.last_message_at || c.created_at)}</Text>
                      </View>
                      <View style={styles.convBottom}>
                        <View style={[styles.chipDot, { backgroundColor: dotColor(c.status), marginRight: 6 }]} />
                        <Text style={styles.convStatus}>{statusLabel(c.status)}</Text>
                        <Text style={styles.convDivider}>·</Text>
                        <Text style={styles.convPreview} numberOfLines={1}>{prefix}{c.preview}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THREAD
  const threadChip = presence(activeTicket?.status, supportOnline);
  let prevDay = ''; let prevSender = '';
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={backFromThread} hitSlop={8}><ArrowLeft size={22} color="#17131C" /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle2}>Conversation</Text>
          <View style={styles.statusRow}><View style={[styles.chipDot, { backgroundColor: threadChip.color }]} /><Text style={styles.threadSub}>{threadChip.label}</Text></View>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={100}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            atBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
            if (atBottomRef.current && showNewPill) setShowNewPill(false);
          }}
        >
          {threadLoading ? (
            <View style={styles.center}><ActivityIndicator color={BRAND_PURPLE} /></View>
          ) : messages.length === 0 ? (
            <View style={styles.convEmpty}>
              <Text style={styles.convEmptyTitle}>Need help?</Text>
              <Text style={styles.convEmptyText}>Send us a message and our support will respond ASAP.</Text>
            </View>
          ) : (
            messages.map((m, i) => {
              const mine = m.sender_id === user?.id;
              const day = dayLabel(m.created_at); const showDay = day !== prevDay; prevDay = day;
              const showSender = m.sender_id !== prevSender || showDay; prevSender = m.sender_id;
              const isLast = i === messages.length - 1;
              return (
                <React.Fragment key={m.id}>
                  {showDay && <View style={styles.daySep}><Text style={styles.daySepText}>{day}</Text></View>}
                  {showSender && <Text style={[styles.senderLabel, mine ? styles.senderMine : styles.senderTheirs]}>{mine ? 'You' : 'Support'}</Text>}
                  <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
                    <View style={[styles.msgCol, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                      {!!m.message?.trim() && (
                        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                          <Text style={[styles.msgText, mine && styles.msgTextMine]}>{m.message}</Text>
                          <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                      )}
                      <MessageAttachments attachments={attachmentsMap[m.id] || []} mine={mine} />
                      {mine && isLast && <Text style={styles.sentLabel}>Sent</Text>}
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </ScrollView>

        {showNewPill && (
          <View style={styles.newPillWrap} pointerEvents="box-none">
            <Pressable style={styles.newPill} onPress={() => { scrollToEnd(); setShowNewPill(false); }}>
              <ChevronDown size={14} color="#FFFFFF" />
              <Text style={styles.newPillText}>New message</Text>
            </Pressable>
          </View>
        )}

        {isClosed(activeTicket?.status) ? (
          <View style={styles.closedBar}>
            <Text style={styles.closedText}>This conversation was closed by our team.</Text>
            <Pressable style={styles.closedBtn} onPress={() => startNew('thread')}>
              <Text style={styles.closedBtnText}>Start a new conversation</Text>
            </Pressable>
          </View>
        ) : (
        <View>
          {showAttachMenu && (
            <View style={styles.attachMenu}>
              <Pressable style={styles.attachOption} onPress={async () => addFiles(await pickImagesFromLibrary())}><ImageIcon size={18} color={BRAND_PURPLE} /><Text style={styles.attachOptionText}>Photo library</Text></Pressable>
              {Platform.OS !== 'web' && <Pressable style={styles.attachOption} onPress={async () => addFiles(await takePhoto())}><Camera size={18} color={BRAND_PURPLE} /><Text style={styles.attachOptionText}>Camera</Text></Pressable>}
              <Pressable style={styles.attachOption} onPress={async () => addFiles(await pickDocuments())}><FileText size={18} color={BRAND_PURPLE} /><Text style={styles.attachOptionText}>Document</Text></Pressable>
            </View>
          )}
          {pending.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingBar} contentContainerStyle={styles.pendingContent}>
              {pending.map((p) => (
                <View key={p.key} style={styles.pendingItem}>
                  {isImage(p.file.mimeType) ? <Image source={{ uri: p.file.uri }} style={styles.pendingThumb} /> : <View style={styles.pendingDoc}><FileText size={20} color={BRAND_PURPLE} /><Text style={styles.pendingDocName} numberOfLines={1}>{p.file.name}</Text></View>}
                  {p.status === 'uploading' && <View style={styles.pendingOverlay}><ActivityIndicator size="small" color="#FFFFFF" /></View>}
                  {p.status === 'error' && <Pressable style={[styles.pendingOverlay, styles.pendingError]} onPress={() => retryUpload(p.key)}><RotateCcw size={16} color="#FFFFFF" /><Text style={styles.retryText}>Retry</Text></Pressable>}
                  <Pressable style={styles.pendingRemove} onPress={() => removePending(p.key)} hitSlop={6}><X size={12} color="#FFFFFF" /></Pressable>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.inputBar}>
            <Pressable style={styles.attachBtn} onPress={() => setShowAttachMenu((v) => !v)} disabled={!user?.id} hitSlop={6}><Paperclip size={20} color={user?.id ? '#6B6472' : '#C9BFD6'} /></Pressable>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && ({ fontSize: 16 } as any)]}
              value={input} onChangeText={setInput}
              placeholder={user?.id ? 'Type your message…' : 'Sign in to send a message'}
              placeholderTextColor="#9A93A1" editable={!!user?.id} onFocus={() => setShowAttachMenu(false)} multiline
            />
            <Pressable style={[styles.sendBtn, ((!input.trim() && pending.filter((p) => p.status === 'done').length === 0) || sending || !user?.id) && styles.sendBtnDisabled]} onPress={send} disabled={(!input.trim() && pending.filter((p) => p.status === 'done').length === 0) || sending || !user?.id}>
              <Send size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EFEBF2' },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3F7' },
  newBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3EEF8' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter-Bold', color: '#17131C' },
  headerTitle2: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#17131C' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  threadSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#7A7380' },

  scroll: { flex: 1, backgroundColor: '#F7F5FA' },
  scrollContent: { padding: 16, paddingBottom: 8 },
  hi: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#17131C', marginBottom: 8 },
  homeStatus: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  homeStatusText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#6B6472' },

  sendCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: BRAND_PURPLE, borderRadius: 16, padding: 16, marginBottom: 12 },
  sendCardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  sendCardTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  sendCardSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: 'rgba(255,255,255,0.82)', marginTop: 2 },

  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#EFEBF2' },
  rowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#F3EEF8', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14.5, fontFamily: 'Inter-SemiBold', color: '#17131C' },
  rowSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#7A7380', marginTop: 1 },

  sectionLabel: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#7A7380', letterSpacing: 0.3, marginBottom: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE8F1', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter-Regular', color: '#2B2531' },
  faqCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 9, borderWidth: 1, borderColor: '#EFEBF2' },
  faqQRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQ: { flex: 1, fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#17131C' },
  faqA: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#5C5563', lineHeight: 20, marginTop: 9 },
  noFaq: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#7A7380', marginBottom: 8 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 18 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#F0EAF7', borderRadius: 11, paddingVertical: 11 },
  contactText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: BRAND_PURPLE },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#7A7380', textAlign: 'center' },
  emptyCta: { backgroundColor: BRAND_PURPLE, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  emptyCtaText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter-SemiBold' },

  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F4F1F7' },
  convAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3EEF8', alignItems: 'center', justifyContent: 'center' },
  convTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  convName: { flex: 1, fontSize: 14.5, fontFamily: 'Inter-SemiBold', color: '#17131C' },
  convTime: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9A93A1' },
  convBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  convStatus: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#8B8391' },
  convDivider: { fontSize: 12, color: '#C9BFD6', marginHorizontal: 5 },
  convPreview: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#7A7380' },
  listSearchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  sentLabel: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#9A93A1', marginTop: 1, marginRight: 2 },
  newPillWrap: { position: 'absolute', bottom: 84, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  newPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND_PURPLE, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
  newPillText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Inter-SemiBold' },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },

  convEmpty: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EFEBF2', padding: 22, alignItems: 'center' },
  convEmptyTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#17131C', marginBottom: 5 },
  convEmptyText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#7A7380', textAlign: 'center', lineHeight: 19 },

  daySep: { alignItems: 'center', marginVertical: 10 },
  daySepText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#9A93A1', backgroundColor: '#EEEAF2', overflow: 'hidden', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  senderLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#9A93A1', marginBottom: 3 },
  senderMine: { textAlign: 'right' },
  senderTheirs: { textAlign: 'left' },
  msgRow: { flexDirection: 'row', marginBottom: 8 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  msgCol: { maxWidth: '82%', gap: 4 },
  bubble: { maxWidth: '100%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: BRAND_PURPLE, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#ECE8F1' },
  msgText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#2B2531', lineHeight: 20 },
  msgTextMine: { color: '#FFFFFF' },
  msgTime: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#9A93A1', marginTop: 3, alignSelf: 'flex-end' },
  msgTimeMine: { color: 'rgba(255,255,255,0.75)' },

  closedBar: { alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#ECE8F1' },
  closedText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#7A7380', textAlign: 'center' },
  closedBtn: { backgroundColor: BRAND_PURPLE, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  closedBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter-SemiBold' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#ECE8F1' },
  attachBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3F7' },
  input: { flex: 1, maxHeight: 120, minHeight: 44, backgroundColor: '#F5F3F7', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter-Regular', color: '#2B2531' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND_PURPLE, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#C9BFD6' },

  attachMenu: { position: 'absolute', bottom: 76, left: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#ECE8F1', paddingVertical: 6, minWidth: 190, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 12, zIndex: 20 },
  attachOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  attachOptionText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#17131C' },
  pendingBar: { maxHeight: 84, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1EDF5' },
  pendingContent: { padding: 10, gap: 10 },
  pendingItem: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#F3EFF7', overflow: 'hidden' },
  pendingThumb: { width: 64, height: 64 },
  pendingDoc: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  pendingDocName: { fontSize: 8, fontFamily: 'Inter-Medium', color: '#5C5563', marginTop: 2, textAlign: 'center' },
  pendingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(23,19,28,0.5)', alignItems: 'center', justifyContent: 'center' },
  pendingError: { backgroundColor: 'rgba(180,35,24,0.72)' },
  retryText: { color: '#FFFFFF', fontSize: 9, fontFamily: 'Inter-SemiBold', marginTop: 2 },
  pendingRemove: { position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(23,19,28,0.7)', alignItems: 'center', justifyContent: 'center' },
});
