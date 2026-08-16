import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';

interface RichTextViewProps {
  html: string;
  color?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export default function RichTextView({ html, color = '#D1D5DB', fontSize = 13, textAlign = 'center' }: RichTextViewProps) {
  const { width } = useWindowDimensions();

  if (Platform.OS === 'web') {
    return (
      // @ts-ignore - div is a valid DOM element on web
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          color,
          fontSize,
          textAlign,
          fontFamily: 'Inter-Regular, sans-serif',
          lineHeight: `${fontSize + 6}px`,
          marginTop: 8,
        }}
      />
    );
  }

  const RenderHtml = require('react-native-render-html').default;
  return (
    <RenderHtml
      contentWidth={width - 48}
      source={{ html }}
      baseStyle={{ color, fontSize, textAlign, marginTop: 8 }}
      tagsStyles={{
        p: { marginTop: 0, marginBottom: 4 },
        li: { marginBottom: 2, textAlign },
      }}
    />
  );
}
