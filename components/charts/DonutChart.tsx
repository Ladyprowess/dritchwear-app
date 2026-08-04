import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export interface DonutSegment { label: string; value: number; color: string; }

interface Props {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

// Presentational donut built from stroke-dasharray arcs - no dependencies beyond
// react-native-svg. Renders a soft track + one arc per segment.
export default function DonutChart({ segments, size = 150, strokeWidth = 20, centerLabel, centerValue }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);

  let offset = 0;
  const arcs = total > 0 ? segments.map((seg, i) => {
    const frac = Math.max(0, seg.value) / total;
    const dash = frac * circumference;
    const arc = (
      <Circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        fill="none"
      />
    );
    offset += dash;
    return arc;
  }) : [];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#EFECF3" strokeWidth={strokeWidth} fill="none" />
        {arcs}
      </Svg>
      {(centerValue || centerLabel) && (
        <View style={[StyleSheet.absoluteFillObject, styles.center]}>
          {!!centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
          {!!centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  centerValue: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#17131C' },
  centerLabel: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#7A7380', marginTop: 1 },
});
