import { createHmac, timingSafeEqual } from "node:crypto";

export function createQuotePortalToken(shop: string, quoteId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const payload = `${shop}:${quoteId}:${expiresAt}`;
  const signature = createHmac("sha256", quotePortalSecret())
    .update(payload)
    .digest("base64url");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyQuotePortalToken(token: string, shop: string, quoteId: string) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    const signature = parts.pop() ?? "";
    const expiresAt = Number(parts.pop());
    const tokenQuoteId = parts.pop() ?? "";
    const tokenShop = parts.join(":");
    if (tokenShop !== shop || tokenQuoteId !== quoteId || expiresAt < Date.now() / 1000) {
      return false;
    }
    const expected = createHmac("sha256", quotePortalSecret())
      .update(`${tokenShop}:${tokenQuoteId}:${expiresAt}`)
      .digest();
    const provided = Buffer.from(signature, "base64url");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

function quotePortalSecret() {
  const secret = process.env.QUOTE_PORTAL_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") {
    return "sp-rfq-development-only-portal-secret";
  }
  if (!secret) throw new Error("QUOTE_PORTAL_SECRET is not configured.");
  return secret;
}
