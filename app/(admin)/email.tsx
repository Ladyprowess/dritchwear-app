import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { AlignLeft, AlertCircle, Bold, CalendarClock, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Code2, Eye, FileText, Italic, Link as LinkIcon, List, Mail, Paperclip, RefreshCw, Send, Trash2, Underline, UserRound, Users } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { DateTimeField } from '@/components/DateTimeField';

type Audience = 'individual' | 'customers';
type Format = 'text' | 'html';
type CommunicationType = 'customer' | 'partner';
type Attachment = { filename: string; content: string; size: number; contentType?: string };
type RecipientStatus = {
  email: string; provider_id: string | null; status: string; last_event: string | null; updated_at?: string;
  sent_at?: string; delivered_at?: string; opened_at?: string; clicked_at?: string; bounced_at?: string; complained_at?: string;
};
type HistoryRow = {
  id: string; sender: string; audience: string; recipients: string[]; subject: string;
  status: string; tracking_status?: string; attachment_names?: string[]; created_at: string;
  tracking_data?: RecipientStatus[];
};
type ScheduleStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
type ScheduledRow = {
  id: string; channel: string; scheduled_at: string; status: ScheduleStatus;
  error: string | null; created_at: string;
  payload: { subject?: string; recipients?: string[]; audience?: string };
};

// Visual treatment for each scheduled-email status.
const SCHEDULE_BADGE: Record<ScheduleStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Scheduled', bg: '#EEF2FF', fg: '#3730A3' },
  processing: { label: 'Sending…', bg: '#EFF6FF', fg: '#1D4ED8' },
  sent: { label: 'Sent', bg: '#ECFDF3', fg: '#16794B' },
  failed: { label: 'Failed', bg: '#FEF3F2', fg: '#B42318' },
  cancelled: { label: 'Cancelled', bg: '#F3F4F6', fg: '#6B7280' },
};

// Roll the per-recipient tracking up into counts for a compact summary line.
const EVENT_LABELS: Record<string, string> = {
  complained: 'complained', bounced: 'bounced', delivery_delayed: 'delayed',
  clicked: 'clicked', opened: 'opened', delivered: 'delivered', sent: 'sent', queued: 'queued', failed: 'failed',
};
function summarizeTracking(rows?: RecipientStatus[]): { label: string; count: number }[] {
  if (!rows?.length) return [];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = row.last_event || row.status || 'sent';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ label: EVENT_LABELS[key] || key, count }));
}

type CampaignMetric = { label: string; count: number; rate: number };
function campaignMetrics(rows?: RecipientStatus[]): CampaignMetric[] {
  if (!rows?.length) return [];
  const state = (row: RecipientStatus) => row.last_event || row.status || 'queued';
  const total = rows.length;
  const delivered = rows.filter(row => row.delivered_at || ['delivered', 'opened', 'clicked'].includes(state(row))).length;
  const opened = rows.filter(row => row.opened_at || row.clicked_at || ['opened', 'clicked'].includes(state(row))).length;
  const clicked = rows.filter(row => row.clicked_at || state(row) === 'clicked').length;
  const bounced = rows.filter(row => row.bounced_at || state(row) === 'bounced').length;
  const complained = rows.filter(row => row.complained_at || state(row) === 'complained').length;
  const percent = (count: number, denominator: number) => denominator ? Math.round((count / denominator) * 1000) / 10 : 0;
  return [
    { label: 'Delivered', count: delivered, rate: percent(delivered, total) },
    { label: 'Open rate', count: opened, rate: percent(opened, delivered) },
    { label: 'Click rate', count: clicked, rate: percent(clicked, delivered) },
    { label: 'Bounce rate', count: bounced, rate: percent(bounced, total) },
    { label: 'Complaint rate', count: complained, rate: percent(complained, total) },
  ];
}

const PAGE_SIZE = 10;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function safePreviewHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<iframe[\s\S]*?<\/iframe>/gi, '').replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
}

function HtmlPreview({ html }: { html: string }) {
  if (Platform.OS === 'web') {
    return React.createElement('div', {
      style: { fontFamily: 'Arial, sans-serif', fontSize: 14, lineHeight: 1.65, color: '#17131c' },
      dangerouslySetInnerHTML: { __html: safePreviewHtml(html) },
    });
  }
  return <Text style={styles.previewBody}>{html.replace(/<[^>]+>/g, ' ')}</Text>;
}

