import { Form, Link } from "react-router";
import { getQuoteStatusLabel, getQuoteStatusTone } from "~/lib/quote-status";
import pageStyles from "~/styles/quote-detail.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

type QuoteDetailHeaderProps = {
  canConvert: boolean;
  canReopen: boolean;
  canRevise: boolean;
  canSendOffer: boolean;
  editAction: string;
  isSubmitting: boolean;
  isViewMode: boolean;
  onConvertStart: () => void;
  pdfHref: string;
  quoteNumber: string;
  status: string;
};

export function QuoteDetailHeader({
  canConvert,
  canReopen,
  canRevise,
  canSendOffer,
  editAction,
  isSubmitting,
  isViewMode,
  onConvertStart,
  pdfHref,
  quoteNumber,
  status,
}: QuoteDetailHeaderProps) {
  const tone = getQuoteStatusTone(status);

  return (
    <header className={styles.quoteDetailHeader}>
      <div className={styles.quoteDetailTitleRow}>
        <Link className={styles.quoteDetailBackLink} to="/app/quotes">
          <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24">
            <path d="M19 12H5m0 0 6-6m-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </Link>
        <h1>Quote Details - {quoteNumber}</h1>
        <span className={`${styles.quoteDetailBadge} ${styles[tone]}`}>
          {getQuoteStatusLabel(status)}
        </span>
        <a className={styles.quoteDetailIconButton} href={pdfHref} title="Download quote">
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </a>
      </div>

      <div className={styles.quoteDetailHeaderActions}>
        {canRevise ? (
          <Form action={editAction} method="post">
            <input name="status" type="hidden" value="NEGOTIATING" />
            <button className={styles.quoteDetailTinyButton} disabled={isSubmitting} name="intent" type="submit" value="status">
              Revise quote
            </button>
          </Form>
        ) : null}
        {canReopen ? (
          <Form action={editAction} method="post">
            <input name="status" type="hidden" value="NEGOTIATING" />
            <button className={styles.quoteDetailTinyButton} disabled={isSubmitting} name="intent" type="submit" value="status">
              Reopen
            </button>
          </Form>
        ) : null}
        {canSendOffer && !isViewMode ? (
          <button className={styles.quoteDetailTinyButton} disabled={isSubmitting} form="quote-detail-prices" name="intent" type="submit" value="send_offer">
            Send quote
          </button>
        ) : null}
        {canConvert ? (
          <Form method="post" onSubmit={onConvertStart}>
            <input name="intent" type="hidden" value="convert_order" />
            <button className={styles.quoteDetailTinyButton} disabled={isSubmitting} type="submit">
              Convert quote
            </button>
          </Form>
        ) : null}
      </div>
    </header>
  );
}
