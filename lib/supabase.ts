import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Better session management for development
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Add these for better localhost handling
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'implicit'
  },
  // Add realtime configuration if needed
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Test connection
supabase.from('profiles').select('count').then(({ data, error }) => {
  if (error) {
    console.error('Supabase connection error:', error);
  } else {
    console.log('Supabase connected successfully');
  }
});