import type { getQuote } from "~/models/quote.server";

export type StorefrontQuote = Exclude<
  Awaited<ReturnType<typeof getQuote>>,
  null
>;

export type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type QuoteAttachmentInput = {
  fileName: string;
  fileUrl: string;
  mimeType?: string;
};
