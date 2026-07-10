import prisma from "~/db.server";

export type QuoteSettingsInput = {
  requesterScope: string;
  allowCustomersNoPurchase: boolean;
  allowRepeatCustomers: boolean;
  allowAbandonedCheckout: boolean;
  allowEmailSubscribers: boolean;
  allowPurchasedCustomers: boolean;
  selectedCustomerQuery: string;
  emailPatterns: string;
  productEligibility: string;
  selectedProductResources: string;
  allowedProductResources: string;
  excludedProductResources: string;
  quoteExpiresAfterDays: number;
  reminderBeforeExpireDays: number;
};

export type WidgetSettingsInput = {
  widgetStyle: string;
  widgetButtonText: string;
  widgetSize: string;
  widgetOrientation: string;
  widgetDesktopPosition: string;
  widgetMobilePosition: string;
  widgetDisplayMode: string;
  widgetSpecificPages: string;
  widgetBackgroundColor: string;
  widgetTextColor: string;
  widgetAnimation: string;
  widgetIconDataUrl: string;
};

export type QuoteSettings = QuoteSettingsInput &
  WidgetSettingsInput & {
  id: string;
  shop: string;
  createdAt: string;
  updatedAt: string;
};

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
  createdAt: string;
  updatedAt: string;
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

export const defaultWidgetSettings: WidgetSettingsInput = {
  widgetStyle: "text",
  widgetButtonText: "Get Quote",
  widgetSize: "medium",
  widgetOrientation: "horizontal",
  widgetDesktopPosition: "middle_left",
  widgetMobilePosition: "bottom_right",
  widgetDisplayMode: "all",
  widgetSpecificPages: "",
  widgetBackgroundColor: "#120670",
  widgetTextColor: "#ffffff",
  widgetAnimation: "pulse",
  widgetIconDataUrl: "",
};

const legacyEmailPatternsPlaceholder = "@company.com, *@wholesale.com";

