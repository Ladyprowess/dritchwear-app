import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface Props {
  data: number[];
  width: number;
  height?: number;
  color?: string;
}

// Compact bar chart from a numeric series (e.g. new customers per day).
export default function MiniBars({ data, width, height = 120, color = '#7C3AED' }: Props) {
  const w = Math.max(1, width);
  const h = height;
  const n = data.length;
  if (n === 0) return <Svg width={w} height={h} />;

  const max = Math.max(...data, 1);
  const gap = n > 40 ? 1 : 3;
  const barW = Math.max(1, (w - gap * (n - 1)) / n);

  return (
    <Svg width={w} height={h}>
      {data.map((v, i) => {
        const barH = Math.max(1, (v / max) * (h - 4));
        return (
          <Rect
            key={i}
            x={i * (barW + gap)}
            y={h - barH}
            width={barW}
            height={barH}
            rx={Math.min(2, barW / 2)}
            fill={color}
            fillOpacity={0.85}
          />
        );
      })}
    </Svg>
  );
}
