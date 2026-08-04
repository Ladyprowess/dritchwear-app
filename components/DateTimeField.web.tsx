// Web (PWA) date + time picker - native browser calendar/clock via
// <input type="datetime-local">. No dependency; the browser renders the UI.
import React from 'react';

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
};

export function DateTimeField({ value, onChange, minimumDate }: Props) {
  return React.createElement('input', {
    type: 'datetime-local',
    value: value ? toLocalInput(value) : '',
    min: minimumDate ? toLocalInput(minimumDate) : undefined,
    onChange: (event: any) => {
      const raw = event?.target?.value;
      if (raw) onChange(new Date(raw)); // "YYYY-MM-DDTHH:MM" parses as local time
    },
    style: {
      width: '100%',
      boxSizing: 'border-box',
      minHeight: 44,
      border: '1px solid #E8E3EB',
      borderRadius: 8,
      padding: '10px 12px',
      fontSize: 14,
      fontFamily: 'Inter-Regular, system-ui, sans-serif',
      color: '#17131C',
      backgroundColor: '#FFFFFF',
    },
  });
}