function toBoolean(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function normalizeStoredEmailPatterns(value: string | null | undefined) {
  const patterns = value?.trim() ?? "";
  return patterns === legacyEmailPatternsPlaceholder ? "" : patterns;
}

function fromRow(row: QuoteSettingsRow): QuoteSettings {
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
    widgetStyle: normalizeEnum(
      row.widgetStyle,
      ["icon", "text"],
      defaultWidgetSettings.widgetStyle,
    ),
    widgetButtonText:
      row.widgetButtonText?.trim() || defaultWidgetSettings.widgetButtonText,
    widgetSize: normalizeEnum(
      row.widgetSize,
      ["small", "medium", "large"],
      defaultWidgetSettings.widgetSize,
    ),
    widgetOrientation: normalizeEnum(
      row.widgetOrientation,
      ["horizontal", "vertical"],
      defaultWidgetSettings.widgetOrientation,
    ),
    widgetDesktopPosition: normalizeEnum(
      row.widgetDesktopPosition,
      [
        "top_left",
        "top_center",
        "top_right",
        "middle_left",
        "middle_center",
        "middle_right",
        "bottom_left",
        "bottom_center",
        "bottom_right",
      ],
      defaultWidgetSettings.widgetDesktopPosition,
    ),
    widgetMobilePosition: normalizeEnum(
      row.widgetMobilePosition,
      [
        "top_left",
        "top_center",
        "top_right",
        "middle_left",
        "middle_center",
        "middle_right",
        "bottom_left",
        "bottom_center",
        "bottom_right",
      ],
      defaultWidgetSettings.widgetMobilePosition,
    ),
    widgetDisplayMode: normalizeEnum(
      row.widgetDisplayMode,
      ["all", "specific"],
      defaultWidgetSettings.widgetDisplayMode,
    ),
    widgetSpecificPages: row.widgetSpecificPages ?? "",
    widgetBackgroundColor: normalizeHexColor(
      row.widgetBackgroundColor,
      defaultWidgetSettings.widgetBackgroundColor,
    ),
    widgetTextColor: normalizeHexColor(
      row.widgetTextColor,
      defaultWidgetSettings.widgetTextColor,
    ),
    widgetAnimation: normalizeEnum(
      row.widgetAnimation,
      ["none", "pulse", "bounce"],
      defaultWidgetSettings.widgetAnimation,
    ),
    widgetIconDataUrl: normalizeIconDataUrl(row.widgetIconDataUrl),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ensureQuoteSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QuoteSetting" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "shop" TEXT NOT NULL UNIQUE,
      "requesterScope" TEXT NOT NULL DEFAULT 'SELECTED',
      "allowCustomersNoPurchase" BOOLEAN NOT NULL DEFAULT true,
      "allowRepeatCustomers" BOOLEAN NOT NULL DEFAULT false,
      "allowAbandonedCheckout" BOOLEAN NOT NULL DEFAULT false,
      "allowEmailSubscribers" BOOLEAN NOT NULL DEFAULT false,
      "allowPurchasedCustomers" BOOLEAN NOT NULL DEFAULT false,
      "selectedCustomerQuery" TEXT,
      "emailPatterns" TEXT,
      "productEligibility" TEXT NOT NULL DEFAULT 'ALL',
      "selectedProductResources" TEXT,
      "allowedProductResources" TEXT,
      "excludedProductResources" TEXT,
      "quoteExpiresAfterDays" INTEGER NOT NULL DEFAULT 7,
      "reminderBeforeExpireDays" INTEGER NOT NULL DEFAULT 3,
      "widgetStyle" TEXT NOT NULL DEFAULT 'text',
      "widgetButtonText" TEXT NOT NULL DEFAULT 'Get Quote',
      "widgetSize" TEXT NOT NULL DEFAULT 'medium',
      "widgetOrientation" TEXT NOT NULL DEFAULT 'horizontal',
      "widgetDesktopPosition" TEXT NOT NULL DEFAULT 'middle_left',
      "widgetMobilePosition" TEXT NOT NULL DEFAULT 'bottom_right',
      "widgetDisplayMode" TEXT NOT NULL DEFAULT 'all',
      "widgetSpecificPages" TEXT,
      "widgetBackgroundColor" TEXT NOT NULL DEFAULT '#120670',
      "widgetTextColor" TEXT NOT NULL DEFAULT '#ffffff',
      "widgetAnimation" TEXT NOT NULL DEFAULT 'pulse',
      "widgetIconDataUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("QuoteSetting", "selectedProductResources", "TEXT");
  await ensureColumn("QuoteSetting", "allowedProductResources", "TEXT");
  await ensureColumn("QuoteSetting", "excludedProductResources", "TEXT");
  await ensureColumn(
    "QuoteSetting",
    "widgetStyle",
    "TEXT NOT NULL DEFAULT 'text'",
  );
  await ensureColumn(
    "QuoteSetting",
    "widgetButtonText",
    "TEXT NOT NULL DEFAULT 'Get Quote'",
  );
  await ensureColumn(
    "QuoteSetting",
    "widgetSize",
    "TEXT NOT NULL DEFAULT 'medium'",
  );
  await ensureColumn(
    "QuoteSetting",
    "widgetOrientation",
    "TEXT NOT NULL DEFAULT 'horizontal'",
  );
  await ensureColumn(
    "QuoteSetting",
    "widgetDesktopPosition",
    "TEXT NOT NULL DEFAULT 'middle_left'",
  );
  await ensureColumn(
    "QuoteSetting",
    "widgetMobilePosition",
    "TEXT NOT NULL DEFAULT 'bottom_right'",
  );
  await ensureColumn(
    "QuoteSetting",
    "widgetDisplayMode",
    "TEXT NOT NULL DEFAULT 'all'",
  );
  await ensureColumn("QuoteSetting", "widgetSpecificPages", "TEXT");
  await ensureColumn(
    "QuoteSetting",
    "widgetBackgroundColor",
    "TEXT NOT NULL DEFAULT '#120670'",
  );
  await ensureColumn(
    "QuoteSetting",
    "widgetTextColor",
    "TEXT NOT NULL DEFAULT '#ffffff'",
  );
  await ensureColumn(
    "QuoteSetting",
    "widgetAnimation",
    "TEXT NOT NULL DEFAULT 'pulse'",
  );
  await ensureColumn("QuoteSetting", "widgetIconDataUrl", "TEXT");
}

async function ensureColumn(table: string, column: string, definition: string) {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("${table}")`,
  );
  if (columns.some((item) => item.name === column)) return;

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`,
  );
}

