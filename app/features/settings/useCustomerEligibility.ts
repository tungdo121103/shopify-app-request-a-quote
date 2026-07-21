import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { parseSelectedCustomers, type CustomerOption } from "./quote-settings.client";
import type { QuoteSettings } from "./quote-settings.server";

export function useCustomerEligibility(settings: QuoteSettings) {
  const fetcher = useFetcher<{ customers: CustomerOption[]; customerSearchError?: string }>();
  const [scope, setScope] = useState(settings.requesterScope === "ALL" ? "ALL" : "SELECTED");
  const [segments, setSegments] = useState({
    allowCustomersNoPurchase: settings.allowCustomersNoPurchase,
    allowRepeatCustomers: settings.allowRepeatCustomers,
    allowAbandonedCheckout: settings.allowAbandonedCheckout,
    allowEmailSubscribers: settings.allowEmailSubscribers,
    allowPurchasedCustomers: settings.allowPurchasedCustomers,
  });
  const [selected, setSelected] = useState(() => parseSelectedCustomers(settings.selectedCustomerQuery));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const lastRequest = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      if (lastRequest.current === search) return;
      lastRequest.current = search;
      fetcher.load(`?resource=customers&q=${encodeURIComponent(search)}`);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [fetcher, open, search]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (customer: CustomerOption) => setSelected((current) =>
    current.some((item) => item.id === customer.id)
      ? current.filter((item) => item.id !== customer.id)
      : [...current, customer],
  );

  return {
    fetcher, scope, setScope, segments, setSegments, selected, search, setSearch,
    open, setOpen, pickerRef, toggle,
    results: fetcher.data?.customers ?? [],
    loading: fetcher.state === "loading" || fetcher.state === "submitting",
    isSelected: (id: string) => selected.some((item) => item.id === id),
  };
}
