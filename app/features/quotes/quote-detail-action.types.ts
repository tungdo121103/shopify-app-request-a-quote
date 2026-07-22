import type { AdminGraphqlClient } from "~/features/storefront/storefront.types";

export type QuoteDetailActionContext = {
  admin: AdminGraphqlClient;
  formData: FormData;
  quoteId: string;
  request: Request;
  sessionId: string;
  shop: string;
};

export type QuoteDetailActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  chatMessage?: unknown;
  draftOrderAdminUrl?: string | null;
};

export type QuoteDetailActionHandler = (
  context: QuoteDetailActionContext,
) => Promise<QuoteDetailActionResult | Response>;
