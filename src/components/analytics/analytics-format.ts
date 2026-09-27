// Formatting and query helpers shared by the analytics cards, kept apart from
// the components so that editing a card keeps fast refresh working.

export type UtcRange = { from?: string; to?: string };

export const formatChange = (change: number) =>
  `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`;

export const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

// Appends from/to query params to a base endpoint for range-aware cards.
export const withRange = (endpoint: string, range: UtcRange): string => {
  if (!range.from || !range.to) return endpoint;
  const sep = endpoint.includes("?") ? "&" : "?";
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString();
  return `${endpoint}${sep}${qs}`;
};
