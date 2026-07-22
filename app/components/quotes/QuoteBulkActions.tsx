import { Form } from "react-router";
import { quoteListIcons as icons } from "~/components/quotes/QuoteListIcons";
import type { QuoteListItem } from "~/features/quotes/quote-list";
import pageStyles from "~/styles/quote-list.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

type QuoteBulkActionsProps = {
  isSubmitting: boolean;
  onDelete: () => void;
  onExport: () => void;
  onView: (quoteId: string) => void;
  pendingActionQuoteId: string | null;
  selectedQuoteIds: string[];
  selectedQuotes: QuoteListItem[];
};

export function QuoteBulkActions({
  isSubmitting,
  onDelete,
  onExport,
  onView,
  pendingActionQuoteId,
  selectedQuoteIds,
  selectedQuotes,
}: QuoteBulkActionsProps) {
  if (selectedQuoteIds.length === 0) return null;
  const selectedQuote = selectedQuotes.length === 1 ? selectedQuotes[0] : null;

  return (
    <Form className={styles.bulkActionBar} method="post">
      <span>{selectedQuoteIds.length} selected</span>
      {selectedQuoteIds.map((id) => (
        <input key={id} name="quoteIds" type="hidden" value={id} />
      ))}
      <div className={styles.bulkIconActions}>
        <button
          aria-label={selectedQuote ? `View ${selectedQuote.quoteNumber}` : "Select one quote to view"}
          className={`${styles.bulkIconButton} ${selectedQuote ? "" : styles.bulkIconButtonDisabled}`}
          disabled={!selectedQuote}
          onClick={() => selectedQuote && onView(selectedQuote.id)}
          title={selectedQuote ? "View selected quote" : "Select one quote to view"}
          type="button"
        >
          {icons.view}
        </button>
        <button
          aria-label="Export selected quotes"
          className={styles.bulkIconButton}
          onClick={onExport}
          title="Export selected quotes"
          type="button"
        >
          {icons.download}
        </button>
        <button
          aria-label="Delete selected quotes"
          className={`${styles.bulkIconButton} ${styles.bulkIconDanger}`}
          disabled={isSubmitting || pendingActionQuoteId === "__bulk__"}
          onClick={onDelete}
          title="Delete selected quotes"
          type="button"
        >
          {pendingActionQuoteId === "__bulk__" ? (
            <span className={styles.managerActionSpinner} />
          ) : (
            icons.delete
          )}
        </button>
      </div>
    </Form>
  );
}
