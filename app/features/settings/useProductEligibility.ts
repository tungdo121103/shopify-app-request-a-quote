import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { parseSelectedProductResources, type ResourceOption } from "./quote-settings.client";
import type { QuoteSettings } from "./quote-settings.server";

export function useProductEligibility(settings: QuoteSettings) {
  const fetcher = useFetcher<{ resources: ResourceOption[] }>();
  const [eligibility, setEligibility] = useState(settings.productEligibility);
  const [allowed, setAllowed] = useState(() => parseSelectedProductResources(settings.allowedProductResources || settings.selectedProductResources));
  const [excluded, setExcluded] = useState(() => parseSelectedProductResources(settings.excludedProductResources));
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"PRODUCT" | "COLLECTION">("PRODUCT");
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const lastRequest = useRef<string | null>(null);
  const selected = eligibility === "EXCLUDED" ? excluded : allowed;
  const setSelected = eligibility === "EXCLUDED" ? setExcluded : setAllowed;

  useEffect(() => {
    if (!open) return;
    const key = `${type}:${search}`;
    const timeout = window.setTimeout(() => {
      if (lastRequest.current === key) return;
      lastRequest.current = key;
      fetcher.load(`?resource=${type === "PRODUCT" ? "eligibility-products" : "eligibility-collections"}&q=${encodeURIComponent(search)}`);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [fetcher, open, search, type]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (resource: ResourceOption) => setSelected((current) =>
    current.some((item) => item.id === resource.id)
      ? current.filter((item) => item.id !== resource.id)
      : [...current, resource],
  );

  return {
    fetcher, eligibility, setEligibility, allowed, excluded, selected, search, setSearch,
    type, setType, open, setOpen, pickerRef, toggle,
    results: fetcher.data?.resources ?? [],
    loading: fetcher.state === "loading" || fetcher.state === "submitting",
    isSelected: (id: string) => selected.some((item) => item.id === id),
  };
}
