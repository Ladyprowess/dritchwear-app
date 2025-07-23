export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      custom_requests: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          quantity: number
          budget_range: string
          status: string
          created_at: string
          currency?: string
          invoice_sent: boolean
          business_name?: string
          event_name?: string
          logo_url?: string
          brand_colors?: string[]
          logo_placement?: string
          delivery_address?: string
          deadline?: string
          additional_notes?: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          quantity: number
          budget_range: string
          status?: string
          created_at?: string
          currency?: string
          invoice_sent?: boolean
          business_name?: string
          event_name?: string
          logo_url?: string
          brand_colors?: string[]
          logo_placement?: string
          delivery_address?: string
          deadline?: string
          additional_notes?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          quantity?: number
          budget_range?: string
          status?: string
          created_at?: string
          currency?: string
          invoice_sent?: boolean
          business_name?: string
          event_name?: string
          logo_url?: string
          brand_colors?: string[]
          logo_placement?: string
          delivery_address?: string
          deadline?: string
          additional_notes?: string
        }
      }
      invoices: {
        Row: {
          id: string
          custom_request_id: string
          user_id: string
          amount: number
          original_amount?: number
          currency?: string
          description: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          custom_request_id: string
          user_id: string
          amount: number
          original_amount?: number
          currency?: string
          description: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          custom_request_id?: string
          user_id?: string
          amount?: number
          original_amount?: number
          currency?: string
          description?: string
          status?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id?: string
          title: string
          message: string
          type: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          message: string
          type?: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          is_read?: boolean
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string
          items: Json[]
          subtotal: number
          service_fee: number
          delivery_fee: number
          total: number
          payment_method: string
          payment_status: string
          order_status: string
          delivery_address: string
          created_at: string
          currency?: string
          original_amount?: number
          promo_code?: string
          discount_amount?: number
        }
        Insert: {
          id?: string
          user_id: string
          items: Json[]
          subtotal: number
          service_fee: number
          delivery_fee: number
          total: number
          payment_method: string
          payment_status?: string
          order_status?: string
          delivery_address: string
          created_at?: string
          currency?: string
          original_amount?: number
          promo_code?: string
          discount_amount?: number
        }
        Update: {
          id?: string
          user_id?: string
          items?: Json[]
          subtotal?: number
          service_fee?: number
          delivery_fee?: number
          total?: number
          payment_method?: string
          payment_status?: string
          order_status?: string
          delivery_address?: string
          created_at?: string
          currency?: string
          original_amount?: number
          promo_code?: string
          discount_amount?: number
        }
      }
      paypal_transactions: {
        Row: {
          id: string
          user_id?: string
          paypal_order_id: string
          amount: number
          currency: string
          status: string
          transaction_type: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          paypal_order_id: string
          amount: number
          currency: string
          status: string
          transaction_type: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          paypal_order_id?: string
          amount?: number
          currency?: string
          status?: string
          transaction_type?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string
          price: number
          image_url: string
          category: string
          sizes: string[]
          colors: string[]
          stock: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          price: number
          image_url: string
          category: string
          sizes: string[]
          colors: string[]
          stock: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          price?: number
          image_url?: string
          category?: string
          sizes?: string[]
          colors?: string[]
          stock?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          image_url: string
          alt_text: string | null
          display_order: number
          is_primary: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          image_url: string
          alt_text?: string | null
          display_order?: number
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          image_url?: string
          alt_text?: string | null
          display_order?: number
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          location: string | null
          wallet_balance: number
          role: string
          created_at: string
          preferred_currency: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          location?: string | null
          wallet_balance?: number
          role?: string
          created_at?: string
          preferred_currency?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          location?: string | null
          wallet_balance?: number
          role?: string
          created_at?: string
          preferred_currency?: string
        }
      }
      promo_codes: {
        Row: {
          id: string
          code: string
          description: string
          discount_percentage: number
          is_active: boolean
          max_uses: number | null
          current_uses: number
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          description: string
          discount_percentage: number
          is_active?: boolean
          max_uses?: number | null
          current_uses?: number
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          description?: string
          discount_percentage?: number
          is_active?: boolean
          max_uses?: number | null
          current_uses?: number
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      special_offers: {
        Row: {
          id: string
          title: string
          subtitle: string
          discount_text: string
          promo_code: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          subtitle: string
          discount_text: string
          promo_code: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          subtitle?: string
          discount_text?: string
          promo_code?: string
          is_active?: boolean
          created_at?: string
        }
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string
          subject: string
          message: string
          status: string
          priority: string
          admin_response: string | null
          admin_id: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          message: string
          status?: string
          priority?: string
          admin_response?: string | null
          admin_id?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          message?: string
          status?: string
          priority?: string
          admin_response?: string | null
          admin_id?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: string
          amount: number
          description: string
          reference: string
          status: string
          created_at: string
          currency?: string
          original_amount?: number
          exchange_rate?: number
          payment_provider?: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          amount: number
          description: string
          reference: string
          status?: string
          created_at?: string
          currency?: string
          original_amount?: number
          exchange_rate?: number
          payment_provider?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          amount?: number
          description?: string
          reference?: string
          status?: string
          created_at?: string
          currency?: string
          original_amount?: number
          exchange_rate?: number
          payment_provider?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}