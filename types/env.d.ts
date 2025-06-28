declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY: string;
      EXPO_PUBLIC_PAYPAL_CLIENT_ID: string;
      EXPO_PUBLIC_PAYPAL_SECRET: string;
      EXPO_PUBLIC_PAYPAL_SANDBOX: string;
    }
  }
}

export {};