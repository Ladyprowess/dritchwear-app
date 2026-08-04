import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

interface Props {
  data: number[];
  width: number;
  height?: number;
  color?: string;
  fillFrom?: string;
}

// Smooth-ish area/line chart from a numeric series. Scales to the given width so
// the parent controls responsiveness. No axes - kept clean like the reference.
export default function AreaLineChart({ data, width, height = 180, color = '#5A2D82', fillFrom = 'rgba(90,45,130,0.18)' }: Props) {
  const pad = 8;
  const w = Math.max(1, width);
  const h = height;
  const n = data.length;

  if (n < 2) {
    return <View style={{ width: w, height: h }} />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const x = (i: number) => pad + (i * (w - pad * 2)) / (n - 1);
  const y = (v: number) => pad + (h - pad * 2) * (1 - (v - min) / range);

  const linePts = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const areaPts = `${linePts} L ${x(n - 1).toFixed(1)} ${h - pad} L ${x(0).toFixed(1)} ${h - pad} Z`;
  const lastX = x(n - 1);
  const lastY = y(data[n - 1]);

  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={fillFrom} stopOpacity="1" />
          <Stop offset="1" stopColor={fillFrom} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={areaPts} fill="url(#areaFill)" />
      <Path d={linePts} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={lastX} cy={lastY} r={4} fill={color} />
      <Circle cx={lastX} cy={lastY} r={7} fill={color} fillOpacity={0.18} />
    </Svg>
  );
}
