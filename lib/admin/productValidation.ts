import type { ProductFormData } from '@/features/admin/products/types';

export function validateProductForm(formData: ProductFormData): string | null {
  if (!formData.name.trim()) return 'Product name is required';
  if (!formData.description.trim()) return 'Description is required';
  if (!formData.price || Number.isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
    return 'Valid price is required';
  }
  if (!formData.image_url.trim()) return 'Image URL is required';
  if (formData.categories.length === 0) return 'At least one category is required';
  if (formData.categories.length > 2) return 'Maximum 2 categories allowed';
  if (!formData.stock || Number.isNaN(Number(formData.stock)) || Number(formData.stock) < 0) {
    return 'Valid stock quantity is required';
  }
  return null;
}
