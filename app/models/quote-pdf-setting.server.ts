import prisma from "~/db.server";

export type QuotePdfSetting = {
  showQuoteDate: boolean;
  showDueDate: boolean;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  showOriginalPrice: boolean;
  showUnitPrice: boolean;
  showTotal: boolean;
  showImage: boolean;
  logoSize: number;
  font: "Inter" | "Arial" | "Georgia";
  fontSize: number;
  primaryColor: string;
  textColor: string;
  productHeaderColor: string;
};

export const defaultQuotePdfSetting: QuotePdfSetting = {
  showQuoteDate: true,
  showDueDate: true,
  dateFormat: "DD/MM/YYYY",
  showOriginalPrice: true,
  showUnitPrice: true,
  showTotal: true,
  showImage: true,
  logoSize: 42,
  font: "Inter",
  fontSize: 12,
  primaryColor: "#0B3F8A",
  textColor: "#111827",
  productHeaderColor: "#FFFFFF",
};

const booleanValue = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const colorValue = (value: unknown, fallback: string) => {
  const color = String(value ?? "");
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
};

export function normalizeQuotePdfSetting(
  value: Partial<QuotePdfSetting>,
): QuotePdfSetting {
  const dateFormats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
  const fonts = ["Inter", "Arial", "Georgia"] as const;
  return {
    showQuoteDate: booleanValue(value.showQuoteDate, true),
    showDueDate: booleanValue(value.showDueDate, true),
    dateFormat: dateFormats.includes(value.dateFormat as (typeof dateFormats)[number])
      ? (value.dateFormat as QuotePdfSetting["dateFormat"])
      : defaultQuotePdfSetting.dateFormat,
    showOriginalPrice: booleanValue(value.showOriginalPrice, true),
    showUnitPrice: booleanValue(value.showUnitPrice, true),
    showTotal: booleanValue(value.showTotal, true),
    showImage: booleanValue(value.showImage, true),
    logoSize: Math.min(80, Math.max(20, Number(value.logoSize) || 42)),
    font: fonts.includes(value.font as (typeof fonts)[number])
      ? (value.font as QuotePdfSetting["font"])
      : defaultQuotePdfSetting.font,
    fontSize: Math.min(16, Math.max(10, Number(value.fontSize) || 12)),
    primaryColor: colorValue(value.primaryColor, defaultQuotePdfSetting.primaryColor),
    textColor: colorValue(value.textColor, defaultQuotePdfSetting.textColor),
    productHeaderColor: colorValue(
      value.productHeaderColor,
      defaultQuotePdfSetting.productHeaderColor,
    ),
  };
}

export async function getQuotePdfSetting(shop: string) {
  const row = await prisma.quotePdfSetting.findUnique({ where: { shop } });
  if (!row) return defaultQuotePdfSetting;
  try {
    return normalizeQuotePdfSetting(JSON.parse(row.settingsJson));
  } catch {
    return defaultQuotePdfSetting;
  }
}

export async function updateQuotePdfSetting(
  shop: string,
  input: Partial<QuotePdfSetting>,
) {
  const settings = normalizeQuotePdfSetting(input);
  await prisma.quotePdfSetting.upsert({
    where: { shop },
    create: { shop, settingsJson: JSON.stringify(settings) },
    update: { settingsJson: JSON.stringify(settings) },
  });
  return settings;
}
