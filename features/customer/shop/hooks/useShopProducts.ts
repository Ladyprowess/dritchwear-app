import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { convertToNGN } from '@/lib/currency';
import { getProductCategories, type StoreProduct } from '@/types/product';
import { isNewProduct } from '../constants';

interface ShopFilters {
  selectedCategory: string;
  searchQuery: string;
  selectedSizes: string[];
  selectedColors: string[];
  minPrice: number | null;
  maxPrice: number | null;
}

const PAGE_SIZE = 12;

// Product prices are always stored/compared in NGN; the price filter's
// min/max inputs are in the shopper's preferred display currency, so they
// must be converted before comparing - otherwise a non-NGN shopper's
// "10-50" filter is silently comparing against NGN 10-50, hiding everything.
export function useShopProducts(filters: ShopFilters, preferredCurrency: string = 'NGN') {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProducts = async () => {
    setLoading(true);

    const [{ data: productsData, error: productError }, { data: salesData, error: salesError }, { data: featuredData }] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase.rpc('get_product_sales_counts'),
      supabase.from('featured_products').select('product_id, position').eq('is_active', true).order('position'),
    ]);

    const { data: ratingsData, error: ratingError } = await supabase
      .from('product_rating_summaries')
      .select('product_id, total_reviews, average_rating');

    const { data: primaryImages, error: imageError } = await supabase
      .from('product_images')
      .select('product_id, image_url')
      .eq('is_primary', true);

    if (productError || ratingError || imageError) {
      console.error('Error fetching products, ratings, or images:', productError || ratingError || imageError);
      setLoading(false);
      return;
    }

    // Merge review data into each product and handle backward compatibility
    if (salesError) console.warn('Sales ranking is temporarily unavailable:', salesError.message);
    const salesByProduct = new Map<string, number>((salesData ?? []).map((row: any) => [String(row.product_id), Number(row.total_ordered) || 0]));
    const rankedIds = new Set(
      [...salesByProduct.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id)
    );
    const featuredByProduct = new Map((featuredData ?? []).map((row: any) => [String(row.product_id), Number(row.position) || 99]));

    const merged = productsData.map(product => {
      const rating = ratingsData?.find(r => r.product_id === product.id);
      const primaryImage = primaryImages?.find(image => image.product_id === product.id);

      // Handle backward compatibility: convert old 'category' field to 'categories' array
      let productCategories: string[] = [];
      if (Array.isArray(product.categories)) {
        productCategories = product.categories;
      } else if (product.category) {
        productCategories = [product.category];
      }

      return {
        ...product,
        image_url: primaryImage?.image_url || product.image_url,
        categories: productCategories,
        total_reviews: rating?.total_reviews || 0,
        average_rating: rating?.average_rating || 0,
        sales_count: salesByProduct.get(String(product.id)) || 0,
        is_hot: rankedIds.has(String(product.id)),
        is_featured: featuredByProduct.has(String(product.id)),
        featured_position: featuredByProduct.get(String(product.id)),
      };
    }).sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      if (a.is_featured && b.is_featured) return (a.featured_position || 99) - (b.featured_position || 99);
      if (a.is_hot !== b.is_hot) return a.is_hot ? -1 : 1;
      if (a.is_hot && b.is_hot && a.sales_count !== b.sales_count) return b.sales_count - a.sales_count;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    setProducts(merged);
    setFilteredProducts(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const { selectedCategory, searchQuery, selectedSizes, selectedColors, minPrice, maxPrice } = filters;

  useEffect(() => {
    let filtered = [...products];

    if (selectedCategory === 'Featured') {
      filtered = filtered.filter(p => p.is_featured);
    } else if (selectedCategory === 'New') {
      filtered = filtered.filter(p => isNewProduct(p));
    } else if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => getProductCategories(p).includes(selectedCategory));
    }

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getProductCategories(p).some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (selectedSizes.length > 0) {
      filtered = filtered.filter(p => p.sizes.some(size => selectedSizes.includes(size)));
    }

    if (selectedColors.length > 0) {
      filtered = filtered.filter(p => p.colors.some(color => selectedColors.includes(color)));
    }

    if (minPrice !== null) {
      const minPriceNGN = convertToNGN(minPrice, preferredCurrency);
      filtered = filtered.filter(p => p.price >= minPriceNGN);
    }
    if (maxPrice !== null) {
      const maxPriceNGN = convertToNGN(maxPrice, preferredCurrency);
      filtered = filtered.filter(p => p.price <= maxPriceNGN);
    }

    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [products, selectedCategory, searchQuery, selectedSizes, selectedColors, maxPrice, minPrice, preferredCurrency]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const visibleProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return {
    products,
    filteredProducts,
    visibleProducts,
    loading,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize: PAGE_SIZE,
    fetchProducts,
  };
}
