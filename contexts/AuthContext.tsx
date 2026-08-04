// 📁 contexts/AuthContext.tsx

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Profile, getProfile } from '@/lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { posthog } from '@/lib/posthog';
import { identifySessionReplay, resetSessionReplay } from '@/lib/sessionReplay';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  hardSignOut: () => Promise<void>; // ✅ ADD
  isInitialized: boolean;
  profileLoaded: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
  hardSignOut: async () => {}, // ✅ ADD
  isInitialized: false,
  profileLoaded: false,
});

const LOGIN_TS_KEY = 'last_login_at';
const MAX_LOGIN_AGE_DAYS = 30;

const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

const setLastLoginNow = async () => {
  await AsyncStorage.setItem(LOGIN_TS_KEY, Date.now().toString());
};

const getLastLoginAt = async () => {
  const v = await AsyncStorage.getItem(LOGIN_TS_KEY);
  return v ? Number(v) : null;
};

const clearLastLoginAt = async () => {
  await AsyncStorage.removeItem(LOGIN_TS_KEY);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const profileRef            = useRef<Profile | null>(null);
  const isCheckingResume      = useRef(false);
  const profileLoading        = useRef(false); // guard against concurrent loads
  const pendingSignOutTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Track last user id so we can clean up even after user becomes null
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    lastUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const clearPendingSignOutTimer = () => {
    if (pendingSignOutTimer.current) {
      clearTimeout(pendingSignOutTimer.current);
      pendingSignOutTimer.current = null;
    }
  };

  const clearLocalAuthState = () => {
    clearPendingSignOutTimer();
    setUser(null);
    setProfile(null);
    setProfileLoaded(true);
    setLoading(false);
    setIsInitialized(true);
  };

  const refreshProfile = async () => {
    if (!user) return;

    try {
      console.log('🔄 Refreshing profile for user:', user.email);
      const { profile } = await getProfile();
      setProfile(profile);
      console.log('✅ Profile refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing profile:', error);
    }
  };

  // ✅ HARD SIGN OUT: always clears local state, always navigates app to "signed out" state
  const hardSignOut = async () => {
    const uid = lastUserIdRef.current || user?.id || null;

    console.log('🚪 hardSignOut: clearing local auth state', { uid });

    // 0) Set redirect flag so _layout routes to welcome after sign-out
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.sessionStorage.setItem('post_logout_redirect_to_welcome', '1');
      } else {
        await AsyncStorage.setItem('post_logout_redirect_to_welcome', '1');
      }
    } catch {}

    // 1) Clear local state FIRST (guarantees UI logs out)
    clearLocalAuthState();

    // 2) Clear login timestamp
    await clearLastLoginAt();

    try {
      posthog.capture('user_signed_out')
      posthog.reset()
      resetSessionReplay()
    } catch {}

    // 4) Try Supabase signOut (ignore "session missing")
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        const msg = String((error as any)?.message || '').toLowerCase();
        if (msg.includes('auth session missing')) {
          console.log('ℹ️ hardSignOut: no session - already signed out');
          return;
        }
        console.log('⚠️ hardSignOut: supabase signOut error:', error);
      }
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('auth session missing')) {
        console.log('ℹ️ hardSignOut catch: no session - already signed out');
        return;
      }
      console.log('⚠️ hardSignOut catch error:', e);
    }
  };

  // Keep returning sessions attached to the same PostHog person. Supabase's
  // immutable user ID prevents identity fragmentation if an email changes,
  // while person properties remain searchable in PostHog.
  useEffect(() => {
    if (!user?.id) return;
    // Only include properties that are actually defined - PostHog's identify
    // type rejects `undefined` values, and we don't want to overwrite existing
    // person properties with blanks.
    const set: Record<string, string> = {};
    const email = user.email ?? profile?.email;
    const name = profile?.full_name ?? user.user_metadata?.full_name;
    const role = profile?.role;
    if (email) set.email = email;
    if (name) set.name = name;
    if (role) set.role = role;
    posthog.identify(user.id, { $set: set });
    // Mirror to the web session-replay recorder so recordings attach to the
    // same person (no-op on native).
    identifySessionReplay(user.id);
  }, [user?.id, user?.email, user?.user_metadata?.full_name, profile?.email, profile?.full_name, profile?.role]);

  // ✅ On resume: auth check (native uses AppState, web uses visibilitychange)
  useEffect(() => {
    const handleResume = async (state?: string) => {
      // Native: only run on 'active'; web: visibilitychange fires without arg
      if (state !== undefined && state !== 'active') return;

      if (isCheckingResume.current) return;
      isCheckingResume.current = true;

      // Safety: always release the lock after 15s so a hung resume never blocks future wakeups
      const resumeLockTimer = setTimeout(() => {
        if (isCheckingResume.current) {
          console.log('⏱️ Resume lock timed out - releasing');
          isCheckingResume.current = false;
        }
      }, 15000);

      console.log('🔄 App resumed - checking auth state');

      try {
        // ✅ 1) Enforce 30-day rule on resume
        const last = await getLastLoginAt();
        if (last && Date.now() - last > daysToMs(MAX_LOGIN_AGE_DAYS)) {
          console.log('⏳ Login expired (30 days) - signing out');
          await hardSignOut();
          return;
        }

        // ✅ 2) Check session - wrap in its own try/catch so a network error
        //    on wakeup does NOT sign the user out.
        let sessionData: any = null;
        let sessionError: any = null;

        try {
          const result = await supabase.auth.getSession();
          sessionData = result.data;
          sessionError = result.error;
        } catch (networkErr: any) {
          // Phone just woke up - network may not be ready yet.
          // Log and bail out WITHOUT signing out; the auth listener will
          // fire TOKEN_REFRESHED / SIGNED_IN once the token is refreshed.
          console.log('⚠️ getSession network error on resume (ignoring):', networkErr?.message);
          return;
        }

        if (sessionError) {
          const msg = String(sessionError?.message || '').toLowerCase();
          // If it's clearly a network/timeout issue, don't sign the user out
          if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) {
            console.log('⚠️ getSession transient error on resume - skipping logout:', msg);
            return;
          }
          console.log('⚠️ getSession error on resume:', sessionError.message);
        }

        if (!sessionData?.session) {
          console.log('⚠️ No session on resume - will wait for auth listener');
          // Do NOT clear user/profile here. Supabase can return null briefly on resume.
          // If the user is truly signed out, onAuthStateChange('SIGNED_OUT') will fire.
          setProfileLoaded(true);
          setLoading(false);
          setIsInitialized(true);
          return;
        }

        // ✅ Session exists
        console.log('✅ Session exists on resume for:', sessionData.session.user.email);
        setUser(sessionData.session.user);
        await setLastLoginNow();

        // Silently refresh profile in the background - do NOT touch profileLoaded/loading
        // so the UI never shows a loading spinner when the phone wakes from idle.
        // The user already has profile data; we just keep it fresh.
        try {
          const profileResult = await Promise.race([
            getProfile(),
            new Promise<{ profile: null; error: null }>((resolve) =>
              setTimeout(() => resolve({ profile: null, error: null }), 6000)
            ),
          ]);
          if (profileResult.profile) setProfile(profileResult.profile);
          // else keep existing profile - no state wipe
        } catch (err) {
          console.log('⚠️ Resume profile refresh failed (keeping existing profile):', err);
        }
      } catch (e: any) {
        // Top-level catch - only sign out if we're certain there's no session.
        // Network errors, timeouts, etc. should NOT trigger a sign-out.
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) {
          console.log('⚠️ Auth check on resume: transient error - NOT signing out:', msg);
          return;
        }
        console.log('⚠️ Auth check failed on resume (non-network):', e);
      } finally {
        clearTimeout(resumeLockTimer);
        isCheckingResume.current = false;
      }
    };

    if (Platform.OS === 'web') {
      // Web: use the Page Visibility API instead of AppState
      const onVisibility = () => {
        if (document.visibilityState === 'visible') handleResume();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        isCheckingResume.current = false;
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }

    // Native: use AppState
    const sub = AppState.addEventListener('change', handleResume);
    return () => {
      isCheckingResume.current = false;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Init auth once on app start
  useEffect(() => {
    let mounted = true;

    let retryCount = 0;
    const maxRetries = 3;
    let retryTimer: any = null;
    let failSafeTimer: any = null;

    // Never hold the storefront behind a slow token refresh. Persisted auth can
    // finish restoring in the background after this short startup budget.
    // Kept below the _layout boot-timeout overlay so the UI always unblocks
    // (and routes) before the "taking too long" message could ever show.
    const FAILSAFE_MS = Platform.OS === 'web' ? 1800 : 4000;

    failSafeTimer = setTimeout(() => {
      if (!mounted) return;
      console.log('⏱️ Failsafe triggered: unblocking UI (not clearing session)');
      profileLoading.current = false;
      // Don't wipe user/profile - just unblock the loading state so the UI
      // can render with whatever session data is already available.
      setProfileLoaded(true);
      setLoading(false);
      setIsInitialized(true);
    }, FAILSAFE_MS);

    const getSessionWithTimeout = async (ms = 1500) => {
      const res = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session restore timeout')), ms)
        ),
      ]);

      return res as Awaited<ReturnType<typeof supabase.auth.getSession>>;
    };

    const loadProfileForSessionUser = async (
      sessionUser: User,
      options?: { silent?: boolean; preserveExisting?: boolean }
    ) => {
      const silent = options?.silent ?? false;
      const preserveExisting = options?.preserveExisting ?? false;

      // Prevent concurrent loads (e.g. initializeAuth + INITIAL_SESSION firing together)
      if (profileLoading.current) return;
      profileLoading.current = true;

      if (!silent) {
        setProfileLoaded(false);
      }

      // On web, Chrome app banners can stall network requests. Cap profile fetch at 8s
      // so a hung getProfile() never keeps profileLoaded=false indefinitely.
      const PROFILE_TIMEOUT_MS = Platform.OS === 'web' ? 4000 : 8000;
      const profileWithTimeout = () =>
        Promise.race([
          getProfile(),
          new Promise<{ profile: null; error: Error }>((resolve) =>
            setTimeout(
              () => resolve({ profile: null, error: new Error('Profile fetch timeout') }),
              PROFILE_TIMEOUT_MS
            )
          ),
        ]);

      try {
        const { profile: dbProfile, error: profileErr } = await profileWithTimeout();

        if (dbProfile) {
          // Profile found - use it
          if (mounted) setProfile(dbProfile);
        } else if (!profileErr) {
          // PGRST116: profile row doesn't exist yet - create it
          await supabase.from('profiles').upsert({
            id: sessionUser.id,
            email: sessionUser.email,
            role: 'customer',
            preferred_currency: 'NGN',
            updated_at: new Date().toISOString(),
          });
          const { profile: created } = await getProfile();
          if (mounted) setProfile(created ?? null);
        } else {
          // Network or other transient error - preserve the current profile for the
          // same user so idle/resume never looks like a fake "demo" account.
          console.log('⚠️ Profile fetch failed (network?) - preserving current UI state:', profileErr?.message);
          if (mounted && !preserveExisting) setProfile(null);
        }
      } catch {
        if (mounted && !preserveExisting) setProfile(null);
      } finally {
        profileLoading.current = false;
        if (mounted && !silent) setProfileLoaded(true);
      }
    };

    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing authentication...');

        // ✅ Enforce 30-day rule on cold start
        const last = await getLastLoginAt();
        if (last && Date.now() - last > daysToMs(MAX_LOGIN_AGE_DAYS)) {
          console.log('⏳ Login expired (30 days) - signing out on boot');

          // Use hardSignOut so local state is always cleared
          await hardSignOut();
          return;
        }

        const { data: { session }, error } = await getSessionWithTimeout();

        if (error) {
          console.error('❌ Error getting session:', error);

          const msg = (error.message || '').toLowerCase();
          if (retryCount < maxRetries && (msg.includes('network') || msg.includes('timeout'))) {
            retryCount++;
            console.log(`🔄 Retrying session fetch (${retryCount}/${maxRetries})...`);

            retryTimer = setTimeout(() => {
              if (!mounted) return;
              initializeAuth();
            }, 1000 * retryCount);

            return;
          }

          // ✅ wipe broken persisted auth (use hardSignOut to avoid stuck UI)
          if (mounted) {
            await hardSignOut();
          }
          return;
        }

        if (session?.user && mounted) {
          console.log('✅ Session found for user:', session.user.email);
          setUser(session.user);
          setLoading(false);
          setIsInitialized(true);
          void setLastLoginNow();
          // Profile data enriches the already-visible UI; it is not a startup gate.
          void loadProfileForSessionUser(session.user);
        } else {
          console.log('ℹ️ No active session found');
          if (mounted) {
            setUser(null);
            setProfile(null);
            setProfileLoaded(true);
          }
        }

        if (mounted) {
          clearTimeout(failSafeTimer); // ✅ Cancel failsafe - auth completed successfully
          setLoading(false);
          setIsInitialized(true);
        }
      } catch (error) {
        const msg = String((error as any)?.message || '');
        if (msg.includes('Session restore timeout')) {
          console.log('⚠️ Initial session restore timed out; waiting for auth listener or failsafe');
          return;
        }

        console.error('❌ Error initializing auth:', error);

        // Do NOT force signOut here.
        // If it's a temporary error, signing out will log users out incorrectly.
        if (mounted) {
          setProfileLoaded(true);
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth state changed:', event, session?.user?.email || 'No user');

      if (!mounted) return;

      // Auth callbacks must return immediately. Awaiting Supabase calls here can
      // retain the client's auth lock and stall cold starts/token refreshes.
      setLoading(false);
      setIsInitialized(true);

      setTimeout(async () => {
      try {
        switch (event) {
          case 'INITIAL_SESSION':
          case 'SIGNED_OUT': {
            if (event === 'INITIAL_SESSION' && session?.user) {
              console.log('🪪 Initial session restored:', session.user.email);
              clearPendingSignOutTimer();
              setUser(session.user);
              await setLastLoginNow();
              await loadProfileForSessionUser(session.user);
              break;
            }

            // Double-check: on device wake, Supabase can fire SIGNED_OUT
            // transiently before the token refreshes. Verify with getSession().
            let truelySignedOut = true;
            try {
              const { data: { session: check } } = await supabase.auth.getSession();
              if (check) {
                // Session still valid - this was a spurious SIGNED_OUT event.
                console.log('⚠️ Spurious SIGNED_OUT - session still valid, ignoring');
                clearPendingSignOutTimer();
                setUser(check.user);
                if (!profileRef.current || lastUserIdRef.current === check.user.id) {
                  await loadProfileForSessionUser(check.user, { silent: true, preserveExisting: true });
                }
                truelySignedOut = false;
              }
            } catch (checkErr: any) {
              // Network not ready (device just woke) - do NOT sign out
              console.log('⚠️ SIGNED_OUT + getSession failed (network?) - ignoring:', checkErr?.message);
              truelySignedOut = false;
            }

            if (truelySignedOut) {
              // If we still have a user in state, wait briefly before clearing - a
              // TOKEN_REFRESHED event may fire right after SIGNED_OUT during token
              // rotation on device wake. If TOKEN_REFRESHED arrives within the window,
              // it will cancel this timer and the user stays logged in.
              if (lastUserIdRef.current) {
                console.log('⏳ Delaying sign-out to wait for possible TOKEN_REFRESHED...');
                pendingSignOutTimer.current = setTimeout(() => {
                  if (!mounted) return;
                  pendingSignOutTimer.current = null;
                  console.log('🚪 Delayed sign-out confirmed - clearing session');
                  setUser(null);
                  setProfile(null);
                  setProfileLoaded(true);
                  void clearLastLoginAt();
                }, 2500);
              } else {
                setUser(null);
                setProfile(null);
                setProfileLoaded(true);
                await clearLastLoginAt();
              }
            }
            break;
          }

          case 'SIGNED_IN':
            if (session?.user) {
              console.log('👋 User signed in:', session.user.email);
              clearPendingSignOutTimer();
              const isSameUser = lastUserIdRef.current === session.user.id;
              setUser(session.user);
              await setLastLoginNow();
              await loadProfileForSessionUser(session.user, {
                silent: isSameUser,
                preserveExisting: isSameUser,
              });
              console.log(isSameUser ? '✅ Session refreshed without blocking UI' : '✅ Profile loaded after sign in');
            }
            break;

          case 'TOKEN_REFRESHED':
            if (session?.user) {
              // Cancel any pending spurious sign-out that fired just before this refresh
              if (pendingSignOutTimer.current) {
                clearTimeout(pendingSignOutTimer.current);
                pendingSignOutTimer.current = null;
                console.log('🔄 TOKEN_REFRESHED cancelled pending sign-out');
              }
              setUser(session.user);
              await setLastLoginNow();

              await loadProfileForSessionUser(session.user, {
                silent: true,
                preserveExisting: true,
              });
            }
            break;

          case 'PASSWORD_RECOVERY':
            console.log('🔑 Password recovery initiated');
            break;

          default:
            console.log('ℹ️ Unhandled auth event:', event);
        }
      } catch (err) {
        console.error('❌ Error handling auth state change:', err);
      }

      }, 0);
    });

    return () => {
      mounted = false;
      clearTimeout(failSafeTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (pendingSignOutTimer.current) {
        clearTimeout(pendingSignOutTimer.current);
        pendingSignOutTimer.current = null;
      }
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin check
  const adminEmails = [
    'dritchwear@gmail.com',
    'admin@dritchwear.com',
    'support@dritchwear.com',
    'info@dritchwear.com',
  ];

  const isAdmin =
    profile?.role === 'admin' &&
    !!user?.email &&
    adminEmails.includes(user.email);

  useEffect(() => {
    if (isInitialized) {
      console.log('📊 Auth State Summary:', {
        hasUser: !!user,
        userEmail: user?.email,
        hasProfile: !!profile,
        profileRole: profile?.role,
        preferredCurrency: profile?.preferred_currency,
        isAdmin,
        loading,
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
        hardSignOut, // ✅ ADD
        isInitialized,
        profileLoaded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
