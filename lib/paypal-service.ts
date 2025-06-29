// Production-ready PayPal service utilities

import { supabase } from './supabase';

export interface PayPalOrderRequest {
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  description?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface PayPalOrderResponse {
  success: boolean;
  orderId?: string;
  approvalUrl?: string;
  order?: any;
  error?: string;
  requestId?: string;
}

export interface PayPalCaptureRequest {
  orderId: string;
  userId?: string;
}

export interface PayPalCaptureResponse {
  success: boolean;
  transactionId?: string;
  captureResult?: any;
  error?: string;
  requestId?: string;
}

export interface PayPalOrderStatusResponse {
  success: boolean;
  order?: any;
  error?: string;
  requestId?: string;
}

export class PayPalService {
  private static instance: PayPalService;
  
  private constructor() {}
  
  public static getInstance(): PayPalService {
    if (!PayPalService.instance) {
      PayPalService.instance = new PayPalService();
    }
    return PayPalService.instance;
  }

  async createOrder(orderData: PayPalOrderRequest): Promise<PayPalOrderResponse> {
    try {
      console.log('🚀 PayPalService: Creating order', {
        amount: orderData.amount,
        currency: orderData.currency,
        userId: orderData.userId
      });

      const { data, error } = await supabase.functions.invoke('paypal-payment', {
        body: {
          action: 'create-order',
          ...orderData,
          metadata: {
            ...orderData.metadata,
            service_version: '1.0',
            created_at: new Date().toISOString()
          }
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      if (error) {
        console.error('❌ PayPalService: Create order error', error);
        throw new Error(error.message || 'Failed to create PayPal order');
      }

      console.log('✅ PayPalService: Order created successfully', {
        orderId: data?.orderId,
        requestId: data?.requestId
      });

      return data;
    } catch (error) {
      console.error('💥 PayPalService: Create order exception', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create PayPal order'
      };
    }
  }

  async captureOrder(captureData: PayPalCaptureRequest): Promise<PayPalCaptureResponse> {
    try {
      console.log('💰 PayPalService: Capturing order', {
        orderId: captureData.orderId,
        userId: captureData.userId
      });

      const { data, error } = await supabase.functions.invoke('paypal-payment', {
        body: {
          action: 'capture-order',
          ...captureData
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      if (error) {
        console.error('❌ PayPalService: Capture order error', error);
        throw new Error(error.message || 'Failed to capture PayPal payment');
      }

      console.log('✅ PayPalService: Order captured successfully', {
        transactionId: data?.transactionId,
        requestId: data?.requestId
      });

      return data;
    } catch (error) {
      console.error('💥 PayPalService: Capture order exception', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture PayPal payment'
      };
    }
  }

  async getOrderStatus(orderId: string): Promise<PayPalOrderStatusResponse> {
    try {
      console.log('📋 PayPalService: Getting order status', { orderId });

      const { data, error } = await supabase.functions.invoke('paypal-payment', {
        body: {
          action: 'order-status',
          orderId: orderId
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      if (error) {
        console.error('❌ PayPalService: Order status error', error);
        throw new Error(error.message || 'Failed to get PayPal order status');
      }

      console.log('✅ PayPalService: Order status retrieved', {
        status: data?.order?.status,
        requestId: data?.requestId
      });

      return data;
    } catch (error) {
      console.error('💥 PayPalService: Order status exception', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get PayPal order status'
      };
    }
  }

  // Utility methods for validation and formatting
  validateAmount(amount: number, currency: string): boolean {
    const minimums: Record<string, number> = {
      USD: 0.01, EUR: 0.01, GBP: 0.01, CAD: 0.01, AUD: 0.01,
      JPY: 1, CHF: 0.01, CNY: 0.01, INR: 1, ZAR: 0.01,
      KES: 1, GHS: 0.01, SGD: 0.01, HKD: 0.01, MXN: 0.01,
      BRL: 0.01, NOK: 0.01, SEK: 0.01, DKK: 0.01, PLN: 0.01
    };

    const minimum = minimums[currency] || 0.01;
    return amount >= minimum && Number.isFinite(amount) && amount > 0;
  }

  formatAmount(amount: number, currency: string): string {
    const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD'];
    
    if (noDecimalCurrencies.includes(currency.toUpperCase())) {
      return Math.round(amount).toString();
    }
    
    return amount.toFixed(2);
  }

  getSupportedCurrencies(): string[] {
    return [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 
      'INR', 'ZAR', 'KES', 'GHS', 'SGD', 'HKD', 'MXN', 'BRL',
      'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF', 'ILS', 'PHP',
      'THB', 'TWD', 'NZD'
    ];
  }

  isSupportedCurrency(currency: string): boolean {
    return this.getSupportedCurrencies().includes(currency.toUpperCase());
  }

  // Error handling utilities
  getErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return 'An unexpected error occurred';
  }

  isRetryableError(error: any): boolean {
    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'rate limit',
      '429',
      '502',
      '503',
      '504'
    ];

    const errorMessage = this.getErrorMessage(error).toLowerCase();
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }
}

// Export singleton instance
export const paypalService = PayPalService.getInstance();

// Utility functions for direct use
export function validatePayPalAmount(amount: number, currency: string): boolean {
  return paypalService.validateAmount(amount, currency);
}

export function formatPayPalAmount(amount: number, currency: string): string {
  return paypalService.formatAmount(amount, currency);
}

export function getPayPalSupportedCurrencies(): string[] {
  return paypalService.getSupportedCurrencies();
}

export function isPayPalSupportedCurrency(currency: string): boolean {
  return paypalService.isSupportedCurrency(currency);
}