async function findSettingsRow(shop: string) {
  const rows = await prisma.$queryRawUnsafe<QuoteSettingsRow[]>(
    `SELECT * FROM "QuoteSetting" WHERE "shop" = ? LIMIT 1`,
    shop,
  );

  return rows[0] ?? null;
}

export async function getQuoteSettings(shop: string) {
  await ensureQuoteSettingsTable();

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
  await ensureQuoteSettingsTable();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "QuoteSetting" (
        "id",
        "shop",
        "requesterScope",
        "allowCustomersNoPurchase",
        "allowRepeatCustomers",
        "allowAbandonedCheckout",
        "allowEmailSubscribers",
        "allowPurchasedCustomers",
        "selectedCustomerQuery",
        "emailPatterns",
        "productEligibility",
        "selectedProductResources",
        "allowedProductResources",
        "excludedProductResources",
        "quoteExpiresAfterDays",
        "reminderBeforeExpireDays",
        "updatedAt"
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT("shop") DO UPDATE SET
        "requesterScope" = excluded."requesterScope",
        "allowCustomersNoPurchase" = excluded."allowCustomersNoPurchase",
        "allowRepeatCustomers" = excluded."allowRepeatCustomers",
        "allowAbandonedCheckout" = excluded."allowAbandonedCheckout",
        "allowEmailSubscribers" = excluded."allowEmailSubscribers",
        "allowPurchasedCustomers" = excluded."allowPurchasedCustomers",
        "selectedCustomerQuery" = excluded."selectedCustomerQuery",
        "emailPatterns" = excluded."emailPatterns",
        "productEligibility" = excluded."productEligibility",
        "selectedProductResources" = excluded."selectedProductResources",
        "allowedProductResources" = excluded."allowedProductResources",
        "excludedProductResources" = excluded."excludedProductResources",
        "quoteExpiresAfterDays" = excluded."quoteExpiresAfterDays",
        "reminderBeforeExpireDays" = excluded."reminderBeforeExpireDays",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    `quote-setting-${shop}`,
    shop,
    input.requesterScope,
    input.allowCustomersNoPurchase ? 1 : 0,
    input.allowRepeatCustomers ? 1 : 0,
    input.allowAbandonedCheckout ? 1 : 0,
    input.allowEmailSubscribers ? 1 : 0,
    input.allowPurchasedCustomers ? 1 : 0,
    input.selectedCustomerQuery,
    input.emailPatterns,
    input.productEligibility,
    input.selectedProductResources,
    input.allowedProductResources,
    input.excludedProductResources,
    input.quoteExpiresAfterDays,
    input.reminderBeforeExpireDays,
  );

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

  await prisma.$executeRawUnsafe(
    `
      UPDATE "QuoteSetting"
      SET
        "widgetStyle" = ?,
        "widgetButtonText" = ?,
        "widgetSize" = ?,
        "widgetOrientation" = ?,
        "widgetDesktopPosition" = ?,
        "widgetMobilePosition" = ?,
        "widgetDisplayMode" = ?,
        "widgetSpecificPages" = ?,
        "widgetBackgroundColor" = ?,
        "widgetTextColor" = ?,
        "widgetAnimation" = ?,
        "widgetIconDataUrl" = ?,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "shop" = ?
    `,
    input.widgetStyle,
    input.widgetButtonText,
    input.widgetSize,
    input.widgetOrientation,
    input.widgetDesktopPosition,
    input.widgetMobilePosition,
    input.widgetDisplayMode,
    input.widgetSpecificPages,
    input.widgetBackgroundColor,
    input.widgetTextColor,
    input.widgetAnimation,
    input.widgetIconDataUrl,
    shop,
  );

  return getQuoteSettings(shop);
}

