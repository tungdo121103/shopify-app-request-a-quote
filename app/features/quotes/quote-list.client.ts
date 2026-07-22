import { getQuoteStatusLabel } from "~/lib/quote-status";
import {
  formatQuoteDateTime,
  formatQuoteMoney,
  type QuoteListItem,
} from "~/features/quotes/quote-list";

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
