import { getQuoteStatusLabel, getQuoteStatusTone } from "~/lib/quote-status";
import type { ReactNode } from "react";
import type { QuoteListItem } from "~/features/quotes/quote-list";
import {
  formatQuoteDateTime,
  formatQuoteMoney,
} from "~/features/quotes/quote-list";
import pageStyles from "~/styles/quote-list.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

const icons = {
  view: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M2.5 10s2.7-4.5 7.5-4.5 7.5 4.5 7.5 4.5-2.7 4.5-7.5 4.5S2.5 10 2.5 10Z" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  ),
  edit: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m4 13.8-.5 2.7 2.7-.5 8.7-8.7-2.2-2.2L4 13.8Z" />
      <path d="m11.7 6.1 2.2 2.2" />
    </svg>
  ),
  reopen: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M4.3 7.2A6 6 0 1 1 4 12" />
      <path d="M4.3 3.8v3.4h3.4" />
    </svg>
  ),
  download: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M10 3v9" />
      <path d="m6.5 9 3.5 3.5L13.5 9" />
      <path d="M4 16h12" />
    </svg>
  ),
  delete: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M4 5h12" />
      <path d="M7 5V3.5h6V5" />
      <path d="m6 7 .7 9h6.6l.7-9" />
      <path d="M8.5 8.5v5M11.5 8.5v5" />
    </svg>
  ),
};

type QuoteListTableProps = {
  quotes: QuoteListItem[];
  selectedQuoteIds: string[];
  allSelected: boolean;
  isSubmitting: boolean;
  pendingActionQuoteId: string | null;
  onToggleAll: () => void;
  onToggleQuote: (quoteId: string) => void;
  onOpenQuote: (
    quoteId: string,
    params?: { mode?: "view" | "edit"; focus?: "chat" },
  ) => void;
  onDownloadPdf: (quoteId: string) => void;
  onDeleteQuote: (quote: QuoteListItem) => void;
  onQuoteAction: (quoteId: string, intent: "reopen" | "revise") => void;
};

export function QuoteListTable({
  quotes,
  selectedQuoteIds,
  allSelected,
  isSubmitting,
  pendingActionQuoteId,
  onToggleAll,
  onToggleQuote,
  onOpenQuote,
  onDownloadPdf,
  onDeleteQuote,
  onQuoteAction,
}: QuoteListTableProps) {
  return (
    <div className={styles.managerTableWrap}>
      <table className={styles.managerTable}>
        <thead>
          <tr>
            <th className={styles.checkboxColumn}>
              <input
                aria-label="Select all quotes"
                checked={allSelected}
                disabled={quotes.length === 0}
                onChange={onToggleAll}
                type="checkbox"
              />
            </th>
            <th>Quote ID</th><th>Customer</th><th>Created time</th>
            <th>Expired time</th><th>Status</th><th>Quote value</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quotes.length === 0 ? (
            <tr><td className={styles.managerEmpty} colSpan={8}>No quotes found</td></tr>
          ) : quotes.map((quote) => {
            const tone = getQuoteStatusTone(quote.status);
            const isFinal = quote.status === "ACCEPTED" || quote.status === "CONVERTED_TO_ORDER";
            const isSent = quote.status === "OFFERED_BY_MERCHANT";
            const isWorkable = quote.status === "NEGOTIATING";
            const isDeclined = quote.status === "DECLINED";
            const isExpired = String(quote.status) === "EXPIRED";
            const isRequested = quote.status === "REQUESTED_BY_CUSTOMER";
            const canView = isFinal || isDeclined || isExpired || isSent;
            const canManage = isRequested || isWorkable;
            const canDownload = isFinal || isWorkable || isSent;
            const canDelete = !isFinal;
            const isRowSubmitting = isSubmitting || pendingActionQuoteId === quote.id;
            const pending = pendingActionQuoteId === quote.id;

            return (
              <tr className={quote.unreadCount > 0 ? styles.managerUnreadRow : ""} key={quote.id}>
                <td className={styles.checkboxColumn}>
                  <input checked={selectedQuoteIds.includes(quote.id)} onChange={() => onToggleQuote(quote.id)} aria-label={`Select ${quote.quoteNumber}`} type="checkbox" />
                </td>
                <td>
                  <button className={styles.managerQuoteLink} onClick={() => onOpenQuote(quote.id, { mode: "view" })} title="View quote" type="button">
                    {quote.unreadCount > 0 ? <span aria-label="Unread updates" className={styles.managerUnreadDot} /> : null}
                    {quote.quoteNumber}
                  </button>
                </td>
                <td><div className={styles.customerCell}><span className={styles.managerTextValue}>{quote.customerEmail ?? "Guest customer"}</span></div></td>
                <td className={styles.managerTime}>{formatQuoteDateTime(quote.createdAt)}</td>
                <td className={styles.managerTime}>{isSent && quote.expiresAt ? formatQuoteDateTime(quote.expiresAt) : "-"}</td>
                <td><span className={`${styles.managerBadge} ${styles[tone]}`}>{getQuoteStatusLabel(quote.status)}</span></td>
                <td className={styles.managerMoney}>{formatQuoteMoney(quote.quoteTotal.toString(), quote.currency)}</td>
                <td>
                  <div className={styles.managerActions}>
                    {canView ? <ActionButton label={`View ${quote.quoteNumber}`} title="View quote" onClick={() => onOpenQuote(quote.id, { mode: "view" })}>{icons.view}</ActionButton> : null}
                    {canManage ? <ActionButton label={`Edit ${quote.quoteNumber}`} title="Edit quote" onClick={() => onOpenQuote(quote.id, { mode: "edit" })}>{icons.edit}</ActionButton> : null}
                    {isSent ? <ActionButton label={`Revise ${quote.quoteNumber}`} title="Revise quote" disabled={isRowSubmitting} pending={pending} onClick={() => onQuoteAction(quote.id, "revise")}>{icons.edit}</ActionButton> : null}
                    {isDeclined || isExpired ? <ActionButton label={`Reopen ${quote.quoteNumber}`} title="Reopen quote" disabled={isRowSubmitting} pending={pending} onClick={() => onQuoteAction(quote.id, "reopen")}>{icons.reopen}</ActionButton> : null}
                    {canDownload ? <ActionButton label={`Download ${quote.quoteNumber}`} title="Download quote PDF" onClick={() => onDownloadPdf(quote.id)}>{icons.download}</ActionButton> : null}
                    {canDelete ? <ActionButton danger label={`Delete ${quote.quoteNumber}`} title="Delete" disabled={isRowSubmitting} pending={pending} onClick={() => onDeleteQuote(quote)}>{icons.delete}</ActionButton> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type ActionButtonProps = {
  children: ReactNode;
  label: string;
  title: string;
  danger?: boolean;
  disabled?: boolean;
  pending?: boolean;
  onClick: () => void;
};

function ActionButton({ children, label, title, danger, disabled, pending, onClick }: ActionButtonProps) {
  return (
    <button
      aria-label={label}
      className={`${styles.managerAction} ${danger ? styles.managerDelete : ""} ${pending ? styles.managerActionPending : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {pending ? <span className={styles.managerActionSpinner} /> : children}
    </button>
  );
}
