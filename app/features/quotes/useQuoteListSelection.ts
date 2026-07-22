import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { downloadQuotesCsv } from "~/features/quotes/quote-list.client";
import type { QuoteListItem } from "~/features/quotes/quote-list";

type DeleteConfirmation = {
  ids: string[];
  label: string;
  type: "single" | "bulk";
};

export function useQuoteListSelection(quotes: QuoteListItem[]) {
  const deleteFetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<string[]>([]);
  const [pendingDeleteQuoteId, setPendingDeleteQuoteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmation | null>(null);
  const visibleQuotes = useMemo(
    () => quotes.filter((quote) => !optimisticDeletedIds.includes(quote.id)),
    [optimisticDeletedIds, quotes],
  );
  const visibleQuoteIds = useMemo(
    () => visibleQuotes.map((quote) => quote.id),
    [visibleQuotes],
  );
  const selectedQuotes = useMemo(
    () => visibleQuotes.filter((quote) => selectedQuoteIds.includes(quote.id)),
    [selectedQuoteIds, visibleQuotes],
  );
  const selectedVisibleQuoteIds = selectedQuoteIds.filter((id) =>
    visibleQuoteIds.includes(id),
  );
  const allVisibleQuotesSelected =
    visibleQuoteIds.length > 0 &&
    selectedVisibleQuoteIds.length === visibleQuoteIds.length;

  useEffect(() => {
    setSelectedQuoteIds((current) =>
      current.filter((id) => visibleQuoteIds.includes(id)),
    );
  }, [visibleQuoteIds]);

  useEffect(() => {
    if (!deleteConfirm) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [deleteConfirm]);

  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      setPendingDeleteQuoteId(null);
    }
  }, [deleteFetcher.data, deleteFetcher.state]);

  const toggleQuoteSelection = (quoteId: string) => {
    setSelectedQuoteIds((current) =>
      current.includes(quoteId)
        ? current.filter((id) => id !== quoteId)
        : [...current, quoteId],
    );
  };

  const toggleAllVisibleQuotes = () => {
    setSelectedQuoteIds(allVisibleQuotesSelected ? [] : visibleQuoteIds);
  };

  const requestDeleteQuote = (quote: QuoteListItem) => {
    setDeleteConfirm({ ids: [quote.id], label: quote.quoteNumber, type: "single" });
  };

  const requestBulkDeleteQuotes = () => {
    if (selectedQuoteIds.length === 0) return;
    setDeleteConfirm({
      ids: selectedQuoteIds,
      label: `${selectedQuoteIds.length} selected quotes`,
      type: "bulk",
    });
  };

  const confirmDeleteQuotes = () => {
    if (!deleteConfirm) return;
    const nextIds = deleteConfirm.ids;
    setOptimisticDeletedIds((current) =>
      Array.from(new Set([...current, ...nextIds])),
    );
    setSelectedQuoteIds((current) =>
      current.filter((id) => !nextIds.includes(id)),
    );
    setPendingDeleteQuoteId(
      deleteConfirm.type === "single" ? deleteConfirm.ids[0] : "__bulk__",
    );

    const formData = new FormData();
    formData.set("intent", deleteConfirm.type === "bulk" ? "bulk-delete" : "delete");
    if (deleteConfirm.type === "single") {
      formData.set("quoteId", deleteConfirm.ids[0]);
    } else {
      deleteConfirm.ids.forEach((id) => formData.append("quoteIds", id));
    }
    setDeleteConfirm(null);
    deleteFetcher.submit(formData, { method: "post" });
  };

  return {
    allVisibleQuotesSelected,
    cancelDelete: () => setDeleteConfirm(null),
    confirmDeleteQuotes,
    deleteConfirm,
    exportSelectedQuotes: () => downloadQuotesCsv(selectedQuotes),
    pendingDeleteQuoteId,
    requestBulkDeleteQuotes,
    requestDeleteQuote,
    selectedQuoteIds,
    selectedQuotes,
    toggleAllVisibleQuotes,
    toggleQuoteSelection,
    visibleQuotes,
  };
}
