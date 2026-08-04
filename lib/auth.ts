import { Platform } from 'react-native';
import { supabase } from './supabase';
import { AuthError } from '@supabase/supabase-js';

const EMAIL_REDIRECT = Platform.OS === 'web'
  ? 'https://app.dritchwear.com'
  : 'dritchwear://callback';

export interface AuthCredentials {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  referralCode?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  wallet_balance: number;
  points_balance?: number;
  role: 'customer' | 'admin';
  preferred_currency: string;
  referral_code?: string | null;
  referred_by_user_id?: string | null;
}

export async function signUp({ email, password, fullName, phone, referralCode }: AuthCredentials) {
  try {
    console.log('📝 Signing up user:', email);
    
    // Sign up with email confirmation required
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          referral_code: referralCode?.trim().toUpperCase() || undefined,
        },
        emailRedirectTo: EMAIL_REDIRECT,
      },
    });

    if (error) {
      console.error('❌ Sign up error:', error);
      throw error;
    }
    
    console.log('✅ Sign up successful:', data.user?.email);
    
    // Check if email confirmation is required
    if (data.user && !data.session) {
      console.log('📧 Email confirmation required');
      return { 
        data, 
        error: null, 
        needsConfirmation: true,
        email: data.user.email 
      };
    }
    
    return { data, error: null, needsConfirmation: false };
  } catch (error) {
    console.error('💥 Sign up catch error:', error);
    return { data: null, error: error as AuthError, needsConfirmation: false };
  }
}

export async function signIn({ email, password }: AuthCredentials) {
  try {
    console.log('🔑 Signing in user:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Sign in error:', error);
      
      // Check if email is not confirmed
      if (error.message.includes('Email not confirmed')) {
        return { 
          data: null, 
          error, 
          needsConfirmation: true,
          email 
        };
      }
      
      throw error;
    }
    
    console.log('✅ Sign in successful:', data.user?.email);
    
    // Session will be automatically persisted by Supabase
    console.log('💾 Session persisted automatically');
    
    return { data, error: null, needsConfirmation: false };
  } catch (error) {
    console.error('💥 Sign in catch error:', error);
    return { data: null, error: error as AuthError, needsConfirmation: false };
  }
}

export async function signOut() {
  try {
    console.log('👋 Sign out requested');


    const { error } = await supabase.auth.signOut();

    // ✅ If Supabase says "session missing", treat it as already signed out
    if (error) {
      const msg = String((error as any)?.message || '').toLowerCase();

      if (msg.includes('auth session missing')) {
        console.log('ℹ️ No active session - treating as signed out');
        return { error: null };
      }

      console.error('❌ Sign out error:', error);
      throw error;
    }

    console.log('✅ Sign out successful - session cleared');
    return { error: null };
  } catch (error) {
    // ✅ Same protection here too (some builds throw instead of returning { error })
    const msg = String((error as any)?.message || '').toLowerCase();

    if (msg.includes('auth session missing')) {
      console.log('ℹ️ No active session - treating as signed out');
      return { error: null };
    }

    console.error('💥 Sign out catch error:', error);
    return { error: error as AuthError };
  }
}


export async function resetPassword(email: string) {
  try {
    console.log('🔄 Requesting password reset for:', email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Use app.dritchwear.com domain for password reset
      redirectTo: `https://app.dritchwear.com/reset-password`,
    });
    
    if (error) throw error;
    console.log('✅ Password reset email sent');
    return { error: null };
  } catch (error) {
    console.error('❌ Password reset error:', error);
    return { error: error as AuthError };
  }
}

export async function updatePassword(newPassword: string) {
  try {
    console.log('🔒 Updating password');
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) throw error;
    console.log('✅ Password updated successfully');
    return { error: null };
  } catch (error) {
    console.error('❌ Password update error:', error);
    return { error: error as AuthError };
  }
}

export async function resendConfirmation(email: string) {
  try {
    console.log('📧 Resending confirmation email for:', email);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: EMAIL_REDIRECT,
      },
    });
    
    if (error) throw error;
    console.log('✅ Confirmation email resent');
    return { error: null };
  } catch (error) {
    console.error('❌ Resend confirmation error:', error);
    return { error: error as AuthError };
  }
}

export async function getCurrentUser() {
  try {
    console.log('👤 Getting current user');
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('❌ Get user error:', error);
      throw error;
    }
    console.log('✅ Current user retrieved:', user?.email || 'No user');
    return { user, error: null };
  } catch (error) {
    console.error('💥 Get user catch error:', error);
    return { user: null, error: error as AuthError };
  }
}

export async function getProfile(): Promise<{ profile: Profile | null; error: AuthError | null }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error('❌ No session found for profile:', sessionError?.message);
      return { profile: null, error: sessionError };
    }

    console.log('📋 Fetching profile for user:', session.user.id);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      const code = (error as any)?.code;
      const msg  = (error as any)?.message || JSON.stringify(error);
      // PGRST116 = "no rows returned" - profile just doesn't exist yet, not a real error
      if (code === 'PGRST116') {
        console.log('ℹ️ Profile not found for user (will create one)');
        return { profile: null, error: null };
      }
      console.error('❌ Profile fetch error:', code, msg);
      return { profile: null, error: error as any };
    }

    console.log('✅ Profile fetched successfully');
    return { profile, error: null };
  } catch (err: any) {
    const msg = err?.message || err?.toString() || 'unknown';
    console.error('💥 Get profile catch error:', msg);
    return { profile: null, error: err as AuthError };
  }
}

export async function updateProfile(updates: Partial<Profile>) {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      throw new Error('No session found');
    }

    console.log('📝 Updating profile for user:', session.user.id, updates);
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Profile update error:', error);
      throw error;
    }
    
    console.log('✅ Profile updated successfully');
    return { data, error: null };
  } catch (error) {
    console.error('💥 Update profile catch error:', error);
    return { data: null, error: error as AuthError };
  }
}

// Session management utilities
export async function refreshSession() {
  try {
    console.log('🔄 Refreshing session');
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('❌ Session refresh error:', error);
      throw error;
    }
    
    console.log('✅ Session refreshed successfully');
    return { data, error: null };
  } catch (error) {
    console.error('💥 Session refresh catch error:', error);
    return { data: null, error: error as AuthError };
  }
}

export async function checkSessionValidity() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Session check error:', error);
      return false;
    }
    
    if (!session) {
      console.log('ℹ️ No active session');
      return false;
    }
    
    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at || 0;
    
    if (now >= expiresAt) {
      console.log('⏰ Session expired');
      return false;
    }
    
    console.log('✅ Session is valid');
    return true;
  } catch (error) {
    console.error('💥 Session validity check error:', error);
    return false;
  }
}
