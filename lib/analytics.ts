// Safe shared fallback for TypeScript and non-native environments. Runtime
// platform implementations remain in analytics.web.ts / analytics.native.ts.
import { posthog } from './posthog'

export function logEvent(name: string, params?: Record<string, any>) {
  try {
    posthog.capture(name, params)
  } catch {}
}
