import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { User, Phone, MapPin, Globe } from 'lucide-react-native';
import CurrencySelector from '@/components/CurrencySelector';
import type { Profile } from '@/lib/auth';
import { styles } from '../styles';

interface FormData {
  full_name: string;
  phone: string;
  address: string;
  state: string;
  country: string;
  preferred_currency: string;
}

interface PersonalInfoSectionProps {
  profile: Profile;
  editing: boolean;
  formData: FormData;
  onFormDataChange: (updater: (prev: FormData) => FormData) => void;
  parsedLoc: { address: string; state: string; country: string };
  onCurrencyChange: (currencyCode: string) => void;
}

export function PersonalInfoSection({ profile, editing, formData, onFormDataChange, parsedLoc, onCurrencyChange }: PersonalInfoSectionProps) {
  return (
    <>
      <View style={styles.detailItem}>
        <View style={styles.detailHeader}>
          <User size={20} color="#6B7280" />
          <Text style={styles.detailLabel}>Full Name</Text>
        </View>
        {editing ? (
          <TextInput
            style={styles.detailInput}
            value={formData.full_name}
            onChangeText={(text) => onFormDataChange(prev => ({ ...prev, full_name: text }))}
            placeholder="Enter your full name"
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <Text style={styles.detailValue}>
            {profile.full_name || 'Not provided'}
          </Text>
        )}
      </View>

      <View style={styles.detailItem}>
        <View style={styles.detailHeader}>
          <Phone size={20} color="#6B7280" />
          <Text style={styles.detailLabel}>Phone Number</Text>
        </View>
        {editing ? (
          <TextInput
            style={styles.detailInput}
            value={formData.phone}
            onChangeText={(text) => onFormDataChange(prev => ({ ...prev, phone: text }))}
            placeholder="Enter your phone number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
          />
        ) : (
          <Text style={styles.detailValue}>
            {profile.phone || 'Not provided'}
          </Text>
        )}
      </View>

      <View style={styles.detailItem}>
        <View style={styles.detailHeader}>
          <MapPin size={20} color="#6B7280" />
          <Text style={styles.detailLabel}>Address</Text>
        </View>
        {editing ? (
          <TextInput
            style={styles.detailInput}
            value={formData.address}
            onChangeText={(text) => onFormDataChange(prev => ({ ...prev, address: text }))}
            placeholder="Street address"
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <Text style={styles.detailValue}>
            {parsedLoc.address || 'Not provided'}
          </Text>
        )}
      </View>

      <View style={styles.detailItem}>
        <View style={styles.detailHeader}>
          <MapPin size={20} color="#6B7280" />
          <Text style={styles.detailLabel}>State</Text>
        </View>
        {editing ? (
          <TextInput
            style={styles.detailInput}
            value={formData.state}
            onChangeText={(text) => onFormDataChange(prev => ({ ...prev, state: text }))}
            placeholder="State / Province"
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <Text style={styles.detailValue}>
            {parsedLoc.state || 'Not provided'}
          </Text>
        )}
      </View>

      <View style={styles.detailItem}>
        <View style={styles.detailHeader}>
          <MapPin size={20} color="#6B7280" />
          <Text style={styles.detailLabel}>Country</Text>
        </View>
        {editing ? (
          <TextInput
            style={styles.detailInput}
            value={formData.country}
            onChangeText={(text) => onFormDataChange(prev => ({ ...prev, country: text }))}
            placeholder="Country"
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <Text style={styles.detailValue}>
            {parsedLoc.country || 'Not provided'}
          </Text>
        )}
      </View>

      <View style={styles.detailItem}>
        <View style={styles.detailHeader}>
          <Globe size={20} color="#6B7280" />
          <Text style={styles.detailLabel}>Preferred Currency</Text>
        </View>
        {editing ? (
          <CurrencySelector
            selectedCurrency={formData.preferred_currency}
            onCurrencyChange={onCurrencyChange}
            showLabel={false}
            style={styles.currencySelector}
          />
        ) : (
          <Text style={styles.detailValue}>
            {profile.preferred_currency || 'NGN'}
          </Text>
        )}
      </View>
    </>
  );
}
