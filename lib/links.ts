const DEFAULT_PUBLIC_ORIGIN = 'https://app.dritchwear.com';

export function buildPublicUrl(
  pathname: string,
  queryParams?: Record<string, string | null | undefined>
) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const baseOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : DEFAULT_PUBLIC_ORIGIN;

  const url = new URL(normalizedPath, baseOrigin);

  Object.entries(queryParams ?? {}).forEach(([key, value]) => {
    if (!value) return;
    url.searchParams.set(key, value);
  });

  return url.toString();
}

export function buildCanonicalPublicUrl(
  pathname: string,
  queryParams?: Record<string, string | null | undefined>
) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const url = new URL(normalizedPath, DEFAULT_PUBLIC_ORIGIN);

  Object.entries(queryParams ?? {}).forEach(([key, value]) => {
    if (!value) return;
    url.searchParams.set(key, value);
  });

  return url.toString();
}
