// Native implementation - forwards events to PostHog.
import { posthog } from './posthog'

export function logEvent(name: string, params?: Record<string, any>) {
  try {
    posthog.capture(name, params)
  } catch {}
}
