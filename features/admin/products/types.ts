export interface ProductFormData {
  name: string;
  description: string;
  subtitle: string;
  price: string;
  image_url: string;
  categories: string[];
  sizes: string;
  colors: string;
  stock: string;
  is_active: boolean;
  is_on_sale: boolean;
  sale_label: string;
  min_tier: string; // '' = everyone, else Silver/Gold/Platinum
  compare_at_price: string; // original price for a real discount badge
  size_stock: Record<string, string>; // per-size stock inputs (string in form)
  allow_logo_upload: boolean; // let customers upload a logo for this product
}
