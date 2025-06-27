import { supabase } from './supabase';
import { AuthError } from '@supabase/supabase-js';

export interface AuthCredentials {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  wallet_balance: number;
  role: 'customer' | 'admin';
}

export async function signUp({ email, password, fullName, phone }: AuthCredentials) {
  try {
    console.log('Signing up user:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });

    if (error) {
      console.error('Sign up error:', error);
      throw error;
    }
    
    console.log('Sign up successful:', data);
    return { data, error: null };
  } catch (error) {
    console.error('Sign up catch error:', error);
    return { data: null, error: error as AuthError };
  }
}

export async function signIn({ email, password }: AuthCredentials) {
  try {
    console.log('Signing in user:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }
    
    console.log('Sign in successful:', data);
    return { data, error: null };
  } catch (error) {
    console.error('Sign in catch error:', error);
    return { data: null, error: error as AuthError };
  }
}

export async function signOut() {
  try {
    console.log('Signing out user');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
    console.log('Sign out successful');
    return { error: null };
  } catch (error) {
    console.error('Sign out catch error:', error);
    return { error: error as AuthError };
  }
}

export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as AuthError };
  }
}

export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as AuthError };
  }
}

export async function confirmPasswordReset(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as AuthError };
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Get user error:', error);
      throw error;
    }
    console.log('Current user:', user?.email);
    return { user, error: null };
  } catch (error) {
    console.error('Get user catch error:', error);
    return { user: null, error: error as AuthError };
  }
}

export async function getProfile(): Promise<{ profile: Profile | null; error: AuthError | null }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      console.error('No session found for profile:', sessionError);
      return { profile: null, error: sessionError };
    }

    console.log('Fetching profile for user:', session.user.id);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      throw error;
    }
    
    console.log('Profile fetched:', profile);
    return { profile, error: null };
  } catch (error) {
    console.error('Get profile catch error:', error);
    return { profile: null, error: error as AuthError };
  }
}

export async function updateProfile(updates: Partial<Profile>) {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      throw new Error('No session found');
    }

    console.log('Updating profile for user:', session.user.id, updates);
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      throw error;
    }
    
    console.log('Profile updated:', data);
    return { data, error: null };
  } catch (error) {
    console.error('Update profile catch error:', error);
    return { data: null, error: error as AuthError };
  }
}