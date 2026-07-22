const dayMs = 86_400_000;

export type QuoteEmailExpiry = {
  dateText: string;
  statusText: string;
};

export function formatQuoteEmailExpiry(
  value: string | Date | null | undefined,
  now = new Date(),
): QuoteEmailExpiry | null {
  if (!value) return null;

  const expiry = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;

  const remainingMs = expiry.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(remainingMs / dayMs));
  const statusText = remainingMs < 0
    ? "Expired"
    : days === 0
      ? "Expires today"
      : days === 1
        ? "Expires tomorrow"
        : `${days} days remaining`;

  return {
    dateText: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(expiry),
    statusText,
  };
}

export function createPreviewExpiry(now = new Date()) {
  return new Date(now.getTime() + 7 * dayMs);
}
