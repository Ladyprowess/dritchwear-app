export function getFriendlyAuthError(error: unknown, mode: 'login' | 'register'): string {
  const raw = String((error as any)?.message || error || '').toLowerCase();

  if (raw.includes('invalid login credentials') || raw.includes('invalid password')) {
    return 'The email or password is incorrect. Check your details and try again.';
  }
  if (raw.includes('email not confirmed')) {
    return 'Confirm your email address before signing in.';
  }
  if (raw.includes('user already registered') || raw.includes('already been registered')) {
    return 'An account already exists with this email. Sign in or reset your password.';
  }
  if (raw.includes('password') && raw.includes('characters')) {
    return 'Your password does not meet the minimum length requirement.';
  }
  if (raw.includes('rate limit') || raw.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (raw.includes('network') || raw.includes('fetch')) {
    return 'We could not reach the server. Check your connection and try again.';
  }

  return mode === 'login'
    ? 'We could not sign you in. Check your details and try again.'
    : 'We could not create your account. Review your details and try again.';
}
