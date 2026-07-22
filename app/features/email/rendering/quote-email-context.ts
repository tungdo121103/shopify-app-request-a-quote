type NumberValue = number | string | { toNumber(): number };

export type QuoteEmailSource = {
  id: string;
  quoteNumber: string;
  customerName?: string | null;
  customerEmail?: string | null;
  quoteTotal: NumberValue;
  originalTotal: NumberValue;
  currency: string;
  status: string;
  note?: string | null;
  expiresAt?: string | Date | null;
  orderInvoiceUrl?: string | null;
  orderName?: string | null;
  items: Array<{
    title: string;
    quantity: number;
    quotePrice: NumberValue;
    unitPrice: NumberValue;
    imageUrl?: string | null;
    sku?: string | null;
    variantTitle?: string | null;
  }>;
};

const toNumber = (value: NumberValue) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number(value.toNumber());
};

export function quoteToEmailContext(quote: QuoteEmailSource) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName || "Customer",
    customerEmail: quote.customerEmail ?? null,
    quoteTotal: toNumber(quote.quoteTotal),
    originalTotal: toNumber(quote.originalTotal),
    currency: quote.currency,
    status: String(quote.status),
    note: quote.note ?? null,
    expiresAt: quote.expiresAt ? String(quote.expiresAt) : null,
    orderInvoiceUrl: quote.orderInvoiceUrl ?? null,
    orderName: quote.orderName ?? null,
    items: quote.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      quotePrice: toNumber(item.quotePrice),
      unitPrice: toNumber(item.unitPrice),
      imageUrl: item.imageUrl ?? undefined,
      sku: item.sku ?? undefined,
      variantTitle: item.variantTitle ?? undefined,
    })),
  };
}
