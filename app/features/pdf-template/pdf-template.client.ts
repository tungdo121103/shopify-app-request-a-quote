import type { QuotePdfSetting } from "~/models/quote-pdf-setting.server";

export function formatPreviewDate(isoDate: string, format: QuotePdfSetting["dateFormat"]) {
  const [year, month, day] = isoDate.split("-");
  if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
}

export function formatPreviewMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatCustomerAddress(...values: Array<string | null | undefined>) {
  const parts = values
    .flatMap((value) => String(value ?? "").split(","))
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(", ");
}

export function chunkItems<T>(items: T[], size: number) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, (index + 1) * size),
  );
}