export default function AdminEmailScreen() {
  const [communicationType, setCommunicationType] = useState<CommunicationType>('partner');
  const [audience, setAudience] = useState<Audience>('individual');
  const [format, setFormat] = useState<Format>('html');
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [content, setContent] = useState('<p>Hello,</p>\n<p>Write your message here.</p>');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [syncingRow, setSyncingRow] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    const from = (historyPage - 1) * PAGE_SIZE;
    const { data, count, error } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!error) {
      setHistory((data || []) as HistoryRow[]);
      setHistoryCount(count || 0);
    } else {
      setHistoryError('Email history could not be loaded. Try again.');
    }
    setHistoryLoading(false);
  }, [historyPage]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledError, setScheduledError] = useState<string | null>(null);
  const [cancelingRow, setCancelingRow] = useState<string | null>(null);

  const loadScheduled = useCallback(async () => {
    setScheduledLoading(true);
    setScheduledError(null);
    const { data, error } = await supabase
      .from('scheduled_communications')
      .select('*')
      .eq('channel', 'email')
      // Only the actionable ones - sent emails already show in Email history,
      // and cancelled ones are done.
      .in('status', ['pending', 'processing', 'failed'])
      .order('scheduled_at', { ascending: false })
      .limit(25);
    if (!error) setScheduled((data || []) as ScheduledRow[]);
    else setScheduledError('Scheduled emails could not be loaded. Try again.');
    setScheduledLoading(false);
  }, []);

  useEffect(() => { void loadScheduled(); }, [loadScheduled]);

  const cancelScheduled = async (id: string) => {
    setCancelingRow(id);
    // Only pending jobs can be cancelled; the filter avoids racing a job the
    // scheduler has already picked up.
    await supabase
      .from('scheduled_communications')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending');
    await loadScheduled();
    setCancelingRow(null);
  };

  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState<Date | null>(null);
  const [reschedSaving, setReschedSaving] = useState(false);
  const [reschedError, setReschedError] = useState<string | null>(null);

  const startReschedule = (row: ScheduledRow) => {
    setReschedError(null);
    setReschedulingId(row.id);
    setRescheduleAt(new Date(row.scheduled_at));
  };

  const saveReschedule = async (id: string) => {
    if (!rescheduleAt || rescheduleAt.getTime() <= Date.now() + 60_000) {
      setReschedError('Choose a time at least 1 minute in the future.');
      return;
    }
    setReschedSaving(true);
    setReschedError(null);
    const { error } = await supabase
      .from('scheduled_communications')
      .update({ scheduled_at: rescheduleAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending');
    setReschedSaving(false);
    if (error) { setReschedError(error.message); return; }
    setReschedulingId(null);
    setRescheduleAt(null);
    await loadScheduled();
  };

  const applyMarkup = (open: string, close: string, fallback: string) => {
    if (format !== 'html') setFormat('html');
    const start = selection.start || content.length;
    const end = selection.end || start;
    const selected = content.slice(start, end) || fallback;
    const next = `${content.slice(0, start)}${open}${selected}${close}${content.slice(end)}`;
    setContent(next);
    const cursor = start + open.length + selected.length + close.length;
    setSelection({ start: cursor, end: cursor });
  };

  const pickAttachments = async () => {
    setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (picked.canceled) return;
    const next: Attachment[] = [];
    for (const asset of picked.assets) {
      if (attachments.length + next.length >= 10) break;
      let base64 = '';
      if (Platform.OS === 'web' && asset.file) base64 = arrayBufferToBase64(await asset.file.arrayBuffer());
      else base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      next.push({ filename: asset.name, content: base64, size: asset.size || 0, contentType: asset.mimeType || undefined });
    }
    const totalBytes = [...attachments, ...next].reduce((sum, item) => sum + item.size, 0);
    if (totalBytes > 10 * 1024 * 1024) {
      setResult({ ok: false, message: 'Attachments must be 10 MB or less in total.' });
      return;
    }
    setAttachments(current => [...current, ...next]);
  };

  const send = async () => {
    setResult(null);
    if (!subject.trim() || !content.trim()) {
      setResult({ ok: false, message: 'Add a subject and message before sending.' });
      return;
    }
    const emailList = recipients.split(/[\n,;]/).map(email => email.trim()).filter(Boolean);
    if (audience === 'individual' && !emailList.length) {
      setResult({ ok: false, message: 'Add at least one recipient email address.' });
      return;
    }
    setSending(true);
    const scheduleCandidate = scheduleEnabled ? scheduleAt : null;
    const scheduledAt = scheduleCandidate && Number.isFinite(scheduleCandidate.getTime()) ? scheduleCandidate.toISOString() : null;
    if (scheduleEnabled && (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now() + 60_000)) {
      setSending(false); setResult({ ok: false, message: 'Choose a schedule at least 1 minute in the future.' }); return;
    }
    if (scheduleEnabled) {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('scheduled_communications').insert({
        created_by: auth.user?.id, channel: 'email', scheduled_at: scheduledAt,
        payload: { audience, communicationType, recipients: emailList, subject: subject.trim(), previewText: previewText.trim(), content: content.trim(), format, attachments },
      });
      setSending(false);
      if (error) { setResult({ ok: false, message: error.message }); return; }
      setResult({ ok: true, message: `Email scheduled for ${new Date(scheduledAt!).toLocaleString()}.` });
      setRecipients(''); setSubject(''); setPreviewText(''); setContent(''); setAttachments([]); setScheduleEnabled(false); setScheduleAt(null);
      void loadScheduled();
      return;
    }
    const { data, error } = await supabase.functions.invoke('send-admin-email', {
      body: {
        audience, communicationType, recipients: emailList, subject: subject.trim(),
        previewText: previewText.trim(), content: content.trim(), format, attachments,
      },
    });
    setSending(false);
    if (error || data?.error) {
      setResult({ ok: false, message: data?.error || error?.message || 'Email could not be sent.' });
      return;
    }
    setResult({ ok: true, message: `Sent to ${data.sent} recipient${data.sent === 1 ? '' : 's'}.` });
    setRecipients(''); setSubject(''); setPreviewText(''); setContent(''); setAttachments([]);
    setHistoryPage(1); await loadHistory();
  };

  const syncTracking = async (messageId: string) => {
    setSyncingRow(messageId);
    setHistoryError(null);
    setSyncNotice(null);
    const { data, error } = await supabase.functions.invoke('send-admin-email', { body: { action: 'sync', messageId } });
    const syncError = error || data?.error ? data?.error || error?.message || 'Tracking could not be refreshed.' : null;
    await loadHistory();
    if (syncError) setHistoryError(syncError);
    else if (data?.missingCount > 0 && data?.syncedCount === 0) setHistoryError('No Resend records could be matched for this legacy email. Its engagement data is unavailable.');
    else if (data?.missingCount > 0) setSyncNotice(`Updated ${data.syncedCount} recipient${data.syncedCount === 1 ? '' : 's'}; ${data.missingCount} legacy record${data.missingCount === 1 ? '' : 's'} could not be matched.`);
    else setSyncNotice(`Tracking updated for ${data?.syncedCount || 0} recipient${data?.syncedCount === 1 ? '' : 's'}.`);
    setSyncingRow(null);
  };

  const totalPages = Math.max(1, Math.ceil(historyCount / PAGE_SIZE));

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}>
          <View style={styles.headingIcon}><Mail size={22} color="#5A2D82" /></View>
          <View><Text style={styles.title}>Brand communications</Text><Text style={styles.subtitle}>Compose, preview, attach and track email from support@dritchwear.com</Text></View>
        </View>

        <View style={styles.modeRow}>
          <Pressable style={[styles.modeCard, communicationType === 'partner' && styles.modeCardActive]} onPress={() => { setCommunicationType('partner'); setAudience('individual'); }}>
            <UserRound size={20} color="#5A2D82" /><View><Text style={styles.modeTitle}>Partner & investor</Text><Text style={styles.modeCopy}>Personal correspondence and proposals</Text></View>
          </Pressable>
          <Pressable style={[styles.modeCard, communicationType === 'customer' && styles.modeCardActive]} onPress={() => setCommunicationType('customer')}>
            <Users size={20} color="#5A2D82" /><View><Text style={styles.modeTitle}>Customer</Text><Text style={styles.modeCopy}>Service, order and brand communication</Text></View>
          </Pressable>
        </View>

        <View style={styles.workspace}>
          <View style={styles.panel}>
            <Text style={styles.label}>Recipients</Text>
            <View style={styles.segmentRow}>
              <Pressable style={[styles.segment, audience === 'individual' && styles.segmentActive]} onPress={() => setAudience('individual')}><UserRound size={17} color={audience === 'individual' ? '#FFFFFF' : '#5A2D82'} /><Text style={[styles.segmentText, audience === 'individual' && styles.segmentTextActive]}>Specific recipients</Text></Pressable>
              {communicationType === 'customer' && <Pressable style={[styles.segment, audience === 'customers' && styles.segmentActive]} onPress={() => setAudience('customers')}><Users size={17} color={audience === 'customers' ? '#FFFFFF' : '#5A2D82'} /><Text style={[styles.segmentText, audience === 'customers' && styles.segmentTextActive]}>All customers</Text></Pressable>}
            </View>

            {audience === 'individual' && <View style={styles.field}><Text style={styles.label}>Recipient emails *</Text><TextInput style={[styles.input, styles.recipientInput]} value={recipients} onChangeText={setRecipients} placeholder="investor@example.com, customer@example.com" placeholderTextColor="#8A838F" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} multiline /><Text style={styles.hint}>Separate addresses with commas or new lines. Maximum 100 per send.</Text></View>}

            <View style={styles.field}><Text style={styles.label}>Subject *</Text><TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="A clear email subject" placeholderTextColor="#8A838F" maxLength={160} /><Text style={styles.counter}>{subject.length}/160</Text></View>
            <View style={styles.field}><Text style={styles.label}>Inbox preview text</Text><TextInput style={styles.input} value={previewText} onChangeText={setPreviewText} placeholder="A short summary shown beside the subject" placeholderTextColor="#8A838F" maxLength={180} /><Text style={styles.counter}>{previewText.length}/180</Text></View>

            <View style={styles.editorHeading}><Text style={styles.label}>Message *</Text><View style={styles.segmentRowCompact}><Pressable style={[styles.smallSegment, format === 'text' && styles.formatActive]} onPress={() => setFormat('text')}><AlignLeft size={15} color="#5A2D82" /><Text style={styles.smallSegmentText}>Text</Text></Pressable><Pressable style={[styles.smallSegment, format === 'html' && styles.formatActive]} onPress={() => setFormat('html')}><Code2 size={15} color="#5A2D82" /><Text style={styles.smallSegmentText}>Rich HTML</Text></Pressable></View></View>
            <View style={styles.toolbar}>
              <Pressable accessibilityLabel="Bold" style={styles.tool} onPress={() => applyMarkup('<strong>', '</strong>', 'bold text')}><Bold size={16} color="#302A34" /></Pressable>
              <Pressable accessibilityLabel="Italic" style={styles.tool} onPress={() => applyMarkup('<em>', '</em>', 'italic text')}><Italic size={16} color="#302A34" /></Pressable>
              <Pressable accessibilityLabel="Underline" style={styles.tool} onPress={() => applyMarkup('<u>', '</u>', 'underlined text')}><Underline size={16} color="#302A34" /></Pressable>
              <Pressable accessibilityLabel="Heading" style={styles.tool} onPress={() => applyMarkup('<h2>', '</h2>', 'Heading')}><Text style={styles.headingTool}>H2</Text></Pressable>
              <Pressable accessibilityLabel="Bullet list" style={styles.tool} onPress={() => applyMarkup('<ul><li>', '</li></ul>', 'List item')}><List size={16} color="#302A34" /></Pressable>
              <Pressable accessibilityLabel="Link" style={styles.tool} onPress={() => applyMarkup('<a href="https://">', '</a>', 'link text')}><LinkIcon size={16} color="#302A34" /></Pressable>
            </View>
            <TextInput style={[styles.input, styles.bodyInput]} value={content} onChangeText={setContent} onSelectionChange={event => setSelection(event.nativeEvent.selection)} selection={selection} placeholder={format === 'html' ? '<p>Hello...</p>' : 'Write your email…'} placeholderTextColor="#8A838F" multiline textAlignVertical="top" />
            <Text style={styles.hint}>Dritchwear’s selected customer or partner header and footer are added automatically.</Text>

            <View style={styles.attachmentHeader}><Text style={styles.label}>Attachments</Text><Pressable style={styles.attachButton} onPress={pickAttachments}><Paperclip size={16} color="#5A2D82" /><Text style={styles.attachText}>Add files</Text></Pressable></View>
            {attachments.map((item, index) => <View key={`${item.filename}-${index}`} style={styles.attachmentRow}><FileText size={17} color="#5A2D82" /><View style={{ flex: 1 }}><Text style={styles.attachmentName}>{item.filename}</Text><Text style={styles.attachmentSize}>{(item.size / 1024).toFixed(1)} KB</Text></View><Pressable accessibilityLabel={`Remove ${item.filename}`} style={styles.removeAttachment} onPress={() => setAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} color="#B42318" /></Pressable></View>)}
            <Text style={styles.hint}>Up to 10 files and 10 MB total.</Text>

            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: scheduleEnabled }} style={[styles.scheduleToggle, scheduleEnabled && styles.scheduleToggleActive]} onPress={() => setScheduleEnabled(value => !value)}><CalendarClock size={18} color="#5A2D82" /><View style={{ flex: 1 }}><Text style={styles.scheduleTitle}>{scheduleEnabled ? 'Scheduled delivery' : 'Send now'}</Text><Text style={styles.hint}>Schedule uses your current local time.</Text></View></Pressable>
            {scheduleEnabled && <View style={styles.scheduleFields}><View style={{ flex: 1 }}><Text style={styles.label}>Date & time</Text><DateTimeField value={scheduleAt} onChange={setScheduleAt} minimumDate={new Date(Date.now() + 60_000)} /></View></View>}
            {result && <View accessibilityRole="alert" style={[styles.result, result.ok ? styles.success : styles.error]}>{result.ok ? <CheckCircle size={18} color="#16794B" /> : <AlertCircle size={18} color="#B42318" />}<Text style={[styles.resultText, { color: result.ok ? '#16794B' : '#B42318' }]}>{result.message}</Text></View>}
            <Pressable style={[styles.sendButton, sending && styles.disabled]} onPress={send} disabled={sending}><Send size={18} color="#FFFFFF" /><Text style={styles.sendText}>{sending ? 'Working…' : scheduleEnabled ? 'Schedule email' : 'Send email'}</Text></Pressable>
          </View>

          <View style={styles.previewColumn}>
            <Pressable style={styles.previewToggle} onPress={() => setShowPreview(value => !value)}><Eye size={16} color="#5A2D82" /><Text style={styles.previewToggleText}>{showPreview ? 'Hide preview' : 'Show preview'}</Text></Pressable>
            {showPreview && (
              <View style={styles.emailPreview}>
                <View style={styles.previewTop}><Text style={styles.previewBrand}>DRITCHWEAR</Text></View>
                <View style={styles.inboxPreview}><Text style={styles.previewSubject}>{subject || 'Your email subject'}</Text><Text style={styles.previewSnippet}>{previewText || 'Inbox preview text will appear here.'}</Text></View>
                <View style={styles.previewContent}><HtmlPreview html={format === 'html' ? content : content.replace(/\n/g, '<br/>')} /></View>
                {communicationType === 'customer' && (
                  <>
                    <View style={styles.safetyPreview}>
                      <Text style={styles.previewSectionTitle}>Anti-scam reminders</Text>
                      <Text style={styles.previewSectionCopy}>Stay safe when ordering, receiving payment links or getting support from Dritchwear.</Text>
                      {[
                        'Never share your password, OTP, passcode, card PIN or CVV.',
                        'Trust only dritchwear.com and app.dritchwear.com.',
                        'Avoid suspicious payment, support and giveaway links.',
                        'Stop and contact support if something feels wrong.',
                      ].map((text, index) => <View key={text} style={styles.safetyRow}><View style={styles.safetyNumber}><Text style={styles.safetyNumberText}>{index + 1}</Text></View><Text style={styles.safetyText}>{text}</Text></View>)}
                    </View>
                    <View style={styles.installPreview}>
                      <Text style={styles.previewSectionTitle}>Install Dritchwear for the best experience</Text>
                      <Text style={styles.previewSectionCopy}>Dritchwear works best when added to your home screen, like a normal app.</Text>
                      <View style={styles.installColumns}><View style={styles.installColumn}><Text style={styles.installLabel}>iPhone</Text><Text style={styles.previewSectionCopy}>Safari → Share → Add to Home Screen</Text></View><View style={styles.installColumn}><Text style={styles.installLabel}>Android</Text><Text style={styles.previewSectionCopy}>Chrome menu → Install app</Text></View></View>
                    </View>
                  </>
                )}
                <View style={styles.previewFooterLeft}><Text style={styles.previewFooterBrand}>Dritchwear Collections</Text><Text style={styles.previewFooterText}>Shop & track orders · Customer support · Website</Text><Text style={styles.previewFooterText}>support@dritchwear.com · dritchwear.com</Text><Text style={styles.previewFooterText}>{communicationType === 'customer' ? 'Instagram · TikTok · LinkedIn · X' : 'All rights reserved'}</Text></View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}><View><Text style={styles.historyTitle}>Scheduled emails</Text><Text style={styles.subtitle}>{scheduled.filter(row => row.status === 'pending').length} pending</Text></View><Pressable accessibilityLabel="Refresh scheduled emails" style={styles.refreshButton} onPress={loadScheduled}><RefreshCw size={17} color="#5A2D82" /></Pressable></View>
          {!!scheduledError && <View accessibilityRole="alert" style={[styles.result, styles.error, styles.historyError]}><AlertCircle size={18} color="#B42318" /><Text style={[styles.resultText, { color: '#B42318' }]}>{scheduledError}</Text><Pressable accessibilityRole="button" style={styles.retryButton} onPress={loadScheduled}><Text style={styles.trackText}>Retry</Text></Pressable></View>}
          {scheduledLoading ? <View accessibilityLabel="Loading scheduled emails"><View style={styles.historySkeleton} /><View style={styles.historySkeleton} /></View> : scheduled.length ? scheduled.map(row => {
            const badge = SCHEDULE_BADGE[row.status] ?? SCHEDULE_BADGE.pending;
            const canceling = cancelingRow === row.id;
            return <View key={row.id} style={styles.historyItem}>
              <View style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historySubject}>{row.payload?.subject || '(no subject)'}</Text>
                  <Text style={styles.historyMeta}>Scheduled for {new Date(row.scheduled_at).toLocaleString()} · {row.payload?.recipients?.length || 0} recipient(s)</Text>
                  {row.status === 'failed' && !!row.error && <Text style={styles.scheduleErrorText}>Error: {row.error}</Text>}
                </View>
                <View style={styles.historyRight}>
                  <View style={[styles.scheduleBadge, { backgroundColor: badge.bg }]}><Text style={[styles.scheduleBadgeText, { color: badge.fg }]}>{badge.label}</Text></View>
                  {row.status === 'pending' && <View style={styles.scheduleActionsRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Reschedule ${row.payload?.subject || ''}`} style={styles.detailsButton} onPress={() => startReschedule(row)}><CalendarClock size={14} color="#5A2D82" /><Text style={styles.trackText}>Reschedule</Text></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Cancel scheduled email ${row.payload?.subject || ''}`} accessibilityState={{ busy: canceling, disabled: canceling }} disabled={canceling} style={[styles.detailsButton, canceling && styles.disabled]} onPress={() => cancelScheduled(row.id)}><Trash2 size={14} color="#B42318" /><Text style={[styles.trackText, { color: '#B42318' }]}>{canceling ? 'Cancelling…' : 'Cancel'}</Text></Pressable>
                  </View>}
                </View>
              </View>
              {reschedulingId === row.id && <View style={styles.rescheduleEditor}>
                <Text style={styles.label}>New date & time</Text>
                <DateTimeField value={rescheduleAt} onChange={setRescheduleAt} minimumDate={new Date(Date.now() + 60_000)} />
                {!!reschedError && <Text style={styles.scheduleErrorText}>{reschedError}</Text>}
                <View style={styles.rescheduleActions}>
                  <Pressable accessibilityRole="button" accessibilityState={{ busy: reschedSaving, disabled: reschedSaving }} disabled={reschedSaving} style={[styles.saveButton, reschedSaving && styles.disabled]} onPress={() => saveReschedule(row.id)}><Text style={styles.saveButtonText}>{reschedSaving ? 'Saving…' : 'Save new time'}</Text></Pressable>
                  <Pressable accessibilityRole="button" style={styles.detailsButton} onPress={() => { setReschedulingId(null); setReschedError(null); }}><Text style={styles.trackText}>Dismiss</Text></Pressable>
                </View>
              </View>}
            </View>;
          }) : <View style={styles.emptyState}><CalendarClock size={28} color="#746D79" /><Text style={styles.emptyTitle}>No scheduled emails</Text><Text style={styles.emptyHistory}>Emails you schedule will appear here until they send.</Text></View>}
        </View>

        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}><View><Text style={styles.historyTitle}>Email history</Text><Text style={styles.subtitle}>{historyCount} recorded message{historyCount === 1 ? '' : 's'}</Text></View><Pressable accessibilityLabel="Refresh history" style={styles.refreshButton} onPress={loadHistory}><RefreshCw size={17} color="#5A2D82" /></Pressable></View>
          {!!historyError && <View accessibilityRole="alert" style={[styles.result, styles.error, styles.historyError]}><AlertCircle size={18} color="#B42318" /><Text style={[styles.resultText, { color: '#B42318' }]}>{historyError}</Text><Pressable accessibilityRole="button" style={styles.retryButton} onPress={loadHistory}><Text style={styles.trackText}>Retry</Text></Pressable></View>}
          {!!syncNotice && <View accessibilityRole="alert" style={[styles.result, styles.success, styles.historyError]}><CheckCircle size={18} color="#16794B" /><Text style={[styles.resultText, { color: '#16794B' }]}>{syncNotice}</Text></View>}
          {historyLoading ? <View accessibilityLabel="Loading email history"><View style={styles.historySkeleton} /><View style={styles.historySkeleton} /><View style={styles.historySkeleton} /></View> : history.length ? history.map(row => {
            const summary = summarizeTracking(row.tracking_data);
            const metrics = campaignMetrics(row.tracking_data);
            const isExpanded = expandedRow === row.id;
            const isSyncing = syncingRow === row.id;
            const hasDeliveryIssue = ['bounced', 'complained', 'failed', 'delivery_delayed'].includes(row.tracking_status || row.status);
            return <View key={row.id} style={styles.historyItem}>
              <View style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historySubject}>{row.subject}</Text>
                  <Text style={styles.historyMeta}>{new Date(row.created_at).toLocaleString()} · {row.recipients?.length || 0} recipient(s)</Text>
                  {!!row.attachment_names?.length && <Text style={styles.historyMeta}>{row.attachment_names.length} attachment(s)</Text>}
                  {!!metrics.length && <View style={styles.metricsGrid}>{metrics.map(metric => <View key={metric.label} style={styles.metricCard}><Text style={styles.metricLabel}>{metric.label}</Text><Text style={styles.metricRate}>{metric.rate}%</Text><Text style={styles.metricCount}>{metric.count} recipient{metric.count === 1 ? '' : 's'}</Text></View>)}</View>}
                  {!!summary.length && <View style={styles.statusSummary}>{summary.map(item => <View key={item.label} style={styles.countBadge}><Text style={styles.countText}>{item.count} {item.label}</Text></View>)}</View>}
                </View>
                <View style={styles.historyRight}>
                  {hasDeliveryIssue && <View style={styles.warningBadge}><AlertCircle size={13} color="#B54708" /><Text style={styles.warningText}>Delivery issue</Text></View>}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Refresh tracking for ${row.subject}`} accessibilityState={{ busy: isSyncing, disabled: isSyncing }} disabled={isSyncing} style={[styles.trackButton, isSyncing && styles.disabled]} onPress={() => syncTracking(row.id)}><RefreshCw size={14} color="#5A2D82" /><Text style={styles.trackText}>{isSyncing ? 'Refreshing…' : 'Refresh status'}</Text></Pressable>
                  {!!row.tracking_data?.length && <Pressable accessibilityRole="button" accessibilityState={{ expanded: isExpanded }} style={styles.detailsButton} onPress={() => setExpandedRow(isExpanded ? null : row.id)}><Text style={styles.trackText}>{isExpanded ? 'Hide' : 'Recipients'}</Text>{isExpanded ? <ChevronUp size={14} color="#5A2D82" /> : <ChevronDown size={14} color="#5A2D82" />}</Pressable>}
                </View>
              </View>
              {isExpanded && <View style={styles.recipientList}>{row.tracking_data!.map(item => <View key={`${item.email}-${item.provider_id || 'none'}`} style={styles.recipientRow}><View style={{ flex: 1 }}><Text style={styles.recipientEmail}>{item.email}</Text><Text style={styles.providerId} numberOfLines={1}>{item.provider_id || 'Provider ID unavailable'}</Text></View><Text style={styles.recipientStatus}>{EVENT_LABELS[item.last_event || item.status] || item.last_event || item.status}</Text></View>)}</View>}
            </View>;
          }) : <View style={styles.emptyState}><Mail size={28} color="#746D79" /><Text style={styles.emptyTitle}>No emails yet</Text><Text style={styles.emptyHistory}>Sent messages and recipient delivery activity will appear here.</Text></View>}
          <View style={styles.pagination}><Pressable disabled={historyPage === 1} style={[styles.pageButton, historyPage === 1 && styles.disabled]} onPress={() => setHistoryPage(page => page - 1)}><ChevronLeft size={16} color="#5A2D82" /><Text style={styles.pageText}>Previous</Text></Pressable><Text style={styles.pageCount}>Page {historyPage} of {totalPages}</Text><Pressable disabled={historyPage >= totalPages} style={[styles.pageButton, historyPage >= totalPages && styles.disabled]} onPress={() => setHistoryPage(page => page + 1)}><Text style={styles.pageText}>Next</Text><ChevronRight size={16} color="#5A2D82" /></Pressable></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safetyPreview: { padding: 20, borderTopWidth: 1, borderTopColor: '#E8E3EB', backgroundColor: '#FAF9FB', alignItems: 'flex-start' },
  previewSectionTitle: { color: '#17131C', fontFamily: 'Inter-Bold', fontSize: 17 },
  previewSectionCopy: { color: '#665F6C', fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 17, marginTop: 6 },
  safetyRow: { width: '100%', minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 9, borderWidth: 1, borderColor: '#E7E1EA', backgroundColor: '#FFFFFF' },
  safetyNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FDB813', alignItems: 'center', justifyContent: 'center' },
  safetyNumberText: { color: '#3D1E59', fontFamily: 'Inter-Bold', fontSize: 12 },
  safetyText: { flex: 1, color: '#312C35', fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 17 },
  installPreview: { padding: 20, borderTopWidth: 1, borderTopColor: '#EAD78B', backgroundColor: '#FFF8DF', alignItems: 'flex-start' },
  installColumns: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 12 },
  installColumn: { flex: 1, minWidth: 120 },
  installLabel: { color: '#17131C', fontFamily: 'Inter-Bold', fontSize: 12 },
  previewFooterLeft: { padding: 20, borderTopWidth: 1, borderTopColor: '#E8E3EB', alignItems: 'flex-start', backgroundColor: '#FFFFFF' },
  page: { flex: 1, backgroundColor: '#F8F7F9' }, content: { width: '100%', maxWidth: 1320, alignSelf: 'center', padding: 24, paddingBottom: 80 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }, headingIcon: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#F3EFF7', alignItems: 'center', justifyContent: 'center' }, title: { fontFamily: 'Inter-Bold', fontSize: 26, color: '#17131C' }, subtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#665F6C', marginTop: 3 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }, modeCard: { minWidth: 280, flex: 1, minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E3EB', borderRadius: 12 }, modeCardActive: { borderColor: '#5A2D82', backgroundColor: '#F8F5FB' }, modeTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#17131C' }, modeCopy: { fontFamily: 'Inter-Regular', fontSize: 11, color: '#746D79', marginTop: 3 },
  workspace: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 18 }, panel: { flex: 1.15, minWidth: 340, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E3EB', borderRadius: 14, padding: 22 }, previewColumn: { flex: 0.85, minWidth: 320 },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#302A34', marginBottom: 8 }, segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }, segmentRowCompact: { flexDirection: 'row', gap: 8 }, segment: { minHeight: 44, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#D8D2DC', flexDirection: 'row', alignItems: 'center', gap: 8 }, segmentActive: { backgroundColor: '#5A2D82', borderColor: '#5A2D82' }, segmentText: { fontFamily: 'Inter-Medium', fontSize: 13, color: '#302A34' }, segmentTextActive: { color: '#FFFFFF' },
  field: { marginBottom: 20 }, input: { minHeight: 48, borderWidth: 1, borderColor: '#CFC8D3', borderRadius: 8, paddingHorizontal: 14, fontFamily: 'Inter-Regular', fontSize: 14, color: '#17131C', backgroundColor: '#FFFFFF' }, recipientInput: { minHeight: 72, paddingTop: 12 }, bodyInput: { minHeight: 260, paddingTop: 14, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter-Regular' }, hint: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, color: '#746D79', marginTop: 6 }, counter: { alignSelf: 'flex-end', fontFamily: 'Inter-Regular', fontSize: 10, color: '#746D79', marginTop: 4 },
  editorHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, smallSegment: { minHeight: 38, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#D8D2DC', borderRadius: 7 }, smallSegmentText: { color: '#302A34', fontFamily: 'Inter-Medium', fontSize: 11 }, formatActive: { backgroundColor: '#F3EFF7', borderColor: '#5A2D82' }, toolbar: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderWidth: 1, borderBottomWidth: 0, borderColor: '#CFC8D3', borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: '#F8F7F9' }, tool: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6 }, headingTool: { color: '#302A34', fontFamily: 'Inter-Bold', fontSize: 12 },
  attachmentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }, attachButton: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3EFF7', borderRadius: 8 }, attachText: { color: '#5A2D82', fontFamily: 'Inter-SemiBold', fontSize: 12 }, attachmentRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#E8E3EB' }, attachmentName: { color: '#302A34', fontFamily: 'Inter-Medium', fontSize: 12 }, attachmentSize: { color: '#746D79', fontFamily: 'Inter-Regular', fontSize: 10, marginTop: 2 }, removeAttachment: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  result: { minHeight: 48, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18, marginBottom: 14 }, success: { backgroundColor: '#ECFDF3' }, error: { backgroundColor: '#FEF3F2' }, resultText: { flex: 1, fontFamily: 'Inter-Medium', fontSize: 13 }, sendButton: { minHeight: 50, borderRadius: 8, backgroundColor: '#5A2D82', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 }, disabled: { opacity: 0.45 }, sendText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#FFFFFF' },
  scheduleToggle: { minHeight: 56, marginTop: 18, padding: 12, borderWidth: 1, borderColor: '#E8E3EB', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F7F9' }, scheduleToggleActive: { borderColor: '#5A2D82', backgroundColor: '#F3EFF7' }, scheduleTitle: { color: '#302A34', fontFamily: 'Inter-SemiBold', fontSize: 13 }, scheduleFields: { flexDirection: 'row', gap: 12, marginTop: 14 },
  previewToggle: { minHeight: 44, alignSelf: 'flex-end', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, previewToggleText: { color: '#5A2D82', fontFamily: 'Inter-SemiBold', fontSize: 12 }, emailPreview: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E3EB', borderRadius: 14, overflow: 'hidden' }, previewTop: { backgroundColor: '#5A2D82', padding: 20 }, previewBrand: { color: '#FFFFFF', fontFamily: 'Inter-Bold', fontSize: 18, letterSpacing: 1.2 }, previewType: { color: '#FFF6D8', fontFamily: 'Inter-Bold', fontSize: 9, letterSpacing: 1.4, marginTop: 5 }, inboxPreview: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#E8E3EB', backgroundColor: '#F8F7F9' }, previewSubject: { color: '#17131C', fontFamily: 'Inter-SemiBold', fontSize: 14 }, previewSnippet: { color: '#746D79', fontFamily: 'Inter-Regular', fontSize: 11, marginTop: 4 }, previewContent: { padding: 24, minHeight: 220 }, previewBody: { color: '#17131C', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 23 }, previewFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#E8E3EB', alignItems: 'center', backgroundColor: '#F8F7F9' }, previewFooterBrand: { color: '#17131C', fontFamily: 'Inter-Bold', fontSize: 14 }, previewFooterText: { color: '#665F6C', fontFamily: 'Inter-Regular', fontSize: 11, marginTop: 6 },
  historyPanel: { marginTop: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E3EB', borderRadius: 14, padding: 20 }, historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, historyTitle: { color: '#17131C', fontFamily: 'Inter-Bold', fontSize: 18 }, refreshButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#F3EFF7' }, historyItem: { borderTopWidth: 1, borderTopColor: '#E8E3EB' }, historyRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, historySubject: { color: '#17131C', fontFamily: 'Inter-SemiBold', fontSize: 13 }, historyMeta: { color: '#746D79', fontFamily: 'Inter-Regular', fontSize: 11, marginTop: 4 }, historyRight: { alignItems: 'flex-end', gap: 4 }, warningBadge: { minHeight: 28, borderRadius: 999, backgroundColor: '#FFF7ED', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 }, warningText: { color: '#B54708', fontFamily: 'Inter-SemiBold', fontSize: 10 }, trackButton: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' }, detailsButton: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' }, trackText: { color: '#5A2D82', fontFamily: 'Inter-SemiBold', fontSize: 11 }, metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, metricCard: { minWidth: 96, flexGrow: 1, maxWidth: 140, borderWidth: 1, borderColor: '#E8E3EB', borderRadius: 8, backgroundColor: '#F8F7F9', padding: 10 }, metricLabel: { color: '#665F6C', fontFamily: 'Inter-Medium', fontSize: 10 }, metricRate: { color: '#17131C', fontFamily: 'Inter-Bold', fontSize: 18, marginTop: 3 }, metricCount: { color: '#746D79', fontFamily: 'Inter-Regular', fontSize: 9, marginTop: 2 }, statusSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }, countBadge: { borderRadius: 999, backgroundColor: '#F3EFF7', paddingHorizontal: 8, paddingVertical: 4 }, countText: { color: '#5A2D82', fontFamily: 'Inter-SemiBold', fontSize: 10, textTransform: 'capitalize' }, recipientList: { backgroundColor: '#F8F7F9', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 }, recipientRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E8E3EB' }, recipientEmail: { color: '#302A34', fontFamily: 'Inter-Medium', fontSize: 12 }, providerId: { color: '#746D79', fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter-Regular', fontSize: 10, marginTop: 3 }, recipientStatus: { color: '#5A2D82', fontFamily: 'Inter-Bold', fontSize: 10, textTransform: 'uppercase' }, historySkeleton: { height: 66, borderRadius: 8, backgroundColor: '#F3EFF7', marginVertical: 6 }, historyError: { marginTop: 0 }, scheduleBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }, scheduleBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: 10, textTransform: 'uppercase' }, scheduleErrorText: { color: '#B42318', fontFamily: 'Inter-Medium', fontSize: 11, marginTop: 4 }, scheduleActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, rescheduleEditor: { paddingBottom: 14, paddingTop: 4, gap: 8 }, rescheduleActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }, saveButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#5A2D82', alignItems: 'center', justifyContent: 'center' }, saveButtonText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 12 }, retryButton: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' }, emptyState: { alignItems: 'center', paddingVertical: 28 }, emptyTitle: { color: '#302A34', fontFamily: 'Inter-SemiBold', fontSize: 14, marginTop: 10 }, emptyHistory: { color: '#746D79', fontFamily: 'Inter-Regular', fontSize: 13, paddingVertical: 8, textAlign: 'center' }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E8E3EB' }, pageButton: { minHeight: 42, minWidth: 104, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F3EFF7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, pageText: { color: '#5A2D82', fontFamily: 'Inter-SemiBold', fontSize: 12 }, pageCount: { color: '#665F6C', fontFamily: 'Inter-Medium', fontSize: 12 },
});
