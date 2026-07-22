import { useEffect, useState } from "react";
import {
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router";
import { QuoteDeleteDialog } from "~/components/quotes/QuoteDeleteDialog";
import { QuoteBulkActions } from "~/components/quotes/QuoteBulkActions";
import { QuoteListTable } from "~/components/quotes/QuoteListTable";
import { QuoteListFooter } from "~/components/quotes/QuoteListFooter";
import { QuoteListToolbar } from "~/components/quotes/QuoteListToolbar";
import type { QuoteListItem } from "~/features/quotes/quote-list";
import { useQuoteListSelection } from "~/features/quotes/useQuoteListSelection";
import { useQuoteListQuery } from "~/features/quotes/useQuoteListQuery";
import { handleQuoteListAction } from "~/features/quotes/quote-list-action.server";
import { handleQuoteListLoader } from "~/features/quotes/quote-list-loader.server";
import pageStyles from "~/styles/quote-list.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

export const loader = handleQuoteListLoader;

export const action = handleQuoteListAction;

export default function QuotesPage() {
  const initialData = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const quoteActionFetcher = useFetcher<{
    ok?: boolean;
    error?: string;
    quoteId?: string;
    status?: string;
  }>();
  const { data, refetch, updateQuery } = useQuoteListQuery(initialData);
  const { quotes, search, status, sort, pagination } = data;
  const isSubmitting = navigation.state === "submitting";
  const [pendingActionQuoteId, setPendingActionQuoteId] = useState<
    string | null
  >(null);
  const {
    allVisibleQuotesSelected,
    cancelDelete,
    confirmDeleteQuotes,
    deleteConfirm,
    exportSelectedQuotes,
    pendingDeleteQuoteId,
    requestBulkDeleteQuotes,
    requestDeleteQuote,
    selectedQuoteIds,
    selectedQuotes,
    toggleAllVisibleQuotes,
    toggleQuoteSelection,
    visibleQuotes,
  } = useQuoteListSelection(quotes as QuoteListItem[]);
  const displayedPendingActionQuoteId =
    pendingDeleteQuoteId ?? pendingActionQuoteId;

  useEffect(() => {
    if (
      navigation.state === "idle" &&
      quoteActionFetcher.state === "idle"
    ) {
      setPendingActionQuoteId(null);
    }
  }, [navigation.state, quoteActionFetcher.state]);

  useEffect(() => {
    if (quoteActionFetcher.state !== "idle" || !quoteActionFetcher.data) return;
    if (quoteActionFetcher.data.ok) {
      void refetch();
    }
  }, [quoteActionFetcher.data, quoteActionFetcher.state, refetch]);

  const openQuote = (
    quoteId: string,
    params: { mode?: "view" | "edit"; focus?: "chat" } = {},
  ) => {
    const search = new URLSearchParams(location.search);
    search.delete("page");
    search.delete("pageSize");
    search.delete("search");
    search.delete("status");
    search.delete("sort");
    search.delete("mode");
    search.delete("focus");
    if (params.mode) search.set("mode", params.mode);
    if (params.focus) search.set("focus", params.focus);
    const query = search.toString();
    navigate(`/app/quotes/${quoteId}${query ? `?${query}` : ""}`);
  };
  const downloadQuotePdf = (quoteId: string) => {
    const search = new URLSearchParams(location.search);
    search.delete("page");
    search.delete("pageSize");
    search.delete("search");
    search.delete("status");
    search.delete("sort");
    search.delete("mode");
    search.delete("focus");
    const query = search.toString();
    window.location.href = `/app/quotes/${quoteId}/pdf${query ? `?${query}` : ""}`;
  };
  const page = pagination.page;
  const totalPages = pagination.totalPages;
  const submitQuoteAction = (quoteId: string, intent: "reopen" | "revise") => {
    if (quoteActionFetcher.state !== "idle") return;
    setPendingActionQuoteId(quoteId);
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("quoteId", quoteId);
    quoteActionFetcher.submit(formData, { method: "post" });
  };

  return (
    <main className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <p className={styles.kicker}>Request a Quote</p>
          <h1 className={styles.adminTitle}>Manage quotes</h1>
        </div>
      </header>

      <section className={styles.managerCard}>
        <QuoteListToolbar
          pageSize={pagination.pageSize}
          search={search}
          sort={sort}
          status={status}
          updateQuery={updateQuery}
        />
        <QuoteBulkActions
          isSubmitting={isSubmitting}
          onDelete={requestBulkDeleteQuotes}
          onExport={exportSelectedQuotes}
          onView={(quoteId) => openQuote(quoteId, { mode: "view" })}
          pendingActionQuoteId={displayedPendingActionQuoteId}
          selectedQuoteIds={selectedQuoteIds}
          selectedQuotes={selectedQuotes as QuoteListItem[]}
        />
        <QuoteListTable
          allSelected={allVisibleQuotesSelected}
          isSubmitting={isSubmitting}
          onDeleteQuote={requestDeleteQuote}
          onDownloadPdf={downloadQuotePdf}
          onOpenQuote={openQuote}
          onQuoteAction={submitQuoteAction}
          onToggleAll={toggleAllVisibleQuotes}
          onToggleQuote={toggleQuoteSelection}
          pendingActionQuoteId={displayedPendingActionQuoteId}
          quotes={visibleQuotes}
          selectedQuoteIds={selectedQuoteIds}
        />
        <QuoteListFooter
          onChange={updateQuery}
          page={page}
          pageSize={pagination.pageSize}
          totalPages={totalPages}
        />
      </section>
      {deleteConfirm ? (
        <QuoteDeleteDialog
          label={deleteConfirm.label}
          onCancel={cancelDelete}
          onConfirm={confirmDeleteQuotes}
        />
      ) : null}
    </main>
  );
}
