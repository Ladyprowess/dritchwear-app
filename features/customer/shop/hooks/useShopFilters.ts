import { useState } from 'react';

export function useShopFilters() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const clearFilters = () => {
    setSelectedSizes([]);
    setSelectedColors([]);
    setMaxPrice(null);
    setMinPrice(null);
    setShowFilterModal(false);
  };

  return {
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    showFilterModal,
    setShowFilterModal,
    selectedSizes,
    setSelectedSizes,
    selectedColors,
    setSelectedColors,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    clearFilters,
  };
}
