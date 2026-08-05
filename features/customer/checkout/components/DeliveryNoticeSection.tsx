import React from 'react';
import { Text, View } from 'react-native';
import { Truck } from 'lucide-react-native';
import { styles } from '../styles';

const isLagos = (state: string) => state.trim().toLowerCase().includes('lagos');

interface DeliveryNoticeSectionProps {
  deliveryState: string;
}

// Delivery expectations need to be visible before checkout, not buried in a
// disclaimer afterward - it directly affects whether/how an order can even
// be fulfilled. GIGL/Speedaf only handle deliveries outside Lagos; within
// Lagos, a handful of far-out areas are also unreachable in practice (riders
// won't take the trip, or price it prohibitively), so both cases need a
// heads-up.
export function DeliveryNoticeSection({ deliveryState }: DeliveryNoticeSectionProps) {
  // Nothing to judge yet - wait until they've actually typed a state instead
  // of defaulting to the non-Lagos carrier wording the moment checkout opens.
  if (!deliveryState.trim()) return null;

  return (
    <View style={styles.deliveryNoticeCard}>
      <Truck size={18} color="#5A2D82" style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.deliveryNoticeTitle}>Delivery Notice</Text>
        {isLagos(deliveryState) ? (
          <Text style={styles.deliveryNoticeText}>
            We're currently unable to deliver to a few far-out Lagos areas: <Text style={styles.deliveryNoticeBold}>Badagry</Text>, <Text style={styles.deliveryNoticeBold}>Epe and areas past Awoyaya</Text>, <Text style={styles.deliveryNoticeBold}>deep Ikorodu</Text> (Owutu, Igbogbo, Ijede), <Text style={styles.deliveryNoticeBold}>Okokomaiko / Ojo / Trade Fair</Text>, and <Text style={styles.deliveryNoticeBold}>Agbara</Text>. If you're in one of these areas, please message us before ordering to confirm delivery options.
          </Text>
        ) : (
          <Text style={styles.deliveryNoticeText}>
            For deliveries outside Lagos, we ship through <Text style={styles.deliveryNoticeBold}>God Is Good Logistics (GIGL)</Text> or <Text style={styles.deliveryNoticeBold}>Speedaf</Text>. Delivery options depend on your location - some locations qualify for <Text style={styles.deliveryNoticeBold}>doorstep delivery</Text>, while others require <Text style={styles.deliveryNoticeBold}>pickup</Text> from the nearest office. We currently deliver only to locations served by these carriers.
          </Text>
        )}
      </View>
    </View>
  );
}
