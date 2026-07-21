import pageStyles from "~/styles/quote-list.module.css";

const styles = pageStyles;

const chevronLeft = (
  <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m12.5 5-5 5 5 5" /></svg>
);
const chevronRight = (
  <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m7.5 5 5 5-5 5" /></svg>
);

type QuoteListFooterProps = {
  page: number;
  pageSize: number;
  totalPages: number;
  onChange: (params: { page: number; pageSize?: number }) => void;
};

export function QuoteListFooter({ page, pageSize, totalPages, onChange }: QuoteListFooterProps) {
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <footer className={styles.managerFooter}>
      <div className={styles.managerPager}>
        <button aria-label="Previous page" className={`${styles.managerPagerButton} ${!canGoPrevious ? styles.managerPagerButtonDisabled : ""}`} disabled={!canGoPrevious} onClick={() => onChange({ page: page - 1 })} type="button">{chevronLeft}</button>
        <span>Page <strong>{page}/{totalPages}</strong></span>
        <button aria-label="Next page" className={`${styles.managerPagerButton} ${!canGoNext ? styles.managerPagerButtonDisabled : ""}`} disabled={!canGoNext} onClick={() => onChange({ page: page + 1 })} type="button">{chevronRight}</button>
      </div>
      <div className={styles.managerPerPage}>
        <span>Items per page</span>
        <select aria-label="Items per page" value={pageSize} name="pageSize" onChange={(event) => onChange({ page: 1, pageSize: Number(event.currentTarget.value) })}>
          <option value="10">10</option><option value="20">20</option><option value="30">30</option><option value="50">50</option>
        </select>
      </div>
    </footer>
  );
}
