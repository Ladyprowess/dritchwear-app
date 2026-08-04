import PostHog from 'posthog-react-native'
import Constants from 'expo-constants'

const apiKey = Constants.expoConfig?.extra?.posthogProjectToken as string | undefined
const host = (Constants.expoConfig?.extra?.posthogHost as string) || 'https://eu.i.posthog.com'
const isPostHogConfigured = !!apiKey && apiKey !== 'phc_your_project_token_here'

export const posthog = new PostHog(apiKey || 'placeholder_key', {
  host,
  disabled: !isPostHogConfigured,
  captureAppLifecycleEvents: true,
  flushAt: 20,
  flushInterval: 10000,
  maxBatchSize: 100,
  maxQueueSize: 1000,
  preloadFeatureFlags: true,
  sendFeatureFlagEvent: true,
  featureFlagsRequestTimeoutMs: 10000,
  requestTimeout: 10000,
  fetchRetryCount: 3,
  fetchRetryDelay: 3000,
  // Session Replay (native iOS/Android only - requires a dev-client or
  // production build; does NOT work in Expo Go). Also enable recordings in
  // PostHog project settings: Settings → Session Replay → "Record user sessions".
  enableSessionReplay: isPostHogConfigured,
  sessionReplayConfig: {
    // Privacy: mask sensitive inputs (emails, card numbers, passwords, amounts).
    maskAllTextInputs: true,
    maskAllImages: false,
    captureLog: true,
    captureNetworkTelemetry: true,
    // Snapshot throttle (ms). Lower = smoother replay, higher perf cost.
    throttleDelayMs: 1000,
  },
})

// Debug logging is a runtime method in the v4 SDK (not a constructor option).
if (__DEV__ && isPostHogConfigured) {
  posthog.debug(true)
}
