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
      commerce_settings: {
        Row: {
          id: string
          cart_reminders_enabled: boolean
          first_reminder_hours: number
          second_reminder_hours: number
          final_reminder_hours: number
          free_delivery_enabled: boolean
          free_delivery_threshold_ngn: number
          service_fee_percentage: number
          tax_percentage: number
          minimum_order_ngn: number
          store_open: boolean
          store_closed_message: string
          updated_at: string
        }
        Insert: {
          id?: string
          cart_reminders_enabled?: boolean
          first_reminder_hours?: number
          second_reminder_hours?: number
          final_reminder_hours?: number
          free_delivery_enabled?: boolean
          free_delivery_threshold_ngn?: number
          service_fee_percentage?: number
          tax_percentage?: number
          minimum_order_ngn?: number
          store_open?: boolean
          store_closed_message?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cart_reminders_enabled?: boolean
          first_reminder_hours?: number
          second_reminder_hours?: number
          final_reminder_hours?: number
          free_delivery_enabled?: boolean
          free_delivery_threshold_ngn?: number
          service_fee_percentage?: number
          tax_percentage?: number
          minimum_order_ngn?: number
          store_open?: boolean
          store_closed_message?: string
          updated_at?: string
        }
      }
      delivery_zones: {
        Row: {
          id: string
          name: string
          match_keywords: string[]
          fee_ngn: number
          is_default: boolean
          sort_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          match_keywords?: string[]
          fee_ngn?: number
          is_default?: boolean
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          match_keywords?: string[]
          fee_ngn?: number
          is_default?: boolean
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
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
      gift_card_templates: {
        Row: {
          id: string
          slug: string
          name: string
          category: string
          image_path: string | null
          start_color: string
          end_color: string
          accent_color: string
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          category: string
          image_path?: string | null
          start_color?: string
          end_color?: string
          accent_color?: string
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          category?: string
          image_path?: string | null
          start_color?: string
          end_color?: string
          accent_color?: string
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      gift_cards: {
        Row: {
          id: string
          purchaser_user_id: string
          recipient_user_id: string | null
          redeemed_by_user_id: string | null
          template_id: string
          code: string
          share_token: string
          amount_ngn: number
          original_amount: number
          currency: string
          recipient_name: string
          sender_name: string
          recipient_email: string | null
          delivery_method: string
          message: string | null
          status: string
          redeemed_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          purchaser_user_id: string
          recipient_user_id?: string | null
          redeemed_by_user_id?: string | null
          template_id: string
          code: string
          share_token: string
          amount_ngn: number
          original_amount: number
          currency: string
          recipient_name: string
          sender_name: string
          recipient_email?: string | null
          delivery_method: string
          message?: string | null
          status?: string
          redeemed_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          purchaser_user_id?: string
          recipient_user_id?: string | null
          redeemed_by_user_id?: string | null
          template_id?: string
          code?: string
          share_token?: string
          amount_ngn?: number
          original_amount?: number
          currency?: string
          recipient_name?: string
          sender_name?: string
          recipient_email?: string | null
          delivery_method?: string
          message?: string | null
          status?: string
          redeemed_at?: string | null
          expires_at?: string | null
          created_at?: string
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
      points_transactions: {
        Row: {
          id: string
          user_id: string
          type: string
          amount: number
          description: string
          reference: string | null
          event_key: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          amount: number
          description: string
          reference?: string | null
          event_key?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          amount?: number
          description?: string
          reference?: string | null
          event_key?: string | null
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
          tax: number
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
          tax: number
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
          tax: number
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
      _transactions: {
        Row: {
          id: string
          user_id?: string
          _order_id: string
          amount: number
          currency: string
          status: string
          transaction_type: string
          metadata: Json
          created_at: string
          updated_at: string
          is_on_sale: boolean
          sale_label: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          _order_id: string
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
          _order_id?: string
          amount?: number
          currency?: string
          status?: string
          transaction_type?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      wishlists: {
        Row: { id: string; user_id: string; product_id: string; created_at: string }
        Insert: { id?: string; user_id: string; product_id: string; created_at?: string }
        Update: { id?: string; user_id?: string; product_id?: string; created_at?: string }
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
          is_on_sale: boolean
          sale_label: string | null
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
          is_on_sale?: boolean
          sale_label?: string | null
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
          is_on_sale?: boolean
          sale_label?: string | null
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
          points_balance?: number
          referral_code?: string | null
          referred_by_user_id?: string | null
          updated_at?: string
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
          points_balance?: number
          referral_code?: string | null
          referred_by_user_id?: string | null
          updated_at?: string
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
          points_balance?: number
          referral_code?: string | null
          referred_by_user_id?: string | null
          updated_at?: string
        }
      }
      referrals: {
        Row: {
          id: string
          referrer_user_id: string
          referred_user_id: string
          referral_code_used: string
          signup_rewarded_at: string
          first_paid_order_id: string | null
          first_paid_order_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          referrer_user_id: string
          referred_user_id: string
          referral_code_used: string
          signup_rewarded_at?: string
          first_paid_order_id?: string | null
          first_paid_order_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          referrer_user_id?: string
          referred_user_id?: string
          referral_code_used?: string
          signup_rewarded_at?: string
          first_paid_order_id?: string | null
          first_paid_order_at?: string | null
          created_at?: string
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
      get_gift_card_preview: {
        Args: {
          p_identifier: string
        }
        Returns: {
          gift_card_id: string
          code: string
          share_token: string
          template_slug: string
          template_name: string
          category: string
          image_path: string | null
          start_color: string
          end_color: string
          accent_color: string
          recipient_name: string
          sender_name: string
          recipient_email: string | null
          message: string | null
          status: string
          original_amount: number
          amount_ngn: number
          currency: string
          redeemed_at: string | null
          created_at: string
        }[]
      }
      issue_gift_card: {
        Args: {
          p_template_slug: string
          p_original_amount: number
          p_currency: string
          p_recipient_name: string
          p_sender_name: string
          p_recipient_email?: string | null
          p_delivery_method?: string
          p_message?: string | null
        }
        Returns: {
          gift_card_id: string
          code: string
          share_token: string
          amount_ngn: number
          original_amount: number
          currency: string
        }[]
      }
      redeem_gift_card: {
        Args: {
          p_identifier: string
        }
        Returns: {
          gift_card_id: string
          code: string
          amount_ngn: number
          original_amount: number
          currency: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
