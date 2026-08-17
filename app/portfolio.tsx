import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList,
  Image, Modal, ActivityIndicator, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Play, X, Images as ImagesIcon } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { smartBack } from '@/lib/navigation';
import type { UploadedMedia } from '@/lib/uploadMedia';
import RichTextView from '@/components/RichTextView';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';

const GRID_MAX_WIDTH = 1280;

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'corporate', label: 'Corporate / Tech Teams' },
  { value: 'event', label: 'Events & Conferences' },
  { value: 'streetwear', label: 'Streetwear Drops' },
];

interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  client_name: string | null;
  media_urls: UploadedMedia[];
}

function VideoTile({ uri }: { uri: string }) {
  if (Platform.OS === 'web') {
    return (
      // @ts-ignore - video is a valid DOM element on web
      <video src={uri} controls playsInline style={{ width: '100%', height: '100%', borderRadius: 12, background: '#000', objectFit: 'contain' }} />
    );
  }
  const { useVideoPlayer, VideoView } = require('expo-video');
  const player = useVideoPlayer(uri, (p: any) => { p.loop = false; });
  return <VideoView style={{ width: '100%', height: '100%', borderRadius: 12 }} player={player} allowsFullscreen nativeControls />;
}

export default function PortfolioScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isDesktop } = useDesktopLayout();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (!error) setItems((data || []) as PortfolioItem[]);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter);
  const columnsForWidth = width >= 1500 ? 5 : width >= 1200 ? 4 : width >= 900 ? 3 : width >= 600 ? 2 : 2;
  // Never render more columns than there are items - a handful of cards
  // spread across a 5-column grid on a wide screen just looks like sparse,
  // tiny cards stuck in the top-left with dead space around them. Fewer
  // columns means the same math below makes each card bigger instead.
  const numColumns = Math.max(1, Math.min(columnsForWidth, filtered.length || columnsForWidth));
  const gridWidth = Math.min(width, GRID_MAX_WIDTH);
  const cardWidth = (gridWidth - 32 * 2 - 16 * (numColumns - 1)) / numColumns;

  const openLightbox = (item: PortfolioItem) => {
    setLightboxItem(item);
    setMediaIndex(0);
  };

  const closeLightbox = () => setLightboxItem(null);

  const goPrev = () => setMediaIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (!lightboxItem) return;
    setMediaIndex((i) => Math.min(lightboxItem.media_urls.length - 1, i + 1));
  };

  const currentMedia: UploadedMedia | null = lightboxItem?.media_urls[mediaIndex] ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerInner, isDesktop && styles.headerInnerDesktop]}>
          <Pressable
            style={styles.backButton}
            onPress={() => smartBack(router, '/(customer)/shop')}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color={BRAND.purple} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, isDesktop && styles.headerTitleDesktop]}>Our Past Work</Text>
            <Text style={styles.headerSub}>A look at merch we've produced for teams and events</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={[styles.filterRow, isDesktop && styles.filterRowDesktop]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterChipText, filter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={BRAND.purple} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <ImagesIcon size={40} color="#D1D5DB" />
          <Text style={styles.emptyText}>No projects in this category yet.</Text>
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={[styles.grid, isDesktop && styles.gridDesktop]}
          columnWrapperStyle={numColumns > 1 ? { gap: isDesktop ? 16 : 12 } : undefined}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, { width: cardWidth }]} onPress={() => openLightbox(item)}>
              <View style={[styles.cardThumbWrap, { width: cardWidth, height: cardWidth }]}>
                {item.media_urls[0]?.type === 'image' ? (
                  <Image source={{ uri: item.media_urls[0].url }} style={styles.cardThumb} resizeMode="cover" />
                ) : item.media_urls[0]?.posterUrl ? (
                  <View style={styles.cardThumb}>
                    <Image source={{ uri: item.media_urls[0].posterUrl }} style={styles.cardThumb} resizeMode="cover" />
                    <View style={styles.videoPlayBadge}>
                      <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.cardThumb, styles.videoPlaceholder]}>
                    <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                )}
                {item.media_urls.length > 1 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>+{item.media_urls.length - 1}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              {item.client_name && <Text style={styles.cardClient} numberOfLines={1}>{item.client_name}</Text>}
            </Pressable>
          )}
        />
      )}

      <Modal visible={!!lightboxItem} animationType="fade" transparent onRequestClose={closeLightbox}>
        <View style={styles.lightboxBackdrop}>
          <Pressable style={styles.lightboxClose} onPress={closeLightbox} hitSlop={10}>
            <X size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.lightboxMediaWrap}>
            {currentMedia?.type === 'video' ? (
              <VideoTile uri={currentMedia.url} />
            ) : currentMedia ? (
              <Image source={{ uri: currentMedia.url }} style={styles.lightboxImage} resizeMode="contain" />
            ) : null}

            {lightboxItem && lightboxItem.media_urls.length > 1 && (
              <>
                {mediaIndex > 0 && (
                  <Pressable style={[styles.navArrow, styles.navArrowLeft]} onPress={goPrev}>
                    <ChevronLeft size={22} color="#FFFFFF" />
                  </Pressable>
                )}
                {mediaIndex < lightboxItem.media_urls.length - 1 && (
                  <Pressable style={[styles.navArrow, styles.navArrowRight]} onPress={goNext}>
                    <ChevronRight size={22} color="#FFFFFF" />
                  </Pressable>
                )}
              </>
            )}
          </View>

          {lightboxItem && (
            <View style={styles.lightboxInfo}>
              <Text style={styles.lightboxTitle}>{lightboxItem.title}</Text>
              {lightboxItem.client_name && <Text style={styles.lightboxClient}>{lightboxItem.client_name}</Text>}
              {lightboxItem.description && (
                <RichTextView html={lightboxItem.description} color="#D1D5DB" fontSize={13} textAlign="center" />
              )}
              {lightboxItem.media_urls.length > 1 && (
                <Text style={styles.lightboxCount}>{mediaIndex + 1} / {lightboxItem.media_urls.length}</Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9CA3AF' },

  header: {
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInnerDesktop: { maxWidth: GRID_MAX_WIDTH, alignSelf: 'center', width: '100%', paddingHorizontal: 12 },
  backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerTitleDesktop: { fontSize: 22 },
  headerSub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },

  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'flex-start' },
  filterRowDesktop: { maxWidth: GRID_MAX_WIDTH, alignSelf: 'center', width: '100%', paddingHorizontal: 28 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF' },
  filterChipActive: { backgroundColor: BRAND.purple, borderColor: BRAND.purple },
  filterChipText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#4B5563' },
  filterChipTextActive: { color: '#FFF' },

  grid: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  gridDesktop: { maxWidth: GRID_MAX_WIDTH, alignSelf: 'center', width: '100%', paddingHorizontal: 32, gap: 16 },
  card: { marginBottom: 4 },
  cardThumbWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  cardThumb: { width: '100%', height: '100%' },
  videoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#374151' },
  videoPlayBadge: {
    position: 'absolute', top: '50%', left: '50%', marginTop: -18, marginLeft: -18,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  countBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeText: { color: '#FFF', fontSize: 11, fontFamily: 'Inter-Bold' },
  cardTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1F2937', marginTop: 8, lineHeight: 18 },
  cardClient: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 2 },

  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(10,6,16,0.94)', justifyContent: 'center' },
  lightboxClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lightboxMediaWrap: { width: '100%', height: '62%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  lightboxImage: { width: '100%', height: '100%', borderRadius: 12 },
  navArrow: { position: 'absolute', top: '50%', marginTop: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  navArrowLeft: { left: 8 },
  navArrowRight: { right: 8 },
  lightboxInfo: { paddingHorizontal: 24, paddingTop: 16 },
  lightboxTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF', textAlign: 'center' },
  lightboxClient: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: BRAND.gold, textAlign: 'center', marginTop: 4 },
  lightboxDesc: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#D1D5DB', textAlign: 'center', marginTop: 8, lineHeight: 19 },
  lightboxCount: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', textAlign: 'center', marginTop: 10 },
});
