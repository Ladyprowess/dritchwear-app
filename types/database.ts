export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          location: string | null;
          wallet_balance: number;
          role: 'customer' | 'admin';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          location?: string | null;
          wallet_balance?: number;
          role?: 'customer' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          location?: string | null;
          wallet_balance?: number;
          role?: 'customer' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string;
          price: number;
          image_url: string;
          category: string;
          sizes: string[];
          colors: string[];
          stock: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          price: number;
          image_url: string;
          category: string;
          sizes?: string[];
          colors?: string[];
          stock?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          price?: number;
          image_url?: string;
          category?: string;
          sizes?: string[];
          colors?: string[];
          stock?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          items: any[];
          subtotal: number;
          service_fee: number;
          delivery_fee: number;
          total: number;
          payment_method: 'wallet' | 'paystack';
          payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
          order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
          promo_code_id: string | null;
          discount_amount: number;
          delivery_address: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          items: any[];
          subtotal: number;
          service_fee: number;
          delivery_fee: number;
          total: number;
          payment_method: 'wallet' | 'paystack';
          payment_status?: 'pending' | 'paid' | 'failed' | 'refunded';
          order_status?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
          promo_code_id?: string | null;
          discount_amount?: number;
          delivery_address: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          items?: any[];
          subtotal?: number;
          service_fee?: number;
          delivery_fee?: number;
          total?: number;
          payment_method?: 'wallet' | 'paystack';
          payment_status?: 'pending' | 'paid' | 'failed' | 'refunded';
          order_status?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
          promo_code_id?: string | null;
          discount_amount?: number;
          delivery_address?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      custom_requests: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          quantity: number;
          budget_range: string;
          status: 'pending' | 'under_review' | 'quoted' | 'accepted' | 'rejected' | 'completed';
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description: string;
          quantity: number;
          budget_range: string;
          status?: 'pending' | 'under_review' | 'quoted' | 'accepted' | 'rejected' | 'completed';
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          quantity?: number;
          budget_range?: string;
          status?: 'pending' | 'under_review' | 'quoted' | 'accepted' | 'rejected' | 'completed';
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          custom_request_id: string;
          user_id: string;
          amount: number;
          description: string;
          admin_notes: string | null;
          status: 'sent' | 'accepted' | 'rejected' | 'paid';
          user_response: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          custom_request_id: string;
          user_id: string;
          amount: number;
          description: string;
          admin_notes?: string | null;
          status?: 'sent' | 'accepted' | 'rejected' | 'paid';
          user_response?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          custom_request_id?: string;
          user_id?: string;
          amount?: number;
          description?: string;
          admin_notes?: string | null;
          status?: 'sent' | 'accepted' | 'rejected' | 'paid';
          user_response?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          discount_percentage: number;
          discount_amount: number | null;
          min_order_amount: number | null;
          max_usage: number | null;
          used_count: number;
          is_active: boolean;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_percentage?: number;
          discount_amount?: number | null;
          min_order_amount?: number | null;
          max_usage?: number | null;
          used_count?: number;
          is_active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          discount_percentage?: number;
          discount_amount?: number | null;
          min_order_amount?: number | null;
          max_usage?: number | null;
          used_count?: number;
          is_active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      promo_code_usage: {
        Row: {
          id: string;
          promo_code_id: string;
          user_id: string;
          order_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          promo_code_id: string;
          user_id: string;
          order_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          promo_code_id?: string;
          user_id?: string;
          order_id?: string;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'credit' | 'debit';
          amount: number;
          description: string;
          reference: string | null;
          status: 'pending' | 'completed' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'credit' | 'debit';
          amount: number;
          description: string;
          reference?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'credit' | 'debit';
          amount?: number;
          description?: string;
          reference?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          message: string;
          type: 'order' | 'promo' | 'system' | 'custom';
          is_read: boolean;
          data: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          message: string;
          type: 'order' | 'promo' | 'system' | 'custom';
          is_read?: boolean;
          data?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          message?: string;
          type?: 'order' | 'promo' | 'system' | 'custom';
          is_read?: boolean;
          data?: any | null;
          created_at?: string;
        };
      };
      special_offers: {
        Row: {
          id: string;
          title: string;
          subtitle: string;
          discount_text: string;
          promo_code: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle: string;
          discount_text: string;
          promo_code: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string;
          discount_text?: string;
          promo_code?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      support_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          subject: string;
          description: string;
          status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          assigned_admin_id: string | null;
          last_message_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          subject: string;
          description: string;
          status?: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          assigned_admin_id?: string | null;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          subject?: string;
          description?: string;
          status?: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          assigned_admin_id?: string | null;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_id: string;
          message: string;
          is_internal: boolean;
          attachments: any[];
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender_id: string;
          message: string;
          is_internal?: boolean;
          attachments?: any[];
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          sender_id?: string;
          message?: string;
          is_internal?: boolean;
          attachments?: any[];
          created_at?: string;
        };
      };
    };
  };
};