import { useState } from 'react';
import { Alert } from 'react-native';
import { updateProfile } from '@/lib/auth';
import type { Profile } from '@/lib/auth';

// Split stored location "address, state, country" into separate fields
export function parseLocation(location: string) {
  const parts = (location || '').split(',').map(p => p.trim());
  return {
    address: parts.slice(0, Math.max(1, parts.length - 2)).join(', '),
    state:   parts[parts.length - 2] || '',
    country: parts[parts.length - 1] || '',
  };
}

export function useProfileForm(profile: Profile | null, refreshProfile: () => Promise<void>) {
  const parsedLoc = parseLocation(profile?.location || '');

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    address: parsedLoc.address,
    state: parsedLoc.state,
    country: parsedLoc.country,
    preferred_currency: profile?.preferred_currency || 'NGN',
  });

  const handleSave = async () => {
    try {
      const loc = [formData.address, formData.state, formData.country].filter(Boolean).join(', ');
      const { address: _a, state: _s, country: _c, ...rest } = formData;
      await updateProfile({ ...rest, location: loc });
      await refreshProfile();
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    const pl = parseLocation(profile?.location || '');
    setFormData({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      address: pl.address,
      state: pl.state,
      country: pl.country,
      preferred_currency: profile?.preferred_currency || 'NGN',
    });
    setEditing(false);
  };

  const handleCurrencyChange = (currencyCode: string) => {
    setFormData(prev => ({ ...prev, preferred_currency: currencyCode }));
  };

  return {
    editing,
    setEditing,
    formData,
    setFormData,
    parsedLoc,
    handleSave,
    handleCancel,
    handleCurrencyChange,
  };
}
