import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { SALES_MOMENTS, BRAND_GOLD } from '../constants';
import { styles } from '../styles';

export function SalesMomentumBanner() {
  const [momentIndex, setMomentIndex] = useState(0);
  const momentPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(momentPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(momentPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    const copy = setInterval(() => {
      setMomentIndex((index) => (index + 1) % SALES_MOMENTS.length);
    }, 3200);

    return () => {
      pulse.stop();
      clearInterval(copy);
    };
  }, [momentPulse]);

  return (
    <Animated.View
      style={[
        styles.salesMomentumCard,
        {
          transform: [{
            scale: momentPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.015],
            }),
          }],
        },
      ]}
    >
      <View style={styles.salesMomentumIcon}>
        <Sparkles size={16} color={BRAND_GOLD} />
      </View>
      <View style={styles.salesMomentumCopy}>
        <Text style={styles.salesMomentumTitle}>{SALES_MOMENTS[momentIndex]}</Text>
        <Text style={styles.salesMomentumText}>
          Add your favourites now - your cart keeps the picks, but checkout locks the order.
        </Text>
      </View>
    </Animated.View>
  );
}
