// Native / default implementation.
//
// On iOS/Android, session replay is handled by posthog-react-native via
// `enableSessionReplay` in lib/posthog.ts, so these are intentional no-ops.
// The web build resolves lib/sessionReplay.web.ts instead (posthog-js).

export function initSessionReplay(): void {}
export function identifySessionReplay(_id: string): void {}
export function resetSessionReplay(): void {}
