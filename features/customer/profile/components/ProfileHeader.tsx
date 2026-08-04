import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Edit3, Save, X } from 'lucide-react-native';
import { styles } from '../styles';

interface ProfileHeaderProps {
  editing: boolean;
  changingPassword: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onCancelPasswordChange: () => void;
  onSave: () => void;
  onSavePassword: () => void;
}

export function ProfileHeader({
  editing,
  changingPassword,
  onEdit,
  onCancelEdit,
  onCancelPasswordChange,
  onSave,
  onSavePassword,
}: ProfileHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Profile</Text>
      {!editing && !changingPassword ? (
        <Pressable style={styles.editButton} onPress={onEdit}>
          <Edit3 size={16} color="#5A2D82" />
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      ) : (
        <View style={styles.editActions}>
          <Pressable
            style={styles.cancelButton}
            onPress={changingPassword ? onCancelPasswordChange : onCancelEdit}
          >
            <X size={16} color="#6B7280" />
          </Pressable>
          <Pressable
            style={styles.saveButton}
            onPress={changingPassword ? onSavePassword : onSave}
          >
            <Save size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
