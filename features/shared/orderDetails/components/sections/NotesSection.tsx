import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../styles';

interface NotesSectionProps {
  note: string;
}

export function NotesSection({ note }: NotesSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Order Note</Text>
      <View style={styles.summaryCard}>
        <Text style={{ fontSize: 14, fontFamily: 'Inter-Regular', color: '#374151', lineHeight: 20 }}>
          {note}
        </Text>
      </View>
    </View>
  );
}
