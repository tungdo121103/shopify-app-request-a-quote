import prisma from "~/db.server";
import type {
  QuoteSettings,
  QuoteSettingsInput,
  WidgetSettingsInput,
} from "~/models/quote-setting.types";
import {
  normalizeWidgetSettings,
  widgetSettingsFromForm,
} from "~/features/widget/widget-settings";

type QuoteSettingsRow = {
  id: string;
  shop: string;
  requesterScope: string;
  allowCustomersNoPurchase: number | boolean;
  allowRepeatCustomers: number | boolean;
  allowAbandonedCheckout: number | boolean;
  allowEmailSubscribers: number | boolean;
  allowPurchasedCustomers: number | boolean;
  selectedCustomerQuery: string | null;
  emailPatterns: string | null;
  productEligibility: string;
  selectedProductResources: string | null;
  allowedProductResources: string | null;
  excludedProductResources: string | null;
  quoteExpiresAfterDays: number;
  reminderBeforeExpireDays: number;
  widgetStyle: string | null;
  widgetButtonText: string | null;
  widgetSize: string | null;
  widgetOrientation: string | null;
  widgetDesktopPosition: string | null;
  widgetMobilePosition: string | null;
  widgetDisplayMode: string | null;
  widgetSpecificPages: string | null;
  widgetBackgroundColor: string | null;
  widgetTextColor: string | null;
  widgetAnimation: string | null;
  widgetIconDataUrl: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

const defaultSettings: QuoteSettingsInput = {
  requesterScope: "SELECTED",
  allowCustomersNoPurchase: true,
  allowRepeatCustomers: false,
  allowAbandonedCheckout: false,
  allowEmailSubscribers: false,
  allowPurchasedCustomers: false,
  selectedCustomerQuery: "",
  emailPatterns: "",
  productEligibility: "ALL",
  selectedProductResources: "",
  allowedProductResources: "",
  excludedProductResources: "",
  quoteExpiresAfterDays: 7,
  reminderBeforeExpireDays: 3,
};

export { defaultWidgetSettings } from "~/features/widget/widget-settings";

const legacyEmailPatternsPlaceholder = "@company.com, *@wholesale.com";

function toBoolean(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function normalizeStoredEmailPatterns(value: string | null | undefined) {
  const patterns = value?.trim() ?? "";
  return patterns === legacyEmailPatternsPlaceholder ? "" : patterns;
}

function fromRow(row: QuoteSettingsRow): QuoteSettings {
  const widgetSettings = normalizeWidgetSettings(row);
  return {
    id: row.id,
    shop: row.shop,
    requesterScope: row.requesterScope,
    allowCustomersNoPurchase: toBoolean(row.allowCustomersNoPurchase),
    allowRepeatCustomers: toBoolean(row.allowRepeatCustomers),
    allowAbandonedCheckout: toBoolean(row.allowAbandonedCheckout),
    allowEmailSubscribers: toBoolean(row.allowEmailSubscribers),
    allowPurchasedCustomers: toBoolean(row.allowPurchasedCustomers),
    selectedCustomerQuery: row.selectedCustomerQuery ?? "",
    emailPatterns: normalizeStoredEmailPatterns(row.emailPatterns),
    productEligibility: row.productEligibility,
    selectedProductResources: row.selectedProductResources ?? "",
    allowedProductResources:
      row.allowedProductResources ?? row.selectedProductResources ?? "",
    excludedProductResources: row.excludedProductResources ?? "",
    quoteExpiresAfterDays: Number(row.quoteExpiresAfterDays || 7),
    reminderBeforeExpireDays: Number(row.reminderBeforeExpireDays || 3),
    ...widgetSettings,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

async function findSettingsRow(shop: string) {
  return prisma.quoteSetting.findUnique({ where: { shop } });
}

export async function getQuoteSettings(shop: string) {
  const existing = await findSettingsRow(shop);
  if (existing) return fromRow(existing);

  await updateQuoteSettings(shop, defaultSettings);
  const created = await findSettingsRow(shop);
  if (!created) throw new Error("Could not create quote settings.");

  return fromRow(created);
}

export async function updateQuoteSettings(
  shop: string,
  input: QuoteSettingsInput,
) {
  await prisma.quoteSetting.upsert({
    where: { shop },
    create: { id: `quote-setting-${shop}`, shop, ...input },
    update: input,
  });

  const row = await findSettingsRow(shop);
  if (!row) throw new Error("Could not save quote settings.");

  return fromRow(row);
}

export function normalizeSettingsForm(formData: FormData): QuoteSettingsInput {
  const numberFromForm = (key: string, fallback: number) => {
    const value = Number(formData.get(key));
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
  };

  return {
    requesterScope: String(formData.get("requesterScope") ?? "SELECTED"),
    allowCustomersNoPurchase: formData.get("allowCustomersNoPurchase") === "on",
    allowRepeatCustomers: formData.get("allowRepeatCustomers") === "on",
    allowAbandonedCheckout: formData.get("allowAbandonedCheckout") === "on",
    allowEmailSubscribers: formData.get("allowEmailSubscribers") === "on",
    allowPurchasedCustomers: formData.get("allowPurchasedCustomers") === "on",
    selectedCustomerQuery: sanitizeSelectedCustomers(
      String(formData.get("selectedCustomerQuery") ?? ""),
    ),
    emailPatterns: normalizeEmailPatterns(
      String(formData.get("emailPatterns") ?? ""),
    ),
    productEligibility: normalizeProductEligibility(
      String(formData.get("productEligibility") ?? "ALL"),
    ),
    selectedProductResources: sanitizeSelectedProductResources(
      String(formData.get("selectedProductResources") ?? ""),
    ),
    allowedProductResources: sanitizeSelectedProductResources(
      String(formData.get("allowedProductResources") ?? ""),
    ),
    excludedProductResources: sanitizeSelectedProductResources(
      String(formData.get("excludedProductResources") ?? ""),
    ),
    quoteExpiresAfterDays: numberFromForm("quoteExpiresAfterDays", 7),
    reminderBeforeExpireDays: numberFromForm("reminderBeforeExpireDays", 3),
  };
}

export async function updateWidgetSettings(
  shop: string,
  input: WidgetSettingsInput,
) {
  await getQuoteSettings(shop);

  await prisma.quoteSetting.update({ where: { shop }, data: input });

  return getQuoteSettings(shop);
}

export function normalizeWidgetSettingsForm(
  formData: FormData,
): WidgetSettingsInput {
  return widgetSettingsFromForm(formData);
}

function normalizeProductEligibility(value: string) {
  return ["ALL", "SELECTED", "EXCLUDED"].includes(value) ? value : "ALL";
}

function sanitizeSelectedProductResources(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return "";

    const resources = parsed
      .map((resource) => {
        if (!resource || typeof resource !== "object") return null;
        const record = resource as Record<string, unknown>;
        const id = String(record.id ?? "").trim();
        const type = String(record.type ?? "").trim().toUpperCase();
        if (!id || (type !== "PRODUCT" && type !== "COLLECTION")) return null;

        return {
          id: id.slice(0, 180),
          type,
          title: String(record.title ?? "").trim().slice(0, 180),
          imageUrl: String(record.imageUrl ?? "").trim().slice(0, 500),
        };
      })
      .filter(Boolean)
      .slice(0, 250);

    return resources.length ? JSON.stringify(resources) : "";
  } catch {
    return "";
  }
}

function sanitizeSelectedCustomers(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return "";

    const customers = parsed
      .map((customer) => {
        if (!customer || typeof customer !== "object") return null;
        const record = customer as Record<string, unknown>;
        const id = String(record.id ?? "").trim();
        if (!id) return null;

        return {
          id: id.slice(0, 160),
          name: String(record.name ?? "").trim().slice(0, 120),
          email: String(record.email ?? "").trim().toLowerCase().slice(0, 180),
          phone: String(record.phone ?? "").trim().slice(0, 40),
        };
      })
      .filter(Boolean)
      .slice(0, 100);

    return customers.length ? JSON.stringify(customers) : "";
  } catch {
    return "";
  }
}

function normalizeEmailPatterns(value: string) {
  const seen = new Set<string>();
  const patterns = value
    .split(/[\n,;]+/)
    .map((pattern) => pattern.trim().toLowerCase())
    .filter((pattern) => {
      if (!pattern || seen.has(pattern)) return false;
      if (/\s/.test(pattern)) return false;
      if (!pattern.includes("@")) return false;
      seen.add(pattern);
      return true;
    })
    .slice(0, 100);

  return patterns.join(", ");
}
