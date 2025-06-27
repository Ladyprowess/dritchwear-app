import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  {
    label: 'At least 6 characters',
    test: (password) => password.length >= 6,
  },
  {
    label: 'Contains uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: 'Contains lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: 'Contains number',
    test: (password) => /\d/.test(password),
  },
];

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const getStrengthScore = () => {
    return requirements.reduce((score, req) => {
      return score + (req.test(password) ? 1 : 0);
    }, 0);
  };

  const getStrengthLabel = (score: number) => {
    if (score === 0) return { label: '', color: '#9CA3AF' };
    if (score <= 1) return { label: 'Weak', color: '#EF4444' };
    if (score <= 2) return { label: 'Fair', color: '#F59E0B' };
    if (score <= 3) return { label: 'Good', color: '#3B82F6' };
    return { label: 'Strong', color: '#10B981' };
  };

  const score = getStrengthScore();
  const strength = getStrengthLabel(score);

  if (!password) return null;

  return (
    <View style={styles.container}>
      <View style={styles.strengthHeader}>
        <Text style={styles.strengthTitle}>Password Strength</Text>
        <Text style={[styles.strengthLabel, { color: strength.color }]}>
          {strength.label}
        </Text>
      </View>
      
      <View style={styles.strengthBar}>
        {[1, 2, 3, 4].map((level) => (
          <View
            key={level}
            style={[
              styles.strengthSegment,
              {
                backgroundColor: score >= level ? strength.color : '#E5E7EB',
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.requirements}>
        {requirements.map((requirement, index) => {
          const isValid = requirement.test(password);
          return (
            <View key={index} style={styles.requirement}>
              <View style={[styles.requirementIcon, { backgroundColor: isValid ? '#10B981' : '#E5E7EB' }]}>
                {isValid ? (
                  <Check size={12} color="#FFFFFF" />
                ) : (
                  <X size={12} color="#9CA3AF" />
                )}
              </View>
              <Text style={[styles.requirementText, { color: isValid ? '#10B981' : '#9CA3AF' }]}>
                {requirement.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strengthTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  strengthLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  requirements: {
    gap: 6,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requirementText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
});