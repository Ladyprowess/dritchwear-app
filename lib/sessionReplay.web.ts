// Web (PWA) session replay via posthog-js.
//
// This posthog-js instance exists ONLY to record browser sessions. All event
// capture on web already goes through posthog-react-native (see lib/posthog.ts
// + lib/analytics.web.ts), so autocapture / pageviews / performance are turned
// OFF here to avoid double-counting events in PostHog project 216610.
//
// NOTE: Recordings only persist if "Record user sessions" is enabled in the
// PostHog project settings - the SDK cannot force that server-side toggle.
import posthog from 'posthog-js'
import Constants from 'expo-constants'

const apiKey = Constants.expoConfig?.extra?.posthogProjectToken as string | undefined
const host = (Constants.expoConfig?.extra?.posthogHost as string) || 'https://eu.i.posthog.com'
const isConfigured = !!apiKey && apiKey !== 'phc_your_project_token_here'

let started = false

export function initSessionReplay(): void {
  if (started || !isConfigured || typeof window === 'undefined') return
  started = true

  posthog.init(apiKey as string, {
    api_host: host,
    // Recorder-only: everything else is owned by posthog-react-native.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    disable_session_recording: false,
    // Don't create anonymous person profiles for pre-login visitors.
    person_profiles: 'identified_only',
    // Mask sensitive inputs in recordings (emails, card numbers, amounts).
    session_recording: {
      maskAllInputs: true,
    },
    loaded: (ph) => {
      if (__DEV__) ph.debug(true)
    },
  })
}

// Link the recording to the same PostHog person as the RN event pipeline.
// Person properties are set by posthog-react-native; we only need the id here.
export function identifySessionReplay(id: string): void {
  if (!started) return
  try {
    posthog.identify(id)
  } catch {}
}

export function resetSessionReplay(): void {
  if (!started) return
  try {
    posthog.reset()
  } catch {}
}
