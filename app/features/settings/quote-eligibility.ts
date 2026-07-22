export type CustomerOption = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type ResourceOption = {
  id: string;
  type: "PRODUCT" | "COLLECTION";
  title: string;
  imageUrl: string;
};

export function parseSelectedCustomers(
  value: string | null | undefined,
): CustomerOption[] {
  return parseArray(value, (record) => {
    const id = String(record.id ?? "");
    if (!id) return null;
    return {
      id,
      name: String(record.name ?? "Customer"),
      email: String(record.email ?? ""),
      phone: String(record.phone ?? ""),
    };
  });
}

export function parseSelectedProductResources(
  value: string | null | undefined,
): ResourceOption[] {
  return parseArray(value, (record) => {
    const id = String(record.id ?? "");
    const type = String(record.type ?? "").toUpperCase();
    if (!id || (type !== "PRODUCT" && type !== "COLLECTION")) return null;
    return {
      id,
      type,
      title: String(record.title ?? "Resource"),
      imageUrl: String(record.imageUrl ?? ""),
    } as ResourceOption;
  });
}

export function matchesEmailPatterns(
  email: string,
  patterns: string | null | undefined,
) {
  if (!email || !patterns) return false;
  return patterns
    .split(/[\n,]+/)
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean)
    .some((pattern) => {
      if (pattern.startsWith("@")) return email.endsWith(pattern);
      const escaped = pattern
        .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
        .replace(/\*/g, ".*");
      return new RegExp(`^${escaped}$`, "i").test(email);
    });
}

function parseArray<T>(
  value: string | null | undefined,
  map: (record: Record<string, unknown>) => T | null,
): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) =>
        item && typeof item === "object"
          ? map(item as Record<string, unknown>)
          : null,
      )
      .filter((item): item is T => item !== null);
  } catch {
    return [];
  }
}
