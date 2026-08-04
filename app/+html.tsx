import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Customises the HTML document for the web build.
 * Critical for PWA behaviour - especially iOS "Add to Home Screen" icon.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* ── Favicon ── */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />

        {/* ── PWA: Apple / iOS ── */}
        {/* This tells iOS to use the real app icon instead of a letter */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-startup-image" href="/splash.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Dritchwear" />

        {/* ── PWA: Manifest ── */}
        <link rel="manifest" href="/manifest.json" />

        {/* ── PWA: General ── */}
        <meta name="theme-color" content="#5A2D82" />
        <meta name="description" content="Shop premium custom clothing from Dritchwear Collections." />

        {/* ── React Native Web recommended style reset ── */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
