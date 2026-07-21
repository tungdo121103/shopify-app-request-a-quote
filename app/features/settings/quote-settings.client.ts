export type CustomerOption = { id: string; name: string; email: string; phone: string };
export type ResourceOption = { id: string; type: "PRODUCT" | "COLLECTION"; title: string; imageUrl: string };

export function parseSelectedCustomers(value: string | null | undefined): CustomerOption[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((customer): CustomerOption | null => {
      if (!customer || typeof customer !== "object") return null;
      const record = customer as Record<string, unknown>;
      const id = String(record.id ?? "");
      return id ? { id, name: String(record.name ?? "Customer"), email: String(record.email ?? ""), phone: String(record.phone ?? "") } : null;
    }).filter((customer): customer is CustomerOption => Boolean(customer));
  } catch { return []; }
}

export function parseSelectedProductResources(value: string | null | undefined): ResourceOption[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((resource): ResourceOption | null => {
      if (!resource || typeof resource !== "object") return null;
      const record = resource as Record<string, unknown>;
      const id = String(record.id ?? "");
      const type = String(record.type ?? "").toUpperCase();
      if (!id || (type !== "PRODUCT" && type !== "COLLECTION")) return null;
      return { id, type, title: String(record.title ?? "Resource"), imageUrl: String(record.imageUrl ?? "") } as ResourceOption;
    }).filter((resource): resource is ResourceOption => Boolean(resource));
  } catch { return []; }
}
