import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking as RNLinking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Gift,
  Mail,
  Send,
  Ticket,
  Wallet,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { convertFromNGN, convertToNGN, formatCurrency } from '@/lib/currency';
import { useAndroidBrowserDeepLink } from '@/hooks/useAndroidBrowserDeepLink';
import { buildPublicUrl } from '@/lib/links';
import {
  fetchGiftCardTemplates,
  fetchMyGiftCards,
  GiftCardPreview,
  GiftCardRow,
  GiftCardTemplate,
  issueGiftCard,
  previewGiftCard,
  redeemGiftCard,
} from '@/lib/gift-cards';

function getFunctionErrorMessage(error: unknown, data?: unknown) {
  if (data && typeof data === 'object') {
    const detail = 'detail' in data ? data.detail : undefined;
    const message = 'error' in data ? data.error : undefined;

    if (typeof detail === 'string' && detail.trim()) return detail;
    if (typeof message === 'string' && message.trim()) return message;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error ? error.message : undefined;
    const maybeContext = 'context' in error ? error.context : undefined;

    if (typeof maybeContext === 'string' && maybeContext.trim()) return maybeContext;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
  }

  if (error instanceof Error && error.message.trim()) return error.message;

  return 'The gift card email could not be sent right now. Please try again in a moment.';
}

type DeliveryMethod = 'link' | 'email';
type ActiveTab = 'send' | 'mine';
type GiftCardRecord = GiftCardRow & {
  gift_card_templates?: GiftCardTemplate | GiftCardTemplate[] | null;
};

const QUICK_AMOUNTS_NGN = [2500, 5000, 10000, 25000];

function getTemplate(card: GiftCardRecord) {
  if (Array.isArray(card.gift_card_templates)) return card.gift_card_templates[0] ?? null;
  return card.gift_card_templates ?? null;
}

function roundGiftAmount(amount: number, currency: string) {
  if (currency === 'NGN' || currency === 'KES') return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

function buildGiftAmountOptions(currency: string) {
  if (currency === 'NGN') return QUICK_AMOUNTS_NGN;
  return QUICK_AMOUNTS_NGN.map((amount) => roundGiftAmount(convertFromNGN(amount, currency), currency));
}

function getTemplateImageSource(template?: GiftCardTemplate | GiftCardPreview | null) {
  const imagePath = template?.image_path;
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return { uri: imagePath };
  }
  if (Platform.OS === 'web' && imagePath.startsWith('/')) {
    return { uri: imagePath };
  }
  return null;
}

function getDeepLink(shareToken: string) {
  return buildPublicUrl('/gift-cards', { gift: shareToken });
}

