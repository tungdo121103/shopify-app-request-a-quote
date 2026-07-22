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