export function normalizeWidgetSettingsForm(
  formData: FormData,
): WidgetSettingsInput {
  return {
    widgetStyle: normalizeEnum(
      String(formData.get("widgetStyle") ?? ""),
      ["icon", "text"],
      defaultWidgetSettings.widgetStyle,
    ),
    widgetButtonText: sanitizeSingleLine(
      String(formData.get("widgetButtonText") ?? ""),
      defaultWidgetSettings.widgetButtonText,
      20,
    ),
    widgetSize: normalizeEnum(
      String(formData.get("widgetSize") ?? ""),
      ["small", "medium", "large"],
      defaultWidgetSettings.widgetSize,
    ),
    widgetOrientation: normalizeEnum(
      String(formData.get("widgetOrientation") ?? ""),
      ["horizontal", "vertical"],
      defaultWidgetSettings.widgetOrientation,
    ),
    widgetDesktopPosition: normalizeEnum(
      String(formData.get("widgetDesktopPosition") ?? ""),
      [
        "top_left",
        "top_center",
        "top_right",
        "middle_left",
        "middle_center",
        "middle_right",
        "bottom_left",
        "bottom_center",
        "bottom_right",
      ],
      defaultWidgetSettings.widgetDesktopPosition,
    ),
    widgetMobilePosition: normalizeEnum(
      String(formData.get("widgetMobilePosition") ?? ""),
      [
        "top_left",
        "top_center",
        "top_right",
        "middle_left",
        "middle_center",
        "middle_right",
        "bottom_left",
        "bottom_center",
        "bottom_right",
      ],
      defaultWidgetSettings.widgetMobilePosition,
    ),
    widgetDisplayMode: normalizeEnum(
      String(formData.get("widgetDisplayMode") ?? ""),
      ["all", "specific"],
      defaultWidgetSettings.widgetDisplayMode,
    ),
    widgetSpecificPages: sanitizePageList(
      String(formData.get("widgetSpecificPages") ?? ""),
    ),
    widgetBackgroundColor: normalizeHexColor(
      String(formData.get("widgetBackgroundColor") ?? ""),
      defaultWidgetSettings.widgetBackgroundColor,
    ),
    widgetTextColor: normalizeHexColor(
      String(formData.get("widgetTextColor") ?? ""),
      defaultWidgetSettings.widgetTextColor,
    ),
    widgetAnimation: normalizeEnum(
      String(formData.get("widgetAnimation") ?? ""),
      ["none", "pulse", "bounce"],
      defaultWidgetSettings.widgetAnimation,
    ),
    widgetIconDataUrl: normalizeIconDataUrl(
      String(formData.get("widgetIconDataUrl") ?? ""),
    ),
  };
}

function normalizeEnum(value: string | null | undefined, allowed: string[], fallback: string) {
  return allowed.includes(String(value ?? "")) ? String(value) : fallback;
}

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function normalizeIconDataUrl(value: string | null | undefined) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  if (clean.length > 1_400_000) return "";
  return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(
    clean,
  )
    ? clean
    : "";
}

function sanitizeSingleLine(value: string, fallback: string, maxLength: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return (clean || fallback).slice(0, maxLength);
}

function sanitizePageList(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[\n,]+/)
    .map((page) => page.trim())
    .filter((page) => {
      if (!page || seen.has(page)) return false;
      seen.add(page);
      return true;
    })
    .slice(0, 50)
    .join("\n");
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
