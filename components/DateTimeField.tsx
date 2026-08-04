// Native (iOS/Android) date + time picker using the community picker.
// Opens a date step, then a time step, and combines them. The web build
// resolves DateTimeField.web.tsx instead (never bundles this native module).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
};

export function DateTimeField({ value, onChange, minimumDate }: Props) {
  const [mode, setMode] = useState<null | 'date' | 'time'>(null);
  const [draft, setDraft] = useState<Date>(value ?? new Date());

  const open = () => {
    setDraft(value ?? new Date(Date.now() + 60_000));
    setMode('date');
  };

  return (
    <>
      <Pressable style={styles.field} onPress={open} accessibilityRole="button">
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? value.toLocaleString() : 'Select date & time'}
        </Text>
      </Pressable>
      {mode && (
        <DateTimePicker
          value={draft}
          mode={mode}
          minimumDate={minimumDate}
          onChange={(event, selected) => {
            if (event.type === 'dismissed' || !selected) {
              setMode(null);
              return;
            }
            if (mode === 'date') {
              const next = new Date(draft);
              next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              setDraft(next);
              setMode('time'); // continue to the time step
            } else {
              const combined = new Date(draft);
              combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
              setMode(null);
              onChange(combined);
            }
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#E8E3EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  valueText: { color: '#17131C', fontFamily: 'Inter-Regular', fontSize: 14 },
  placeholderText: { color: '#8A838F', fontFamily: 'Inter-Regular', fontSize: 14 },
});
