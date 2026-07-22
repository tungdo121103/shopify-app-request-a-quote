import prisma from "~/db.server";
import { isValidEmail } from "~/lib/contact-validation";
import type { QuoteEmailBranding, ShopifyEmailIdentity } from "~/models/quote-email.types";

export const defaultEmailBranding: QuoteEmailBranding = {
  senderName: "",
  logoUrl: "",
  primaryColor: "#152f7c",
  linkColor: "#1769aa",
  signature: "Customer service team",
  replyToEmail: "",
  footerText: "",
  theme: "clean",
};

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? value : fallback;
}

function safeHttpUrl(value: string) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? url.slice(0, 1000)
      : "";
  } catch {
    return "";
  }
}

export async function getEmailBranding(shop: string): Promise<QuoteEmailBranding> {
  const row = await prisma.quoteEmailBranding.findUnique({ where: { shop } });
  const branding = { ...defaultEmailBranding, ...(row ?? {}) };
  return { ...branding, theme: branding.theme === "branded" ? "branded" : "clean" };
}

const storefrontIdentityCache = new Map<
  string,
  { expiresAt: number; value: ShopifyEmailIdentity }
>();

/**
 * Brand settings are public storefront data. Some shops don't configure Brand,
 * so every field is optional and failures deliberately fall through to stored
 * email branding.
 */
export async function getShopifyStorefrontIdentity(
  shop: string,
): Promise<ShopifyEmailIdentity> {
  const cached = storefrontIdentityCache.get(shop);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const fallback: ShopifyEmailIdentity = { shopName: "", brandLogoUrl: "" };
  try {
    const response = await fetch(`https://${shop}/api/2025-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query EmailStorefrontBrand {
          shop {
            name
            brand {
              logo { image { url } }
              squareLogo { image { url } }
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Storefront API returned ${response.status}`);
    const result = await response.json() as {
      data?: {
        shop?: {
          name?: string | null;
          brand?: {
            logo?: { image?: { url?: string | null } | null } | null;
            squareLogo?: { image?: { url?: string | null } | null } | null;
          } | null;
        };
      };
      errors?: unknown[];
    };
    const value = {
      shopName: String(result.data?.shop?.name ?? "").trim(),
      brandLogoUrl: safeHttpUrl(
        String(
          result.data?.shop?.brand?.logo?.image?.url ??
            result.data?.shop?.brand?.squareLogo?.image?.url ??
            "",
        ),
      ),
    };
    storefrontIdentityCache.set(shop, {
      value,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return value;
  } catch (error) {
    console.warn("Unable to read Shopify Storefront brand identity", { shop, error });
    storefrontIdentityCache.set(shop, {
      value: fallback,
      expiresAt: Date.now() + 60 * 1000,
    });
    return fallback;
  }
}

export async function getResolvedEmailBranding(
  shop: string,
  identityOverride?: Partial<ShopifyEmailIdentity>,
): Promise<QuoteEmailBranding> {
  const [stored, storefrontIdentity] = await Promise.all([
    getEmailBranding(shop),
    getShopifyStorefrontIdentity(shop),
  ]);
  const identity = { ...storefrontIdentity, ...identityOverride };
  return {
    ...stored,
    senderName:
      String(identity.shopName ?? "").trim() ||
      stored.senderName ||
      shop.replace(/\.myshopify\.com$/i, "").replace(/[-_]+/g, " "),
    // Shopify Brand is authoritative. The saved logo is a merchant fallback.
    logoUrl: safeHttpUrl(identity.brandLogoUrl ?? "") || stored.logoUrl,
  };
}

export async function updateEmailBranding(shop: string, input: QuoteEmailBranding) {
  const branding = {
    senderName: String(input.senderName ?? "").trim().slice(0, 120),
    logoUrl: safeHttpUrl(input.logoUrl),
    primaryColor: safeColor(input.primaryColor, defaultEmailBranding.primaryColor),
    linkColor: safeColor(input.linkColor, defaultEmailBranding.linkColor),
    signature: String(input.signature ?? "").trim().slice(0, 200),
    replyToEmail: isValidEmail(input.replyToEmail) ? input.replyToEmail.trim() : "",
    footerText: String(input.footerText ?? "").trim().slice(0, 500),
    theme: input.theme === "branded" ? "branded" : "clean",
  };
  await prisma.quoteEmailBranding.upsert({
    where: { shop },
    create: { id: `quote-email-branding-${shop}`, shop, ...branding },
    update: branding,
  });
  return branding;
}

