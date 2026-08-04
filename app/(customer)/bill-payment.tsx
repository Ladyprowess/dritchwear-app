/**
 * Bill Payment - Utilities
 * Powered by eBills API (https://ebills.africa)
 *
 * Services: Airtime · Data · Electricity · Cable TV
 * Payment:  Points only · Wallet only · Mix (points + wallet)
 * Rate:     1 point = ₦0.10
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { usePoints } from '@/contexts/PointsContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Smartphone, Zap, Wallet, Star, ChevronDown, ChevronUp, Tv, Wifi,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePostHog } from 'posthog-react-native';

const BRAND       = { purple: '#5A2D82', gold: '#FDB813' };
const POINTS_RATE = 0.10; // 1 point = ₦0.10

// ── Types ──────────────────────────────────────────────────────────────────────
type ServiceType = 'airtime' | 'data' | 'electricity' | 'cable' | null;
type PayMode     = 'points' | 'wallet' | 'mix';

type Network   = { id: string; label: string; color: string };
type Disco     = { id: string; label: string };
type CableProv = { id: string; label: string; color: string };
type Plan      = { id: string | number; label: string; amount: number };

// Network color hints (best-effort - may not match all Peyflex IDs)
const NETWORK_COLORS: Record<string, string> = {
  mtn: '#FDB813', mtn_gifting_data: '#FDB813', mtn_data_share: '#FDB813', mtn_sme_data: '#FDB813',
  airtel: '#EF4444', airtel_data: '#EF4444',
  glo: '#10B981', glo_data: '#10B981',
  '9mobile': '#059669', '9mobile_data': '#059669', '9mobile_gifting': '#059669',
};

const CABLE_COLORS: Record<string, string> = {
  dstv: '#0A2FA0', gotv: '#E8480C', startimes: '#D4A017', showmax: '#E50914',
};

// Fallback lists (used if Peyflex fetch fails)
const FALLBACK_DISCOS: Disco[] = [
  { id: 'ikeja-electric',        label: 'Ikeja Electric (IKEDC)'       },
  { id: 'eko-electric',          label: 'Eko Electric (EKEDC)'         },
  { id: 'abuja-electric',        label: 'Abuja Electric (AEDC)'        },
  { id: 'portharcourt-electric', label: 'Port Harcourt Electric (PHED)'},
  { id: 'ibadan-electric',       label: 'Ibadan Electric (IBEDC)'      },
  { id: 'enugu-electric',        label: 'Enugu Electric (EEDC)'        },
  { id: 'benin-electric',        label: 'Benin Electric (BEDC)'        },
  { id: 'jos-electric',          label: 'Jos Electric (JED)'           },
  { id: 'kano-electric',         label: 'Kano Electric (KEDCO)'        },
  { id: 'kaduna-electric',       label: 'Kaduna Electric (KAEDCO)'     },
  { id: 'aba-electric',          label: 'Aba Electric (ABEDC)'         },
  { id: 'yola-electric',         label: 'Yola Electric (YEDC)'         },
];

const FALLBACK_CABLE: CableProv[] = [
  { id: 'dstv',      label: 'DStv',     color: '#0A2FA0' },
  { id: 'gotv',      label: 'GOtv',     color: '#E8480C' },
  { id: 'startimes', label: 'StarTimes',color: '#D4A017' },
  { id: 'showmax',   label: 'Showmax',  color: '#E50914' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeRef() {
  const d = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `DW${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}


// ── Network name cleaner ────────────────────────────────────────────────────────
// Maps Peyflex's raw API names to user-friendly display names
const NETWORK_NAME_MAP: Record<string, string> = {
  mtn_gifting_data:  'MTN Data',
  mtn_data_share:    'MTN Data Share',
  mtn_sme_data:      'MTN SME Data',
  glo_data:          'Glo Data',
  airtel_data:       'Airtel Data',
  '9mobile_data':    '9mobile Data',
  '9mobile_gifting': '9mobile Data (Gifting)',
};

function friendlyNetworkName(identifier: string, rawName: string): string {
  return NETWORK_NAME_MAP[identifier] ?? rawName;
}

// ── Plan label cleaner ─────────────────────────────────────────────────────────
// Peyflex labels are like "2.5GB = N650 (2DAYS)12hrs YouTube Buffer"
// We extract SIZE + DURATION and any special feature tags (YouTube, SME, etc.)
const PLAN_SPECIAL_TAGS: { pattern: RegExp; label: string }[] = [
  { pattern: /youtube/i,     label: 'YouTube' },
  { pattern: /tiktok/i,      label: 'TikTok' },
  { pattern: /instagram/i,   label: 'Instagram' },
  { pattern: /facebook/i,    label: 'Facebook' },
  { pattern: /whatsapp/i,    label: 'WhatsApp' },
  { pattern: /\bsocial\b/i,  label: 'Social' },
  { pattern: /\bsme\b/i,     label: 'SME' },
  { pattern: /\bgifting\b/i, label: 'Gifting' },
  { pattern: /\bnight\b/i,   label: 'Night' },
  { pattern: /\bweekend\b/i, label: 'Weekend' },
  { pattern: /\bstream/i,    label: 'Streaming' },
  { pattern: /\bbuffer\b/i,  label: 'Buffer' },
];

function cleanPlanLabel(raw: string): string {
  // Extract SIZE: e.g. "110MB", "2.5GB", "16.5GB"
  const sizeMatch = raw.match(/^([\d.]+\s*[MmGgKk][Bb])/);
  const size = sizeMatch ? sizeMatch[1].replace(/\s+/, '') : null;

  // Extract DURATION from inside parentheses
  const durMatch = raw.match(/\(([^)]+)\)/);
  const durRaw = durMatch ? durMatch[1].trim().toUpperCase() : null;

  if (!size || !durRaw) return raw; // fallback: return original if can't parse

  // Normalise duration text
  const dur = durRaw
    .replace(/^1HOUR$/i,   '1 Hour')
    .replace(/^(\d+)HOURS?$/i, (_, n) => `${n} Hours`)
    .replace(/^1DAY$/i,    '1 Day')
    .replace(/^(\d+)DAYS?$/i, (_, n) => `${n} Days`)
    .replace(/^7DAYS?$/i,  '7 Days')
    .replace(/^WEEKLY$/i,  'Weekly')
    .replace(/^(\d+)\s*MONTH$/i, (_, n) => `${n} Month${Number(n) > 1 ? 's' : ''}`)
    .replace(/^(\d+)\s*MONTHS?$/i, (_, n) => `${n} Month${Number(n) > 1 ? 's' : ''}`)
    .replace(/^1\s*YEAR$/i, '1 Year')
    .replace(/^(\d+)\s*YEARS?$/i, (_, n) => `${n} Years`);

  // Extract special feature tags from the rest of the label
  const tags: string[] = [];
  for (const { pattern, label } of PLAN_SPECIAL_TAGS) {
    if (pattern.test(raw)) tags.push(label);
  }
  const tagSuffix = tags.length > 0 ? ` • ${tags.join(' + ')}` : '';

  return `${size} • ${dur}${tagSuffix}`;
}

async function callEdge(payload: Record<string, any>, jwt: string) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1/bill-pay';
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Server error ${res.status}`);
  return json;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function BillPaymentScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { pointsBalance } = usePoints();
  const posthog = usePostHog();
  const walletNGN = profile?.wallet_balance ?? 0;

  // ── Service state ────────────────────────────────────────────────────────────
  const [serviceType, setServiceType] = useState<ServiceType>(null);

  // Airtime - uses same dynamic networks as data
  const [network, setNetwork]           = useState<Network | null>(null);
  const [airtimePhone, setAirtimePhone] = useState('');
  const [airtimeAmount, setAirtimeAmount] = useState('');
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  // For airtime we use a simple static mapping for now (no plan needed)
  const AIRTIME_NETWORKS: Network[] = [
    { id: 'mtn',     label: 'MTN',     color: '#FDB813' },
    { id: 'airtel',  label: 'Airtel',  color: '#EF4444' },
    { id: 'glo',     label: 'Glo',     color: '#10B981' },
    { id: '9mobile', label: '9mobile', color: '#059669' },
  ];

  // Data - networks fetched from Peyflex
  const [dataNetworks, setDataNetworks] = useState<Network[]>([]);
  const [loadingDataNetworks, setLoadingDataNetworks] = useState(false);
  const [dataNetwork, setDataNetwork]   = useState<Network | null>(null);
  const [dataPhone, setDataPhone]       = useState('');
  const [dataPlans, setDataPlans]       = useState<Plan[]>([]);
  const [selectedDataPlan, setSelectedDataPlan] = useState<Plan | null>(null);
  const [loadingDataPlans, setLoadingDataPlans] = useState(false);
  const [showDataNetPicker, setShowDataNetPicker] = useState(false);
  const [showDataPlanPicker, setShowDataPlanPicker] = useState(false);

  // Electricity - DISCOs fetched from Peyflex
  const [discos, setDiscos]                       = useState<Disco[]>([]);
  const [loadingDiscos, setLoadingDiscos]         = useState(false);
  const [disco, setDisco]                         = useState<Disco | null>(null);
  const [meterNumber, setMeterNumber]             = useState('');
  const [meterType, setMeterType]                 = useState<'prepaid' | 'postpaid'>('prepaid');
  const [elecPhone, setElecPhone]                 = useState('');
  const [elecAmount, setElecAmount]               = useState('');
  const [verifyingMeter, setVerifyingMeter]       = useState(false);
  const [verifiedMeter, setVerifiedMeter]         = useState<string | null>(null);
  const [showDiscoPicker, setShowDiscoPicker]     = useState(false);

  // Cable TV - providers fetched from Peyflex
  const [cableProviders, setCableProviders]         = useState<CableProv[]>([]);
  const [loadingCableProviders, setLoadingCableProviders] = useState(false);
  const [cableProv, setCableProv]                   = useState<CableProv | null>(null);
  const [smartcard, setSmartcard]                   = useState('');
  const [cablePhone, setCablePhone]                 = useState('');
  const [cablePlans, setCablePlans]                 = useState<Plan[]>([]);
  const [selectedCablePlan, setSelectedCablePlan]   = useState<Plan | null>(null);
  const [loadingCablePlans, setLoadingCablePlans]   = useState(false);
  const [verifyingCard, setVerifyingCard]           = useState(false);
  const [verifiedCard, setVerifiedCard]             = useState<string | null>(null);
  const [showCableProvPicker, setShowCableProvPicker] = useState(false);
  const [showCablePlanPicker, setShowCablePlanPicker] = useState(false);

  // Payment
  const [payMode, setPayMode]         = useState<PayMode>('points');
  const [mixPointsInput, setMixPointsInput] = useState('');
  const [paying, setPaying]           = useState(false);
  const [webNotice, setWebNotice]     = useState<{ title: string; message: string } | null>(null);
  const [showConfirmPay, setShowConfirmPay] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  // Generated once per payment attempt (in handlePay) and reused across
  // retries within that attempt, so bill-pay's idempotency check can
  // recognize a retry after a dropped/failed request instead of double-charging.
  const pendingRefRef = useRef<string | null>(null);

  // ── Derived amounts ──────────────────────────────────────────────────────────
  const totalNGN: number = (() => {
    if (serviceType === 'airtime')     return parseFloat(airtimeAmount) || 0;
    if (serviceType === 'electricity') return parseFloat(elecAmount) || 0;
    if (serviceType === 'data')        return selectedDataPlan?.amount ?? 0;
    if (serviceType === 'cable')       return selectedCablePlan?.amount ?? 0;
    return 0;
  })();

  const pointsNeeded  = Math.ceil(totalNGN / POINTS_RATE);
  const mixPoints     = parseInt(mixPointsInput) || 0;
  const mixPointsNGN  = parseFloat((mixPoints * POINTS_RATE).toFixed(2));
  const mixWallet     = parseFloat(Math.max(0, totalNGN - mixPointsNGN).toFixed(2));
  const pointsBalanceValueNGN = parseFloat((pointsBalance * POINTS_RATE).toFixed(2));

  const finalPoints: number = payMode === 'points' ? pointsNeeded : payMode === 'mix' ? mixPoints : 0;
  const finalWallet: number = payMode === 'wallet' ? totalNGN    : payMode === 'mix' ? mixWallet : 0;

  const canAfford = finalPoints <= pointsBalance && finalWallet <= walletNGN && totalNGN > 0;

  const showBillNotice = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      setWebNotice({ title, message });
      return;
    }
    Alert.alert(title, message);
  };

  const closeBillNotice = () => {
    setWebNotice(null);
  };

  // ── Session helper ───────────────────────────────────────────────────────────
  async function getJwt() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired. Please log in again.');
    return session.access_token;
  }

  const resetAll = useCallback(() => {
    setNetwork(null); setAirtimePhone(''); setAirtimeAmount('');
    setDataNetwork(null); setDataPhone(''); setDataPlans([]); setSelectedDataPlan(null);
    setDisco(null); setMeterNumber(''); setElecPhone(''); setElecAmount(''); setVerifiedMeter(null);
    setCableProv(null); setSmartcard(''); setCablePhone(''); setCablePlans([]); setSelectedCablePlan(null); setVerifiedCard(null);
    setPayMode('points'); setMixPointsInput('');
    // Note: dataNetworks / discos / cableProviders are intentionally kept (cached per session)
  }, []);

  // ── AsyncStorage: persist last-used form values per service ─────────────────
  const STORAGE_KEY = '@dritchwear_bill_form';

  const saveFormState = useCallback(async (svc: ServiceType, state: Record<string, any>) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[svc as string] = state;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }, []);

  const loadFormState = useCallback(async (svc: ServiceType) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const all = JSON.parse(raw);
      return all[svc as string] ?? null;
    } catch { return null; }
  }, []);

  // Auto-save airtime fields
  useEffect(() => {
    if (serviceType !== 'airtime') return;
    saveFormState('airtime', { networkId: network?.id, networkLabel: network?.label, networkColor: network?.color, phone: airtimePhone });
  }, [network, airtimePhone, serviceType]);

  // Auto-save data fields
  useEffect(() => {
    if (serviceType !== 'data') return;
    saveFormState('data', { networkId: dataNetwork?.id, networkLabel: dataNetwork?.label, networkColor: dataNetwork?.color, phone: dataPhone });
  }, [dataNetwork, dataPhone, serviceType]);

  // Auto-save electricity fields
  useEffect(() => {
    if (serviceType !== 'electricity') return;
    saveFormState('electricity', { discoId: disco?.id, discoLabel: disco?.label, meter: meterNumber, phone: elecPhone, meterType });
  }, [disco, meterNumber, elecPhone, meterType, serviceType]);

  // Auto-save cable fields
  useEffect(() => {
    if (serviceType !== 'cable') return;
    saveFormState('cable', { provId: cableProv?.id, provLabel: cableProv?.label, provColor: cableProv?.color, smartcard: smartcard, phone: cablePhone });
  }, [cableProv, smartcard, cablePhone, serviceType]);

  // Restore saved values when a service section is opened
  const handleSelectService = useCallback(async (svc: ServiceType) => {
    resetAll();
    setServiceType(svc);

    const saved = await loadFormState(svc);
    if (!saved) return;

    if (svc === 'airtime' && saved.networkId) {
      setNetwork({ id: saved.networkId, label: saved.networkLabel ?? saved.networkId, color: saved.networkColor ?? '#6B7280' });
      setAirtimePhone(saved.phone ?? '');
    }
    if (svc === 'data' && saved.networkId) {
      setDataNetwork({ id: saved.networkId, label: saved.networkLabel ?? saved.networkId, color: saved.networkColor ?? '#6B7280' });
      setDataPhone(saved.phone ?? '');
    }
    if (svc === 'electricity' && saved.discoId) {
      setDisco({ id: saved.discoId, label: saved.discoLabel ?? saved.discoId });
      setMeterNumber(saved.meter ?? '');
      setElecPhone(saved.phone ?? '');
      setMeterType(saved.meterType ?? 'prepaid');
    }
    if (svc === 'cable' && saved.provId) {
      setCableProv({ id: saved.provId, label: saved.provLabel ?? saved.provId, color: saved.provColor ?? '#6B7280' });
      setSmartcard(saved.smartcard ?? '');
      setCablePhone(saved.phone ?? '');
    }
  }, [resetAll, loadFormState]);

  // ── Data: fetch networks from Peyflex on section open ───────────────────────
  const loadDataNetworks = async () => {
    if (dataNetworks.length > 0) return; // already loaded
    setLoadingDataNetworks(true);
    try {
      const jwt    = await getJwt();
      const result = await callEdge({ action: 'get_data_networks' }, jwt);
      const raw: any[] = Array.isArray(result?.networks)
        ? result.networks
        : Array.isArray(result)
          ? result
          : [];
      const nets: Network[] = raw
        .map((n: any) => {
          const id = String(n.identifier ?? n.id ?? n.code ?? n.network ?? '').trim();
          const rawName = String(n.name ?? n.label ?? id);
          return {
            id,
            label: friendlyNetworkName(id, rawName),
            color: NETWORK_COLORS[id] ?? NETWORK_COLORS[id.split('_')[0]] ?? '#6B7280',
          };
        })
        .filter((n: Network) => !!n.id);
      setDataNetworks(nets);
    } catch {
      showBillNotice('Notice', 'Could not load networks. Please try again.');
    } finally {
      setLoadingDataNetworks(false);
    }
  };

  // ── Data: fetch plans when network chosen ────────────────────────────────────
  const handlePickDataNetwork = async (net: Network) => {
    if (!net.id) {
      showBillNotice('Notice', 'This network is missing its identifier. Please reload and try again.');
      return;
    }
    setDataNetwork(net);
    setShowDataNetPicker(false);
    setSelectedDataPlan(null);
    setDataPlans([]);
    setLoadingDataPlans(true);
    try {
      const jwt    = await getJwt();
      // Correct Peyflex URL uses query param: /api/data/plans/?network=<id>
      const result = await callEdge({ action: 'get_data_variations', network: net.id }, jwt);
      const raw: any[] = Array.isArray(result?.plans) ? result.plans : [];
      const plans: Plan[] = raw
        .map((p: any) => {
          const rawLabel = p.label ?? p.display ?? p.name ?? String(p.plan_code);
          const amount   = Number(p.amount ?? p.price ?? 0);
          return {
            id:     p.plan_code ?? p.identifier ?? p.code ?? p.id,
            label:  cleanPlanLabel(rawLabel),
            amount,
          };
        })
        .filter((p: Plan) => p.amount > 0);
      setDataPlans(plans);
      if (plans.length === 0) showBillNotice('Notice', 'No plans available for this network right now.');
    } catch {
      showBillNotice('Notice', 'Could not load data plans. Please try again.');
    } finally {
      setLoadingDataPlans(false);
    }
  };

  // ── Electricity: fetch DISCOs from Peyflex on section open ─────────────────
  const loadDiscos = async () => {
    if (discos.length > 0) return;
    setLoadingDiscos(true);
    try {
      const jwt    = await getJwt();
      const result = await callEdge({ action: 'get_electricity_plans' }, jwt);
      // Peyflex may return { plans: [...] } or { discos: [...] } or a flat array
      const raw: any[] = Array.isArray(result?.plans)  ? result.plans
        : Array.isArray(result?.discos)                ? result.discos
        : Array.isArray(result)                        ? result
        : [];
      const list: Disco[] = raw
        .map((d: any) => ({
          id:    d.plan_code ?? d.plan_id ?? d.identifier ?? d.id ?? d.plan ?? d.code ?? '',
          label: d.plan_name ?? d.name ?? d.label ?? d.display ?? d.disco ?? String(d.plan_code ?? d.plan_id ?? d.identifier ?? d.id ?? ''),
        }))
        .filter((d: Disco) => d.id && d.label);
      // Always use fetched list if non-empty, else fall back
      setDiscos(list.length > 0 ? list : FALLBACK_DISCOS);
    } catch {
      setDiscos(FALLBACK_DISCOS);
    } finally {
      setLoadingDiscos(false);
    }
  };

  // ── Cable: fetch providers from Peyflex on section open ─────────────────────
  const loadCableProviders = async () => {
    if (cableProviders.length > 0) return;
    setLoadingCableProviders(true);
    try {
      const jwt    = await getJwt();
      const result = await callEdge({ action: 'get_cable_providers' }, jwt);
      const raw: any[] = Array.isArray(result?.providers) ? result.providers
        : Array.isArray(result?.data) ? result.data : [];
      const list: CableProv[] = raw.map((p: any) => ({
        id:    p.identifier ?? p.id ?? p.code,
        label: p.name ?? p.label ?? String(p.identifier ?? p.id),
        color: CABLE_COLORS[p.identifier ?? p.id] ?? '#6B7280',
      })).filter((p: CableProv) => p.id);
      setCableProviders(list.length > 0 ? list : FALLBACK_CABLE);
    } catch {
      setCableProviders(FALLBACK_CABLE);
    } finally {
      setLoadingCableProviders(false);
    }
  };

  // ── Electricity: verify meter ────────────────────────────────────────────────
  const handleVerifyMeter = async () => {
    if (!disco) { showBillNotice('Error', 'Select a DISCO first.'); return; }
    if (meterNumber.length < 6) { showBillNotice('Error', 'Enter a valid meter number.'); return; }
    setVerifyingMeter(true); setVerifiedMeter(null);
    try {
      const jwt    = await getJwt();
      const result = await callEdge({
        action:      'verify_customer',
        customerId:  meterNumber,
        serviceId:   disco.id,
        variationId: meterType,
        serviceType: 'electricity',
        phone:       elecPhone.replace(/\D/g, ''),
      }, jwt);
      const name = result?.customer?.customer_name ?? result?.customer?.name
        ?? result?.customer?.meter_name ?? null;
      setVerifiedMeter(name ?? 'Meter verified ✓');
    } catch (e: any) {
      showBillNotice('Verification Failed', e?.message ?? 'Could not verify meter.');
    } finally {
      setVerifyingMeter(false);
    }
  };

  // ── Cable TV: fetch plans when provider chosen ───────────────────────────────
  const handlePickCableProvider = async (prov: CableProv) => {
    setCableProv(prov);
    setShowCableProvPicker(false);
    setSelectedCablePlan(null); setSmartcard(''); setVerifiedCard(null); setCablePlans([]);
    setLoadingCablePlans(true);
    try {
      const jwt    = await getJwt();
      const result = await callEdge({ action: 'get_cable_variations', provider: prov.id }, jwt);
      const raw: any[] = Array.isArray(result?.plans) ? result.plans : [];
      const plans: Plan[] = raw
        .map((p: any) => {
          const rawLabel = p.label ?? p.display ?? p.name ?? String(p.plan_code);
          const amount   = Number(p.amount ?? p.price ?? 0);
          return {
            id:     p.plan_code ?? p.identifier ?? p.code ?? p.id,
            label:  cleanPlanLabel(rawLabel),
            amount,
          };
        })
        .filter((p: Plan) => p.amount > 0);
      setCablePlans(plans);
      if (plans.length === 0) showBillNotice('Notice', 'No plans available for this provider right now.');
    } catch {
      showBillNotice('Notice', 'Could not load plans. Please try again.');
    } finally {
      setLoadingCablePlans(false);
    }
  };

  // ── Cable TV: verify smartcard ───────────────────────────────────────────────
  const handleVerifySmartcard = async () => {
    if (!cableProv) { showBillNotice('Error', 'Select a provider first.'); return; }
    if (smartcard.length < 5) { showBillNotice('Error', 'Enter a valid smartcard/IUC number.'); return; }
    setVerifyingCard(true); setVerifiedCard(null);
    try {
      const jwt    = await getJwt();
      const result = await callEdge({
        action:     'verify_customer',
        customerId: smartcard,
        serviceId:  cableProv.id,
        serviceType: 'cable',
      }, jwt);
      const name = result?.customer?.customer_name ?? result?.customer?.name ?? null;
      setVerifiedCard(name ?? 'Smartcard verified ✓');
    } catch (e: any) {
      showBillNotice('Verification Failed', e?.message ?? 'Could not verify smartcard.');
    } finally {
      setVerifyingCard(false);
    }
  };

  // ── Pay ──────────────────────────────────────────────────────────────────────
  const handlePay = () => {
    if (!user || !profile || totalNGN <= 0) {
      showBillNotice('Error', 'Please complete all required fields.'); return;
    }
    if (serviceType === 'airtime') {
      if (!network) { showBillNotice('Error', 'Select a network.'); return; }
      if (airtimePhone.replace(/\D/g,'').length < 11) { showBillNotice('Error', 'Enter a valid 11-digit phone number.'); return; }
      if (totalNGN < 50) { showBillNotice('Error', 'Minimum airtime is ₦50.'); return; }
    }
    if (serviceType === 'data') {
      if (!dataNetwork?.id) { showBillNotice('Error', 'Select a valid network.'); return; }
      if (!selectedDataPlan) { showBillNotice('Error', 'Select a data plan.'); return; }
      if (dataPhone.replace(/\D/g,'').length < 11) { showBillNotice('Error', 'Enter a valid phone number.'); return; }
    }
    if (serviceType === 'electricity') {
      if (!disco) { showBillNotice('Error', 'Select a DISCO.'); return; }
      if (meterNumber.length < 6) { showBillNotice('Error', 'Enter a valid meter number.'); return; }
      if (elecPhone.replace(/\D/g,'').length < 11) { showBillNotice('Error', 'Enter a valid phone number.'); return; }
      if (totalNGN < 500) { showBillNotice('Error', 'Minimum electricity payment is ₦500.'); return; }
    }
    if (serviceType === 'cable') {
      if (!cableProv) { showBillNotice('Error', 'Select a cable provider.'); return; }
      if (!selectedCablePlan) { showBillNotice('Error', 'Select a subscription plan.'); return; }
      if (smartcard.length < 5) { showBillNotice('Error', 'Enter a valid smartcard/IUC number.'); return; }
      if (cablePhone.replace(/\D/g,'').length < 11) { showBillNotice('Error', 'Enter a valid phone number.'); return; }
    }

    if (payMode === 'points' && finalPoints > pointsBalance) {
      showBillNotice('Insufficient Points', `You need ${finalPoints} pts but have ${pointsBalance}.`); return;
    }
    if ((payMode === 'wallet' || payMode === 'mix') && finalWallet > walletNGN) {
      showBillNotice('Insufficient Wallet', `You need ₦${finalWallet.toLocaleString()} but have ₦${walletNGN.toLocaleString()}.`); return;
    }
    if (payMode === 'mix' && mixPoints > pointsBalance) {
      showBillNotice('Insufficient Points', `You only have ${pointsBalance} points.`); return;
    }

    posthog.capture('bill_payment_initiated', {
      service_type: serviceType,
      amount_ngn: totalNGN,
      pay_mode: payMode,
    });

    const payDesc =
      payMode === 'points' ? `${finalPoints} points` :
      payMode === 'wallet' ? `₦${finalWallet.toLocaleString()} wallet` :
      `${finalPoints} pts + ₦${finalWallet.toLocaleString()} wallet`;

    const message = `Pay ₦${totalNGN.toLocaleString()} for ${serviceType} using ${payDesc}?`;
    pendingRefRef.current = makeRef();

    if (Platform.OS === 'web') {
      setConfirmMessage(message);
      setShowConfirmPay(true);
      return;
    }

    Alert.alert(
      'Confirm Payment',
      message,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: executePay }],
    );
  };

  const executePay = async () => {
    setPaying(true);
    try {
      const jwt = await getJwt();
      const ref = pendingRefRef.current ?? (pendingRefRef.current = makeRef());
      const base = { amount: totalNGN, reference: ref, pointsToUse: finalPoints, walletAmount: finalWallet };

      let payload: Record<string, any>;

      if (serviceType === 'airtime') {
        payload = { ...base, serviceType: 'airtime', provider: network!.id, beneficiary: airtimePhone.replace(/\D/g,'') };
      } else if (serviceType === 'data') {
        if (!dataNetwork?.id) throw new Error('Selected data network is missing its identifier.');
        payload = {
          ...base,
          serviceType: 'data',
          provider: String(dataNetwork.id).trim(),
          beneficiary: dataPhone.replace(/\D/g,''),
          variationId: String(selectedDataPlan!.id).trim(),
        };
      } else if (serviceType === 'electricity') {
        payload = { ...base, serviceType: 'electricity', provider: disco!.id, beneficiary: meterNumber, variationId: meterType, phone: elecPhone.replace(/\D/g,'') };
      } else {
        payload = { ...base, serviceType: 'cable', provider: cableProv!.id, beneficiary: smartcard, variationId: selectedCablePlan!.id };
      }

      const result = await callEdge(payload, jwt);
      await refreshProfile();

      // The server only reports success:true once Peyflex confirms delivery -
      // a 200 response with success:false means it's still processing, and
      // claiming "Payment Successful" for that would be telling the customer
      // something that hasn't actually happened yet.
      const title = result.success ? 'Payment Successful' : 'Payment Processing';
      const emoji = result.success ? '✅' : '⏳';

      if (Platform.OS === 'web') {
        setWebNotice({
          title,
          message: result.success
            ? `${result.message}\n\nYour full payment details${serviceType === 'electricity' ? ' (including your electricity token)' : ''} are saved in Wallet History.`
            : result.message,
        });
      } else {
        Alert.alert(
          `${emoji} ${title}`,
          result.success
            ? `${result.message}\n\n📂 Your full payment details${serviceType === 'electricity' ? ' (including your electricity token)' : ''} are saved in Wallet History. Tap the Bills tab to view them anytime.`
            : result.message,
          [
            { text: 'Done', onPress: () => router.back() },
            { text: 'View Details', onPress: () => router.replace('/(customer)/wallet-history') },
          ],
        );
      }
    } catch (e: any) {
      showBillNotice('Payment Failed', e?.message ?? 'Could not complete payment. Please try again.');
    } finally {
      setPaying(false);
      setShowConfirmPay(false);
    }
  };

  // ── Not Nigerian ─────────────────────────────────────────────────────────────
  const isNigerianUser =
    profile?.preferred_currency === 'NGN' ||
    profile?.location?.toLowerCase().includes('nigeria');

  if (!isNigerianUser) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.headerPlain}>
          <Pressable style={s.backBtnDark} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#1F2937" />
          </Pressable>
          <Text style={s.headerTitleDark}>Utilities</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.unavailable}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>🌍</Text>
          <Text style={s.unavailableTitle}>Coming Soon</Text>
          <Text style={s.unavailableText}>Bill payment is currently available for Nigerian users only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <LinearGradient colors={[BRAND.purple, '#7B3FA8']} style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#FFF" />
        </Pressable>
        <Text style={s.headerTitle}>Utilities</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Balance cards */}
        <View style={s.balanceRow}>
          <View style={s.balCard}>
            <Star size={15} color={BRAND.gold} fill={BRAND.gold} />
            <Text style={s.balLabel}>Points</Text>
            <Text style={s.balValue}>{pointsBalance.toLocaleString()}</Text>
            <Text style={s.balSub}>Worth ₦{pointsBalanceValueNGN.toLocaleString()}</Text>
          </View>
          <View style={s.balCard}>
            <Wallet size={15} color={BRAND.purple} />
            <Text style={s.balLabel}>Wallet</Text>
            <Text style={s.balValue}>₦{Number(walletNGN).toLocaleString()}</Text>
          </View>
        </View>

        {/* ── Service selector - 2 × 2 grid ─────────────────────────────────── */}
        <Text style={s.sectionTitle}>Select Service</Text>
        <View style={s.serviceGrid}>
          <View style={s.serviceRow}>
            <ServiceCard
              label="Airtime" icon={<Smartphone size={26} color={serviceType === 'airtime' ? '#FFF' : BRAND.purple} />}
              active={serviceType === 'airtime'}
              onPress={() => handleSelectService('airtime')}
            />
            <ServiceCard
              label="Data" icon={<Wifi size={26} color={serviceType === 'data' ? '#FFF' : '#2563EB'} />}
              active={serviceType === 'data'}
              onPress={() => { handleSelectService('data'); loadDataNetworks(); }}
            />
          </View>
          <View style={s.serviceRow}>
            <ServiceCard
              label="Electricity" icon={<Zap size={26} color={serviceType === 'electricity' ? '#FFF' : BRAND.gold} />}
              active={serviceType === 'electricity'}
              onPress={() => { handleSelectService('electricity'); loadDiscos(); }}
            />
            <ServiceCard
              label="Cable TV" icon={<Tv size={26} color={serviceType === 'cable' ? '#FFF' : '#0A2FA0'} />}
              active={serviceType === 'cable'}
              onPress={() => { handleSelectService('cable'); loadCableProviders(); }}
            />
          </View>
        </View>

        {/* ── Airtime ────────────────────────────────────────────────────────── */}
        {serviceType === 'airtime' && <>
          <SectionLabel>Network</SectionLabel>
          <PickerBtn
            value={network?.label ?? ''} placeholder="Select Network"
            open={showNetworkPicker} onToggle={() => setShowNetworkPicker(v => !v)} dot={network?.color}
          />
          {showNetworkPicker && (
            <Dropdown>
              {AIRTIME_NETWORKS.map(n => (
                <DropItem key={n.id} label={n.label} dot={n.color} active={network?.id === n.id}
                  onPress={() => { setNetwork(n); setShowNetworkPicker(false); }} />
              ))}
            </Dropdown>
          )}
          <SectionLabel top>Phone Number</SectionLabel>
          <TextInput style={s.input} value={airtimePhone} onChangeText={setAirtimePhone}
            placeholder="08XXXXXXXXX" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" maxLength={11} />
          <SectionLabel top>Amount (₦)</SectionLabel>
          <TextInput style={s.input} value={airtimeAmount} onChangeText={setAirtimeAmount}
            placeholder="Min ₦50" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
          <QuickAmounts values={[100, 200, 500, 1000]} onSelect={v => setAirtimeAmount(String(v))} />
        </>}

        {/* ── Data ───────────────────────────────────────────────────────────── */}
        {serviceType === 'data' && <>
          <SectionLabel>Network</SectionLabel>
          {loadingDataNetworks
            ? <LoadingBox text="Loading networks…" />
            : <>
                <PickerBtn
                  value={dataNetwork?.label ?? ''} placeholder="Select Network"
                  open={showDataNetPicker} onToggle={() => setShowDataNetPicker(v => !v)} dot={dataNetwork?.color}
                />
                {showDataNetPicker && (
                  <Dropdown>
                    {dataNetworks.map(n => (
                      <DropItem key={n.id} label={n.label} dot={n.color} active={dataNetwork?.id === n.id}
                        onPress={() => handlePickDataNetwork(n)} />
                    ))}
                  </Dropdown>
                )}
              </>
          }

          {dataNetwork && <>
            <SectionLabel top>Data Plan</SectionLabel>
            {loadingDataPlans
              ? <LoadingBox text="Loading plans…" />
              : <>
                  <PickerBtn
                    value={selectedDataPlan ? `${selectedDataPlan.label} · ₦${selectedDataPlan.amount.toLocaleString()}` : ''}
                    placeholder="Select Plan" open={showDataPlanPicker}
                    onToggle={() => setShowDataPlanPicker(v => !v)}
                  />
                  {showDataPlanPicker && (
                    <Dropdown>
                      {dataPlans.map((p, i) => (
                        <DropItem key={`${String(p.id)}-${i}`} label={p.label}
                          active={selectedDataPlan?.id === p.id && selectedDataPlan?.amount === p.amount}
                          right={`₦${p.amount.toLocaleString()}`}
                          onPress={() => { setSelectedDataPlan(p); setShowDataPlanPicker(false); }} />
                      ))}
                    </Dropdown>
                  )}
                </>
            }
            <SectionLabel top>Phone Number</SectionLabel>
            <TextInput style={s.input} value={dataPhone} onChangeText={setDataPhone}
              placeholder="08XXXXXXXXX" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" maxLength={11} />
          </>}
        </>}

        {/* ── Electricity ─────────────────────────────────────────────────────── */}
        {serviceType === 'electricity' && <>
          <SectionLabel>DISCO</SectionLabel>
          {loadingDiscos
            ? <LoadingBox text="Loading providers…" />
            : <>
                <PickerBtn
                  value={disco?.label ?? ''} placeholder="Select Electricity Provider"
                  open={showDiscoPicker} onToggle={() => setShowDiscoPicker(v => !v)}
                />
                {showDiscoPicker && (
                  <Dropdown>
                    {discos.map(d => (
                      <DropItem key={d.id} label={d.label} active={disco?.id === d.id}
                        onPress={() => { setDisco(d); setShowDiscoPicker(false); }} />
                    ))}
                  </Dropdown>
                )}
              </>
          }

          <SectionLabel top>Meter Number</SectionLabel>
          <TextInput style={s.input} value={meterNumber}
            onChangeText={t => { setMeterNumber(t); setVerifiedMeter(null); }}
            placeholder="Enter meter number" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />

          <SectionLabel top>Phone Number</SectionLabel>
          <TextInput style={s.input} value={elecPhone} onChangeText={setElecPhone}
            placeholder="08XXXXXXXXX" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" maxLength={11} />

          <VerifyBtn label="Verify Meter" loading={verifyingMeter}
            disabled={meterNumber.length < 6 || !disco || elecPhone.replace(/\D/g,'').length < 11}
            onPress={handleVerifyMeter} />
          {verifiedMeter && <VerifiedBox text={verifiedMeter} />}

          <SectionLabel top>Meter Type</SectionLabel>
          <View style={s.toggleRow}>
            {(['prepaid', 'postpaid'] as const).map(t => (
              <Pressable key={t} style={[s.toggleBtn, meterType === t && s.toggleBtnActive]} onPress={() => setMeterType(t)}>
                <Text style={[s.toggleText, meterType === t && { color: '#FFF' }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <SectionLabel top>Amount (₦)</SectionLabel>
          <TextInput style={s.input} value={elecAmount} onChangeText={setElecAmount}
            placeholder="Min ₦500" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
          <QuickAmounts values={[1000, 2000, 5000, 10000]} onSelect={v => setElecAmount(String(v))} />
        </>}

        {/* ── Cable TV ────────────────────────────────────────────────────────── */}
        {serviceType === 'cable' && <>
          <SectionLabel>Provider</SectionLabel>
          {loadingCableProviders
            ? <LoadingBox text="Loading providers…" />
            : <>
                <PickerBtn
                  value={cableProv?.label ?? ''} placeholder="Select Provider (DStv, GOtv…)"
                  open={showCableProvPicker} onToggle={() => setShowCableProvPicker(v => !v)} dot={cableProv?.color}
                />
                {showCableProvPicker && (
                  <Dropdown>
                    {cableProviders.map(p => (
                      <DropItem key={p.id} label={p.label} dot={p.color} active={cableProv?.id === p.id}
                        onPress={() => handlePickCableProvider(p)} />
                    ))}
                  </Dropdown>
                )}
              </>
          }

          {cableProv && <>
            <SectionLabel top>Smartcard / IUC Number</SectionLabel>
            <TextInput style={s.input} value={smartcard}
              onChangeText={t => { setSmartcard(t); setVerifiedCard(null); }}
              placeholder="Enter smartcard or IUC number" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
            <VerifyBtn label="Verify Smartcard" loading={verifyingCard}
              disabled={smartcard.length < 5} onPress={handleVerifySmartcard} />
            {verifiedCard && <VerifiedBox text={verifiedCard} />}

            <SectionLabel top>Subscription Plan</SectionLabel>
            {loadingCablePlans
              ? <LoadingBox text="Loading plans…" />
              : <>
                  <PickerBtn
                    value={selectedCablePlan ? `${selectedCablePlan.label} · ₦${selectedCablePlan.amount.toLocaleString()}` : ''}
                    placeholder="Select Plan" open={showCablePlanPicker}
                    onToggle={() => setShowCablePlanPicker(v => !v)}
                  />
                  {showCablePlanPicker && (
                    <Dropdown>
                      {cablePlans.map(p => (
                        <DropItem key={String(p.id)} label={p.label} active={selectedCablePlan?.id === p.id}
                          right={`₦${p.amount.toLocaleString()}`}
                          onPress={() => { setSelectedCablePlan(p); setShowCablePlanPicker(false); }} />
                      ))}
                    </Dropdown>
                  )}
                </>
            }

            <SectionLabel top>Phone Number</SectionLabel>
            <TextInput style={s.input} value={cablePhone} onChangeText={setCablePhone}
              placeholder="08XXXXXXXXX" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" maxLength={11} />
          </>}
        </>}

        {/* ── Payment section ──────────────────────────────────────────────────── */}
        {totalNGN > 0 && <>
          <SectionLabel top>How to Pay</SectionLabel>
          <Text style={s.rateNote}>1 point = ₦{POINTS_RATE.toFixed(2)}</Text>

          <View style={s.modeRow}>
            {([
              { key: 'points', label: '⭐ Points' },
              { key: 'wallet', label: '💳 Wallet' },
              { key: 'mix',    label: '🔀 Mix'    },
            ] as { key: PayMode; label: string }[]).map(({ key, label }) => (
              <Pressable key={key}
                style={[s.modeBtn, payMode === key && s.modeBtnActive]}
                onPress={() => { setPayMode(key); setMixPointsInput(''); }}
              >
                <Text style={[s.modeBtnText, payMode === key && { color: '#FFF' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {payMode === 'points' && (
            <View style={s.breakdown}>
              <BRow label="Points needed" value={`${pointsNeeded.toLocaleString()} pts`} />
              <BRow label="You have" value={`${pointsBalance.toLocaleString()} pts`} warn={pointsBalance < pointsNeeded} />
            </View>
          )}

          {payMode === 'wallet' && (
            <View style={s.breakdown}>
              <BRow label="Amount" value={`₦${totalNGN.toLocaleString()}`} />
              <BRow label="Wallet balance" value={`₦${Number(walletNGN).toLocaleString()}`} warn={walletNGN < totalNGN} />
            </View>
          )}

          {payMode === 'mix' && (
            <View style={s.breakdown}>
              <Text style={s.mixLabel}>
                Points to use: {pointsBalance.toLocaleString()} pts available (₦{pointsBalanceValueNGN.toLocaleString()})
              </Text>
              <TextInput
                style={s.mixInput}
                value={mixPointsInput}
                onChangeText={v => {
                  const n = parseInt(v) || 0;
                  setMixPointsInput(v === '' ? '' : String(Math.min(n, pointsBalance)));
                }}
                placeholder={`0 to ${pointsBalance}`}
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
              <View style={s.mixDivider} />
              <BRow label="Points" value={`${mixPoints.toLocaleString()} pts = ₦${mixPointsNGN.toLocaleString()}`} />
              <BRow label="From wallet"    value={`₦${mixWallet.toLocaleString()}`} warn={mixWallet > walletNGN} />
              <BRow label="Total"          value={`₦${totalNGN.toLocaleString()}`} bold />
            </View>
          )}

          <View style={s.summary}>
            <Text style={s.summaryTitle}>Payment Summary</Text>
            <BRow label="Service" value={serviceType ?? ''} />
            <BRow label="Cost"    value={`₦${totalNGN.toLocaleString()}`} />
            {finalPoints > 0 && <BRow label="Points" value={`${finalPoints.toLocaleString()} pts → ₦${(finalPoints * POINTS_RATE).toLocaleString()}`} />}
            {finalWallet > 0 && <BRow label="Wallet" value={`₦${finalWallet.toLocaleString()}`} />}
            {!canAfford && <Text style={s.errText}>Insufficient balance.</Text>}
          </View>

          <Pressable style={[s.payBtn, (!canAfford || paying) && { opacity: 0.5 }]}
            onPress={handlePay} disabled={!canAfford || paying}>
            {paying
              ? <ActivityIndicator color="#FFF" />
              : <Text style={s.payBtnText}>Pay Now</Text>
            }
          </Pressable>
        </>}

      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showConfirmPay}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmPay(false)}
      >
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Confirm Payment</Text>
            <Text style={s.modalText}>{confirmMessage}</Text>
            <View style={s.modalActions}>
              <Pressable style={s.modalSecondaryBtn} onPress={() => setShowConfirmPay(false)}>
                <Text style={s.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.modalPrimaryBtn} onPress={executePay}>
                <Text style={s.modalPrimaryText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!webNotice}
        transparent
        animationType="fade"
        onRequestClose={closeBillNotice}
      >
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{webNotice?.title}</Text>
            <Text style={s.modalText}>{webNotice?.message}</Text>
            <View style={s.modalActions}>
              <Pressable
                style={s.modalPrimaryBtn}
                onPress={() => {
                  const title = webNotice?.title;
                  closeBillNotice();
                  if (title === 'Payment Successful') {
                    router.replace('/(customer)/wallet-history');
                  }
                }}
              >
                <Text style={s.modalPrimaryText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ServiceCard({ label, icon, active, onPress }: {
  label: string; icon: React.ReactNode; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={[s.serviceCard, active && s.serviceCardActive]} onPress={onPress}>
      {icon}
      <Text style={[s.serviceLabel, active && { color: '#FFF' }]}>{label}</Text>
    </Pressable>
  );
}

function SectionLabel({ children, top }: { children: React.ReactNode; top?: boolean }) {
  return <Text style={[s.sectionTitle, top && { marginTop: 16 }]}>{children}</Text>;
}

function PickerBtn({ value, placeholder, open, onToggle, dot }: {
  value: string; placeholder: string; open: boolean; onToggle: () => void; dot?: string;
}) {
  return (
    <Pressable style={s.picker} onPress={onToggle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
        <Text style={[s.pickerText, !value && { color: '#9CA3AF' }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </View>
      {open ? <ChevronUp size={18} color="#6B7280" /> : <ChevronDown size={18} color="#6B7280" />}
    </Pressable>
  );
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return <View style={s.dropdown}>{children}</View>;
}

function DropItem({ label, active, dot, right, onPress }: {
  label: string; active: boolean; dot?: string; right?: string; onPress: () => void;
}) {
  return (
    <Pressable style={[s.dropItem, active && s.dropItemActive]} onPress={onPress}>
      {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      <Text style={[s.dropItemText, active && { color: BRAND.purple, fontFamily: 'Inter-Bold' }]} numberOfLines={1}>
        {label}
      </Text>
      {right && <Text style={s.dropItemRight}>{right}</Text>}
    </Pressable>
  );
}

function VerifyBtn({ label, loading, disabled, onPress }: {
  label: string; loading: boolean; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={[s.verifyBtn, (loading || disabled) && { opacity: 0.5 }]}
      onPress={onPress} disabled={loading || disabled}>
      {loading
        ? <ActivityIndicator size="small" color={BRAND.purple} />
        : <Text style={s.verifyBtnText}>{label}</Text>
      }
    </Pressable>
  );
}

function VerifiedBox({ text }: { text: string }) {
  return (
    <View style={s.verifiedBox}>
      <Text style={s.verifiedText}>✅ {text}</Text>
    </View>
  );
}

function LoadingBox({ text }: { text: string }) {
  return (
    <View style={s.loadingBox}>
      <ActivityIndicator size="small" color={BRAND.purple} />
      <Text style={s.loadingText}>{text}</Text>
    </View>
  );
}

function QuickAmounts({ values, onSelect }: { values: number[]; onSelect: (v: number) => void }) {
  return (
    <View style={s.quickRow}>
      {values.map(v => (
        <Pressable key={v} style={s.quickBtn} onPress={() => onSelect(v)}>
          <Text style={s.quickText}>₦{v.toLocaleString()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function BRow({ label, value, warn, bold }: { label: string; value: string; warn?: boolean; bold?: boolean }) {
  return (
    <View style={s.brow}>
      <Text style={s.browLabel}>{label}</Text>
      <Text style={[s.browValue, warn && { color: '#EF4444' }, bold && { fontFamily: 'Inter-Bold' }]}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1F8' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18,
  },
  headerPlain: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18, backgroundColor: '#FFF',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  backBtnDark: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#FFF' },
  headerTitleDark: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },

  content: { padding: 20, paddingBottom: 120 },

  balanceRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  balCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 4,
    shadowColor: '#5A2D82', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  balLabel: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#9CA3AF', marginTop: 4 },
  balValue: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937' },
  balSub:   { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9CA3AF' },

  sectionTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#374151', marginBottom: 10, letterSpacing: 0.3 },

  // 2 × 2 service grid
  serviceGrid: { gap: 12, marginBottom: 24 },
  serviceRow:  { flexDirection: 'row', gap: 12 },
  serviceCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 20,
    alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  serviceCardActive: { backgroundColor: BRAND.purple, borderColor: BRAND.purple },
  serviceLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151' },

  picker: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 4,
  },
  pickerText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#1F2937' },
  dot: { width: 10, height: 10, borderRadius: 5 },

  dropdown: {
    backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB',
    marginBottom: 10, overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  dropItemActive: { backgroundColor: '#EDE9F6' },
  dropItemText:  { fontSize: 14, fontFamily: 'Inter-Regular', color: '#374151', flex: 1 },
  dropItemRight: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: BRAND.purple },

  input: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 15,
    fontSize: 15, fontFamily: 'Inter-Regular', color: '#1F2937',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },

  verifyBtn: {
    marginTop: 8, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: BRAND.purple,
    alignItems: 'center', backgroundColor: '#EDE9F6',
  },
  verifyBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: BRAND.purple },
  verifiedBox: {
    marginTop: 8, padding: 10, borderRadius: 10,
    backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#10B981',
  },
  verifiedText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#065F46' },

  loadingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, backgroundColor: '#FFF', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 4,
  },
  loadingText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280' },

  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: BRAND.purple, borderColor: BRAND.purple },
  toggleText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#374151' },

  quickRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#EDE9F6' },
  quickText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: BRAND.purple },

  rateNote: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter-Regular', marginBottom: 12, marginTop: -6 },

  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: BRAND.purple, borderColor: BRAND.purple },
  modeBtnText:   { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151' },

  breakdown: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 16,
  },
  mixLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 8 },
  mixInput: {
    backgroundColor: '#F9F5FF', borderRadius: 12, padding: 13,
    fontSize: 22, fontFamily: 'Inter-Bold', color: BRAND.purple,
    borderWidth: 1.5, borderColor: '#DDD6F3', marginBottom: 12,
  },
  mixDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 10 },

  brow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  browLabel: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280' },
  browValue: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1F2937' },

  summary: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 4,
  },
  summaryTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 12 },
  errText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#EF4444', marginTop: 4 },

  payBtn: {
    marginTop: 20, backgroundColor: BRAND.purple, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: BRAND.purple, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  payBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFF', letterSpacing: 0.3 },

  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  unavailableTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 12 },
  unavailableText:  { fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  modalSecondaryText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  modalPrimaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: BRAND.purple,
  },
  modalPrimaryText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFF',
  },
});
