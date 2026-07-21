import { getQuoteStatusLabel } from "~/lib/quote-status";
import type { QuoteListData } from "~/models/quote-list.server";

export type QuoteListItem = QuoteListData["quotes"][number];

export const formatQuoteMoney = (
  value: string | number,
  currency: string,
) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

export const formatQuoteDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

const escapeCsvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function downloadQuotesCsv(quotes: QuoteListItem[]) {
  if (quotes.length === 0 || typeof window === "undefined") return;

  const rows = [
    ["Quote ID", "Customer", "Created time", "Expired time", "Status", "Quote value"],
    ...quotes.map((quote) => [
      quote.quoteNumber,
      quote.customerEmail ?? quote.customerName ?? "Guest customer",
      formatQuoteDateTime(quote.createdAt),
      quote.status === "OFFERED_BY_MERCHANT" && quote.expiresAt
        ? formatQuoteDateTime(quote.expiresAt)
        : "-",
      getQuoteStatusLabel(quote.status),
      formatQuoteMoney(quote.quoteTotal.toString(), quote.currency),
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\r\n");
  const url = window.URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `quotes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
