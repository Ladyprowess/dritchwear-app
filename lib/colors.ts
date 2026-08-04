// Maps common apparel colour names to swatch hex values. Shared by the shop
// grid and the look-detail page so swatches look identical everywhere.
export const COLOR_HEX: Record<string, string> = {
  black: '#1A1A1A', white: '#FFFFFF', navy: '#1F2A44', blue: '#2563EB',
  grey: '#9CA3AF', gray: '#9CA3AF', charcoal: '#36393F', beige: '#D8C3A5',
  cream: '#F5EFE0', brown: '#6B4A2B', khaki: '#C3B091', olive: '#556B2F',
  green: '#2E7D32', red: '#C92A2A', maroon: '#7B1E3B', burgundy: '#7B1E3B',
  wine: '#722F37', purple: '#5A2D82', pink: '#EC4899', yellow: '#FDB813',
  gold: '#FDB813', orange: '#EA580C', teal: '#0D9488', tan: '#D2B48C',
};

export const colorToHex = (name: string): string =>
  COLOR_HEX[name?.trim().toLowerCase()] ?? '#C4C4C4';
