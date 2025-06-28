import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, getCurrentUser, getProfile } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
  isInitialized: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshProfile = async () => {
    if (user) {
      try {
        console.log('🔄 Refreshing profile for user:', user.email);
        const { profile } = await getProfile();
        setProfile(profile);
        console.log('✅ Profile refreshed successfully');
      } catch (error) {
        console.error('❌ Error refreshing profile:', error);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    // Initialize authentication with retry logic
    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing authentication...');
        
        // Get initial session with retry logic
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          
          // Retry logic for network issues
          if (retryCount < maxRetries && error.message.includes('network')) {
            retryCount++;
            console.log(`🔄 Retrying session fetch (${retryCount}/${maxRetries})...`);
            setTimeout(initializeAuth, 1000 * retryCount); // Exponential backoff
            return;
          }
          
          if (mounted) {
            setLoading(false);
            setIsInitialized(true);
          }
          return;
        }

        if (session?.user && mounted) {
          console.log('✅ Session found for user:', session.user.email);
          setUser(session.user);
          
          try {
            console.log('📋 Loading user profile...');
            const { profile } = await getProfile();
            if (mounted) {
              setProfile(profile);
              console.log('✅ Profile loaded successfully');
            }
          } catch (profileError) {
            console.error('❌ Error loading profile:', profileError);
            // Don't fail the entire auth flow if profile loading fails
            // User can still be authenticated without profile data
          }
        } else {
          console.log('ℹ️ No active session found');
        }
        
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes with enhanced logging
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state changed:', event, session?.user?.email || 'No user');
      
      if (!mounted) return;

      try {
        switch (event) {
          case 'SIGNED_OUT':
            console.log('👋 User signed out');
            setUser(null);
            setProfile(null);
            break;
            
          case 'SIGNED_IN':
            if (session?.user) {
              console.log('👋 User signed in:', session.user.email);
              setUser(session.user);
              
              try {
                const { profile } = await getProfile();
                setProfile(profile);
                console.log('✅ Profile loaded after sign in');
              } catch (error) {
                console.error('❌ Error loading profile after sign in:', error);
              }
            }
            break;
            
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              console.log('🔄 Token refreshed for user:', session.user.email);
              setUser(session.user);
              // Don't reload profile on token refresh unless it's missing
              if (!profile) {
                try {
                  const { profile: newProfile } = await getProfile();
                  setProfile(newProfile);
                } catch (error) {
                  console.error('❌ Error loading profile after token refresh:', error);
                }
              }
            }
            break;
            
          case 'PASSWORD_RECOVERY':
            console.log('🔑 Password recovery initiated');
            break;
            
          default:
            console.log('ℹ️ Unhandled auth event:', event);
        }
      } catch (error) {
        console.error('❌ Error handling auth state change:', error);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Check if user is admin based on email and profile role
  const adminEmails = [
    'dritchwear@gmail.com',
    'admin@dritchwear.com',
    'support@dritchwear.com',
    'info@dritchwear.com'
  ];
  
  const isAdmin = profile?.role === 'admin' && user?.email && adminEmails.includes(user.email);

  // Enhanced logging for debugging
  useEffect(() => {
    if (isInitialized) {
      console.log('📊 Auth State Summary:', {
        hasUser: !!user,
        userEmail: user?.email,
        hasProfile: !!profile,
        profileRole: profile?.role,
        preferredCurrency: profile?.preferred_currency,
        isAdmin,
        loading
      });
    }
  }, [user, profile, isAdmin, loading, isInitialized]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        refreshProfile,
        isInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};