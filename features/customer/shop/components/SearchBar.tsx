import React, { useEffect, useRef } from 'react';
import { TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { logEvent } from '@/lib/analytics';
import { styles } from '../styles';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSearchCommitted: (text: string) => void;
}

export function SearchBar({ value, onChangeText, onSearchCommitted }: SearchBarProps) {
  const searchEventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchEventTimerRef.current) {
        clearTimeout(searchEventTimerRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Search size={20} color="#665F6C" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search the collection"
          placeholderTextColor="#7A7380"
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            if (searchEventTimerRef.current) clearTimeout(searchEventTimerRef.current);
            searchEventTimerRef.current = setTimeout(() => {
              void logEvent('search', { search_term: text });
              onSearchCommitted(text);
            }, 600);
          }}
        />
      </View>
    </View>
  );
}
