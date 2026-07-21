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

export type ExpirationSettingsErrors = Partial<
  Record<"quoteExpiresAfterDays" | "reminderBeforeExpireDays", string>
>;

export function validateExpirationSettingsForm(
  formData: FormData,
): ExpirationSettingsErrors {
  const errors: ExpirationSettingsErrors = {};
  const expiresValue = String(formData.get("quoteExpiresAfterDays") ?? "").trim();
  const reminderValue = String(
    formData.get("reminderBeforeExpireDays") ?? "",
  ).trim();
  const expiresAfterDays = Number(expiresValue);
  const reminderBeforeExpireDays = Number(reminderValue);

  if (
    !expiresValue ||
    !Number.isInteger(expiresAfterDays) ||
    expiresAfterDays < 1 ||
    expiresAfterDays > 365
  ) {
    errors.quoteExpiresAfterDays =
      "Enter a whole number between 1 and 365 days.";
  }

  if (
    !reminderValue ||
    !Number.isInteger(reminderBeforeExpireDays) ||
    reminderBeforeExpireDays < 0 ||
    reminderBeforeExpireDays > 364
  ) {
    errors.reminderBeforeExpireDays =
      "Enter a whole number between 0 and 364 days.";
  } else if (
    !errors.quoteExpiresAfterDays &&
    reminderBeforeExpireDays >= expiresAfterDays
  ) {
    errors.reminderBeforeExpireDays =
      "Reminder must be earlier than the quote expiration. Use 0 to disable it.";
  }

  return errors;
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
