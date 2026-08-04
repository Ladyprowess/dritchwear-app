import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { OrderNotice as OrderNoticeType } from '../types';
import { styles } from '../styles';

interface OrderNoticeProps {
  notice: OrderNoticeType | null;
  onDismiss: () => void;
}

export function OrderNotice({ notice, onDismiss }: OrderNoticeProps) {
  if (!notice) return null;

  return (
    <View accessibilityRole="alert" style={[styles.notice, notice.tone === 'error' ? styles.noticeError : notice.tone === 'success' ? styles.noticeSuccess : styles.noticeInfo]}>
      <Text style={styles.noticeText}>{notice.message}</Text>
      {!!notice.actionLabel && <Pressable style={styles.noticeAction} onPress={notice.onAction}><Text style={styles.noticeActionText}>{notice.actionLabel}</Text></Pressable>}
      <Pressable accessibilityLabel="Dismiss message" style={styles.noticeClose} onPress={onDismiss}><X size={16} color="#665F6C" /></Pressable>
    </View>
  );
}