function formatGiftTimestamp(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function GiftCardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gift?: string | string[] }>();
  const { profile, user, refreshProfile } = useAuth();

  const userCurrency = profile?.preferred_currency || 'NGN';
  const walletBalanceInUserCurrency = userCurrency === 'NGN'
    ? profile?.wallet_balance || 0
    : convertFromNGN(profile?.wallet_balance || 0, userCurrency);

  const [activeTab, setActiveTab] = useState<ActiveTab>('send');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<GiftCardTemplate[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCardRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number>(buildGiftAmountOptions(userCurrency)[2] || buildGiftAmountOptions(userCurrency)[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [senderName, setSenderName] = useState(profile?.full_name || '');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('link');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemPreview, setRedeemPreview] = useState<GiftCardPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [handledToken, setHandledToken] = useState('');
  const [showAllSent, setShowAllSent] = useState(false);
  const [showAllReceived, setShowAllReceived] = useState(false);

  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) || templates[0] || null;
  const amountOptions = buildGiftAmountOptions(userCurrency);
  const rawRouteGiftToken = Array.isArray(params.gift) ? params.gift[0] : params.gift;
  const normalizedRouteGiftToken = rawRouteGiftToken ? String(rawRouteGiftToken).trim().toUpperCase() : '';

  useAndroidBrowserDeepLink(
    normalizedRouteGiftToken ? '/gift-cards' : null,
    normalizedRouteGiftToken ? { gift: normalizedRouteGiftToken } : undefined
  );

  const currentAmount = useCustomAmount
    ? Math.max(0, parseFloat(customAmount) || 0)
    : selectedAmount;

  const currentAmountInNGN = currentAmount > 0
    ? convertToNGN(currentAmount, userCurrency)
    : 0;

  const loadData = useCallback(async () => {
    try {
      const templatesRes = await fetchGiftCardTemplates();
      const cardsRes = user?.id ? await fetchMyGiftCards() : { data: [], error: null };

      if (templatesRes.error) throw templatesRes.error;
      if (cardsRes.error) throw cardsRes.error;

      const nextTemplates = (templatesRes.data || []) as GiftCardTemplate[];
      setTemplates(nextTemplates);
      setGiftCards((cardsRes.data || []) as GiftCardRecord[]);

      if (!selectedTemplateId && nextTemplates[0]?.id) {
        setSelectedTemplateId(nextTemplates[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load gift card data:', error);
      Alert.alert('Error', error?.message || 'Unable to load gift cards right now.');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateId, user?.id]);

  useEffect(() => {
    setSenderName(profile?.full_name || '');
  }, [profile?.full_name]);

  useEffect(() => {
    const nextAmount = amountOptions[2] || amountOptions[0] || 0;
    if (!useCustomAmount) {
      setSelectedAmount(nextAmount);
    }
  }, [userCurrency, useCustomAmount]);

  useEffect(() => {
    if (!normalizedRouteGiftToken) return;
    const normalizedToken = normalizedRouteGiftToken;
    if (!normalizedToken || normalizedToken === handledToken) return;

    setHandledToken(normalizedToken);
    setShowRedeemModal(true);
    setRedeemInput(normalizedToken);

    void handlePreviewGiftCard(normalizedToken);
  }, [handledToken, normalizedRouteGiftToken]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const resetComposer = () => {
    setRecipientName('');
    setSenderName(profile?.full_name || '');
    setRecipientEmail('');
    setMessage('');
    setDeliveryMethod('link');
    setUseCustomAmount(false);
    setCustomAmount('');
    setSelectedAmount(amountOptions[2] || amountOptions[0] || 0);
  };

  const handleCopy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const handleShareGiftCard = async (shareToken: string, code: string, amount: number, currency: string) => {
    const link = getDeepLink(shareToken);
    await Share.share({
      message:
        `I sent you a Dritchwear gift card worth ${formatCurrency(amount, currency)}.\n\n` +
        `Redeem link: ${link}\n` +
        `Gift code: ${code}`,
    });
  };

  const sendGiftCardEmail = async (shareToken: string, code: string) => {
    if (!recipientEmail.trim()) return;

    // Always use a web HTTPS link in emails - deep links (dritchwear://) only work
    // if the native app is installed and can get flagged by spam filters.
    const link = buildPublicUrl('/gift-cards', { gift: shareToken });
    const amount = formatCurrency(currentAmount, userCurrency);

    try {
      const { data, error } = await supabase.functions.invoke('send-gift-card-email', {
        body: {
          to: recipientEmail.trim(),
          recipientName: recipientName.trim() || 'there',
          senderName: (senderName.trim() || profile?.full_name || 'Someone'),
          amount,
          code,
          link,
          message: message.trim() || null,
        },
      });

      if (error) {
        console.warn('Edge function email failed:', { error, data });
        Alert.alert(
          'Unable to send gift card email',
          getFunctionErrorMessage(error, data)
        );
        return;
      }

      console.log('Gift card email sent:', data);
    } catch (err) {
      console.warn('sendGiftCardEmail error:', err);
      Alert.alert(
        'Unable to send gift card email',
        getFunctionErrorMessage(err)
      );
    }
  };

  const handleCreateGiftCard = async () => {
    if (!user?.id) {
      Alert.alert(
        'Sign in to send a gift card',
        'Your gift card details are ready. Sign in or create an account to fund and send it securely.',
        [
          { text: 'Keep browsing', style: 'cancel' },
          { text: 'Sign in', onPress: () => router.push('/(auth)/welcome') },
        ]
      );
      return;
    }
    if (!profile) {
      Alert.alert('Account still loading', 'Please wait a moment, then try creating the gift card again.');
      return;
    }

    if (!selectedTemplate) {
      Alert.alert('Select Design', 'Choose a gift card design first.');
      return;
    }

    if (currentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid gift card amount.');
      return;
    }

    if (!recipientName.trim()) {
      Alert.alert('Recipient Needed', 'Enter who the gift card is for.');
      return;
    }

    if (!senderName.trim()) {
      Alert.alert('Sender Needed', 'Enter who the gift card is from.');
      return;
    }

    if (deliveryMethod === 'email' && !recipientEmail.trim().includes('@')) {
      Alert.alert('Email Required', 'Enter a valid recipient email address.');
      return;
    }

    if ((profile.wallet_balance || 0) < currentAmountInNGN) {
      Alert.alert(
        'Insufficient Wallet Balance',
        `You need ${formatCurrency(currentAmount, userCurrency)} to create this gift card.\n\nYour wallet balance is ${formatCurrency(walletBalanceInUserCurrency, userCurrency)}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Fund Wallet', onPress: () => router.push('/(customer)/fund-wallet') },
        ]
      );
      return;
    }

    setSubmitting(true);

    const { data, error } = await issueGiftCard({
      templateSlug: selectedTemplate.slug,
      originalAmount: currentAmount,
      currency: userCurrency,
      recipientName: recipientName.trim(),
      senderName: senderName.trim(),
      recipientEmail: deliveryMethod === 'email' ? recipientEmail.trim() : null,
      deliveryMethod,
      message: message.trim() || null,
    });

    setSubmitting(false);

    if (error || !data) {
      Alert.alert('Unable to Create Gift Card', error?.message || 'Please try again.');
      return;
    }

    await refreshProfile();
    await loadData();

    if (deliveryMethod === 'email') {
      await sendGiftCardEmail(data.share_token, data.code);
    }

    Alert.alert(
      'Gift Card Ready',
      `Code: ${data.code}\nAmount: ${formatCurrency(currentAmount, userCurrency)}`,
      [
        {
          text: 'Copy Code',
          onPress: () => void handleCopy(data.code, 'Gift code'),
        },
        {
          text: 'Copy Link',
          onPress: () => void handleCopy(getDeepLink(data.share_token), 'Gift link'),
        },
        {
          text: 'Share',
          onPress: () => void handleShareGiftCard(data.share_token, data.code, currentAmount, userCurrency),
        },
        { text: 'Done', style: 'default' },
      ]
    );

    resetComposer();
    setActiveTab('mine');
  };

  async function handlePreviewGiftCard(identifierOverride?: string) {
    const identifier = (identifierOverride || redeemInput).trim();
    if (!identifier) {
      Alert.alert('Enter a Code', 'Paste a gift code or redeem link token first.');
      return;
    }

    setPreviewLoading(true);
    const { data, error } = await previewGiftCard(identifier);
    setPreviewLoading(false);

    if (error || !data) {
      setRedeemPreview(null);
      Alert.alert('Not Found', error?.message || 'Gift card not found.');
      return;
    }

    setRedeemPreview(data);
  }

  const handleRedeemGiftCard = async () => {
    if (!user?.id) {
      Alert.alert('Sign in to redeem', 'Sign in or create an account so the gift-card value can be added securely to your wallet.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/(auth)/welcome') },
      ]);
      return;
    }
    const identifier = redeemPreview?.share_token || redeemPreview?.code || redeemInput.trim();
    if (!identifier) {
      Alert.alert('Enter a Code', 'Paste a gift code or redeem link token first.');
      return;
    }

    setSubmitting(true);
    const { data, error } = await redeemGiftCard(identifier);
    setSubmitting(false);

    if (error || !data) {
      Alert.alert('Unable to Redeem', error?.message || 'This gift card could not be redeemed.');
      return;
    }

    await refreshProfile();
    await loadData();

    setShowRedeemModal(false);
    setRedeemPreview(null);
    setRedeemInput('');

    Alert.alert(
      'Redeemed Successfully',
      `${formatCurrency(data.original_amount, data.currency)} has been added to your wallet.`,
      [
        {
          text: 'View Wallet',
          onPress: () => router.push('/(customer)/wallet-history'),
        },
        { text: 'Done', style: 'default' },
      ]
    );
  };

  const renderGiftPreviewCard = (
    template: GiftCardTemplate | GiftCardPreview | null,
    amount: number,
    currency: string,
    headline: string,
    subtitle: string
  ) => {
    const imageSource = getTemplateImageSource(template);

    return (
      <LinearGradient
        colors={[template?.start_color || '#14532D', template?.end_color || '#052E16']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.previewCard}
      >
        {imageSource ? (
          <ImageBackground source={imageSource} imageStyle={styles.previewImage} style={styles.previewImageWrap}>
            <View style={styles.previewOverlay} />
          </ImageBackground>
        ) : null}

        <View style={styles.previewContent}>
          <View style={styles.previewTopRow}>
            <Text style={styles.previewBrand}>Dritchwear</Text>
            <View style={[styles.previewBadge, { backgroundColor: template?.accent_color || '#FDE68A' }]}>
              <Gift size={12} color="#111827" />
              <Text style={styles.previewBadgeText}>{template?.category || 'Gift'}</Text>
            </View>
          </View>

          <View style={styles.previewAmountWrap}>
            <Text style={styles.previewAmount}>{formatCurrency(amount, currency)}</Text>
            <Text style={styles.previewHeadline}>{headline}</Text>
            <Text style={styles.previewSubtitle}>{subtitle}</Text>
          </View>
        </View>
      </LinearGradient>
    );
  };

  const renderOwnedCard = (card: GiftCardRecord, mode: 'sent' | 'received') => {
    const template = getTemplate(card);
    const amount = card.currency === 'NGN'
      ? card.original_amount
      : roundGiftAmount(card.original_amount, card.currency);

    return (
      <View key={card.id} style={styles.ownedCardWrap}>
        {renderGiftPreviewCard(
          template,
          amount,
          card.currency,
          mode === 'sent' ? `For ${card.recipient_name}` : `From ${card.sender_name}`,
          card.message || template?.name || 'Gift card'
        )}

        <View style={styles.ownedCardMeta}>
          <View style={styles.ownedRow}>
            <Text style={styles.ownedLabel}>Code</Text>
            <Pressable onPress={() => void handleCopy(card.code, 'Gift code')}>
              <Text style={styles.ownedValueLink}>{card.code}</Text>
            </Pressable>
          </View>

          <View style={styles.ownedRow}>
            <Text style={styles.ownedLabel}>Status</Text>
            <Text style={[styles.statusPill, card.status === 'redeemed' ? styles.statusRedeemed : styles.statusActive]}>
              {card.status}
            </Text>
          </View>

          <View style={styles.ownedRow}>
            <Text style={styles.ownedLabel}>{mode === 'sent' ? 'Created' : 'Sent to'}</Text>
            {mode === 'sent' ? (
              <Text style={styles.ownedValue}>{formatGiftTimestamp(card.created_at)}</Text>
            ) : card.recipient_email ? (
              <Pressable onPress={() => void RNLinking.openURL(`mailto:${card.recipient_email}`)}>
                <Text style={styles.ownedValueLink}>{card.recipient_email}</Text>
              </Pressable>
            ) : (
              <Text style={styles.ownedValue}>Your account</Text>
            )}
          </View>

          <View style={styles.ownedActions}>
            {mode === 'sent' && card.status === 'active' ? (
              <>
                <Pressable
                  style={styles.secondaryAction}
                  onPress={() => void handleCopy(getDeepLink(card.share_token), 'Gift link')}
                >
                  <Copy size={15} color="#14532D" />
                  <Text style={styles.secondaryActionText}>Copy Link</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryAction}
                  onPress={() => void handleShareGiftCard(card.share_token, card.code, amount, card.currency)}
                >
                  <Send size={15} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Share</Text>
                </Pressable>
              </>
            ) : null}

            {mode === 'received' && card.status === 'active' ? (
              <Pressable
                style={styles.primaryAction}
                onPress={() => {
                  setShowRedeemModal(true);
                  setRedeemInput(card.share_token);
                  void handlePreviewGiftCard(card.share_token);
                }}
              >
                <Ticket size={15} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Redeem</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const sentCards = giftCards.filter((card) => card.purchaser_user_id === user?.id);
  const receivedCards = giftCards.filter((card) => card.purchaser_user_id !== user?.id);
  const visibleSentCards = showAllSent ? sentCards : sentCards.slice(0, 2);
  const visibleReceivedCards = showAllReceived ? receivedCards : receivedCards.slice(0, 2);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Gift Cards</Text>
        <Pressable style={styles.iconButton} onPress={() => setShowRedeemModal(true)}>
          <Ticket size={20} color="#5A2D82" />
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'send' && styles.tabButtonActive]}
          onPress={() => setActiveTab('send')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'send' && styles.tabButtonTextActive]}>Send</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'mine' && styles.tabButtonActive]}
          onPress={() => setActiveTab('mine')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'mine' && styles.tabButtonTextActive]}>My Gifts</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {activeTab === 'send' ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>Send a beautiful Dritchwear gift</Text>
                <Text style={styles.heroSubtitle}>
                  Choose a design, set the value in {userCurrency}, then share a redeem link or send it by email.
                </Text>
              </View>
              <View style={styles.walletPill}>
                <Wallet size={14} color="#5A2D82" />
                <Text style={styles.walletPillText}>{formatCurrency(walletBalanceInUserCurrency, userCurrency)}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Choose a design</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesRow}>
              {templates.map((template) => (
                <Pressable
                  key={template.id}
                  style={[
                    styles.templateTile,
                    selectedTemplateId === template.id && styles.templateTileActive,
                  ]}
                  onPress={() => setSelectedTemplateId(template.id)}
                >
                  {renderGiftPreviewCard(template, currentAmount || amountOptions[0] || 0, userCurrency, template.name, template.category)}
                  <View style={styles.templateLabelRow}>
                    <View>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateCategory}>{template.category}</Text>
                    </View>
                    {selectedTemplateId === template.id ? <CheckCircle2 size={18} color="#5A2D82" /> : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Customize your card</Text>
            <View style={styles.formCard}>
              {renderGiftPreviewCard(
                selectedTemplate,
                currentAmount || amountOptions[0] || 0,
                userCurrency,
                recipientName.trim() ? `For ${recipientName.trim()}` : selectedTemplate?.name || 'Your gift card',
                message.trim() || 'A stylish surprise from Dritchwear'
              )}

              <Text style={styles.inputLabel}>Gift amount</Text>
              <View style={styles.amountGrid}>
                {amountOptions.map((amount) => (
                  <Pressable
                    key={amount}
                    style={[
                      styles.amountChip,
                      !useCustomAmount && selectedAmount === amount && styles.amountChipActive,
                    ]}
                    onPress={() => {
                      setUseCustomAmount(false);
                      setSelectedAmount(amount);
                    }}
                  >
                    <Text
                      style={[
                        styles.amountChipText,
                        !useCustomAmount && selectedAmount === amount && styles.amountChipTextActive,
                      ]}
                    >
                      {formatCurrency(amount, userCurrency)}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.amountChip, useCustomAmount && styles.amountChipActive]}
                  onPress={() => setUseCustomAmount(true)}
                >
                  <Text style={[styles.amountChipText, useCustomAmount && styles.amountChipTextActive]}>Custom</Text>
                </Pressable>
              </View>

              {useCustomAmount ? (
                <TextInput
                  style={styles.input}
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  placeholder={`Enter amount in ${userCurrency}`}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              ) : null}

              <Text style={styles.walletNote}>
                Wallet charge: {formatCurrency(currentAmount || 0, userCurrency)} {userCurrency !== 'NGN' ? `(${formatCurrency(currentAmountInNGN, 'NGN')} equivalent)` : ''}
              </Text>

              <Text style={styles.inputLabel}>Who is this gift for?</Text>
              <TextInput
                style={styles.input}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Recipient name"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.inputLabel}>Who is it from?</Text>
              <TextInput
                style={styles.input}
                value={senderName}
                onChangeText={setSenderName}
                placeholder="Sender name"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.inputLabel}>How would you like to send it?</Text>
              <View style={styles.deliveryRow}>
                <Pressable
                  style={[styles.deliveryButton, deliveryMethod === 'link' && styles.deliveryButtonActive]}
                  onPress={() => setDeliveryMethod('link')}
                >
                  <Send size={15} color={deliveryMethod === 'link' ? '#FFFFFF' : '#5A2D82'} />
                  <Text style={[styles.deliveryText, deliveryMethod === 'link' && styles.deliveryTextActive]}>Share link</Text>
                </Pressable>
                <Pressable
                  style={[styles.deliveryButton, deliveryMethod === 'email' && styles.deliveryButtonActive]}
                  onPress={() => setDeliveryMethod('email')}
                >
                  <Mail size={15} color={deliveryMethod === 'email' ? '#FFFFFF' : '#5A2D82'} />
                  <Text style={[styles.deliveryText, deliveryMethod === 'email' && styles.deliveryTextActive]}>Send via email</Text>
                </Pressable>
              </View>

              {deliveryMethod === 'email' ? (
                <>
                  <Text style={styles.inputLabel}>Recipient email</Text>
                  <TextInput
                    style={styles.input}
                    value={recipientEmail}
                    onChangeText={setRecipientEmail}
                    placeholder="name@example.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Text style={styles.helpText}>
                    We will email the redeem link and gift code directly to the recipient.
                  </Text>
                </>
              ) : null}

              <Text style={styles.inputLabel}>Message (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a short note"
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
              />

              <Pressable
                style={[styles.checkoutButton, submitting && styles.buttonDisabled]}
                onPress={() => void handleCreateGiftCard()}
                disabled={submitting}
              >
                <Text style={styles.checkoutButtonText}>
                  {submitting ? 'Creating...' : `Create Gift Card for ${formatCurrency(currentAmount || 0, userCurrency)}`}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.mineHeader}>
              <Text style={styles.sectionTitle}>Your sent gift cards</Text>
              <Pressable style={styles.redeemTrigger} onPress={() => setShowRedeemModal(true)}>
                <Ticket size={14} color="#5A2D82" />
                <Text style={styles.redeemTriggerText}>Redeem a code</Text>
              </Pressable>
            </View>

            {loading ? <Text style={styles.emptyText}>Loading gift cards...</Text> : null}
            {!loading && sentCards.length === 0 ? (
              <Text style={styles.emptyText}>Gift cards you create will appear here.</Text>
            ) : null}
            {visibleSentCards.map((card) => renderOwnedCard(card, 'sent'))}
            {sentCards.length > 2 ? (
              <Pressable style={styles.paginationButton} onPress={() => setShowAllSent((prev) => !prev)}>
                <Text style={styles.paginationButtonText}>
                  {showAllSent ? 'Show less' : `Show ${sentCards.length - 2} more`}
                </Text>
              </Pressable>
            ) : null}

            <Text style={styles.sectionTitle}>Received for you</Text>
            {!loading && receivedCards.length === 0 ? (
              <Text style={styles.emptyText}>Redeemed or emailed gift cards for your account will show here.</Text>
            ) : null}
            {visibleReceivedCards.map((card) => renderOwnedCard(card, 'received'))}
            {receivedCards.length > 2 ? (
              <Pressable style={styles.paginationButton} onPress={() => setShowAllReceived((prev) => !prev)}>
                <Text style={styles.paginationButtonText}>
                  {showAllReceived ? 'Show less' : `Show ${receivedCards.length - 2} more`}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showRedeemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRedeemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalTitle}>Redeem a gift card</Text>
              <TextInput
                style={styles.input}
                value={redeemInput}
                onChangeText={setRedeemInput}
                placeholder="Enter gift code or token"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />

              <Pressable
                style={[styles.secondaryWideButton, previewLoading && styles.buttonDisabled]}
                onPress={() => void handlePreviewGiftCard()}
                disabled={previewLoading}
              >
                <Text style={styles.secondaryWideButtonText}>{previewLoading ? 'Checking...' : 'Preview gift card'}</Text>
              </Pressable>

              {redeemPreview ? (
                <View style={styles.redeemPreviewWrap}>
                  {renderGiftPreviewCard(
                    redeemPreview,
                    redeemPreview.original_amount,
                    redeemPreview.currency,
                    `For ${redeemPreview.recipient_name}`,
                    redeemPreview.message || redeemPreview.template_name
                  )}
                  <Text style={styles.redeemMeta}>
                    From {redeemPreview.sender_name} • {formatGiftTimestamp(redeemPreview.created_at)}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowRedeemModal(false);
                  setRedeemPreview(null);
                  setRedeemInput('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.checkoutButton, { flex: 1, marginTop: 0 }, (!redeemPreview || submitting) && styles.buttonDisabled]}
                onPress={() => void handleRedeemGiftCard()}
                disabled={!redeemPreview || submitting}
              >
                <Text style={styles.checkoutButtonText}>{submitting ? 'Redeeming...' : 'Redeem gift card'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F4EF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: '#E7E2D6',
    borderRadius: 16,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#5A2D82',
  },
  tabButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#4B5563',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    gap: 16,
  },
  heroTextWrap: {
    gap: 8,
  },
  heroTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
  },
  walletPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  walletPillText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  templatesRow: {
    paddingBottom: 8,
    gap: 14,
  },
  templateTile: {
    width: 280,
  },
  templateTileActive: {
    opacity: 1,
  },
  templateLabelRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateName: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  templateCategory: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
  },
  previewCard: {
    minHeight: 155,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
  },
  previewImageWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  previewImage: {
    resizeMode: 'cover',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.24)',
  },
  previewContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewBrand: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  previewAmountWrap: {
    gap: 6,
  },
  previewAmount: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  previewHeadline: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  previewSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.9)',
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
    marginTop: 6,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  amountChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  amountChipActive: {
    backgroundColor: '#5A2D82',
  },
  amountChipText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  amountChipTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 110,
  },
  deliveryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  deliveryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5A2D82',
    paddingVertical: 13,
  },
  deliveryButtonActive: {
    backgroundColor: '#5A2D82',
  },
  deliveryText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  deliveryTextActive: {
    color: '#FFFFFF',
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: -4,
    marginBottom: 10,
  },
  walletNote: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 6,
  },
  checkoutButton: {
    backgroundColor: '#5A2D82',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  checkoutButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  mineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  redeemTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  redeemTriggerText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
  },
  paginationButton: {
    alignSelf: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: -4,
    marginBottom: 18,
  },
  paginationButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  ownedCardWrap: {
    marginBottom: 20,
    marginTop: 6,
  },
  ownedCardMeta: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 16,
    marginTop: -10,
  },
  ownedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ownedLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  ownedValue: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  ownedValueLink: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#5A2D82',
  },
  statusPill: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
  },
  statusActive: {
    color: '#5A2D82',
    backgroundColor: '#F3E8FF',
  },
  statusRedeemed: {
    color: '#1D4ED8',
    backgroundColor: '#DBEAFE',
  },
  ownedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  secondaryActionText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5A2D82',
    borderRadius: 14,
    paddingVertical: 12,
  },
  primaryActionText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.38)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 28,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 14,
  },
  secondaryWideButton: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 14,
  },
  secondaryWideButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  redeemPreviewWrap: {
    marginBottom: 14,
  },
  redeemMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: -4,
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
});
