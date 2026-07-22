import { useEffect, useRef, useState } from "react";
import { Form } from "react-router";
import { quoteListIcons as icons } from "~/components/quotes/QuoteListIcons";
import { DEFAULT_QUOTE_LIST_SORT, type QuoteListQueryParams } from "~/features/quotes/quote-list-data";
import pageStyles from "~/styles/quote-list.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

const statusOptions = [
  { value: "ALL", label: "All" },
  { value: "REQUESTED_BY_CUSTOMER", label: "Requested by customer" },
  { value: "NEGOTIATING", label: "Under negotiation" },
  { value: "OFFERED_BY_MERCHANT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CONVERTED_TO_ORDER", label: "Converted to order" },
] as const;

const sortOptions = [
  { value: "UPDATED_DESC", label: "Recently updated" },
  { value: "CREATED_DESC", label: "Newest first" },
  { value: "CREATED_ASC", label: "Oldest first" },
  { value: "UPDATED_ASC", label: "Least recently updated" },
  { value: "VALUE_DESC", label: "Quote value high to low" },
  { value: "VALUE_ASC", label: "Quote value low to high" },
  { value: "CUSTOMER_ASC", label: "Customer A-Z" },
  { value: "CUSTOMER_DESC", label: "Customer Z-A" },
  { value: "EXPIRES_ASC", label: "Expired time soonest" },
] as const;

type QuoteListToolbarProps = {
  pageSize: number;
  search: string;
  sort: string;
  status: string;
  updateQuery: (params: Partial<QuoteListQueryParams>) => void;
};

export function QuoteListToolbar({
  pageSize,
  search,
  sort,
  status,
  updateQuery,
}: QuoteListToolbarProps) {
  const [draftSearch, setDraftSearch] = useState(search);
  const [isFilterOpen, setIsFilterOpen] = useState(
    Boolean(search || status !== "ALL"),
  );
  const [isSortOpen, setIsSortOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortPopoverRef = useRef<HTMLDetailsElement>(null);
  const activeStatus =
    statusOptions.find((option) => option.value === status) ?? statusOptions[0];
  const activeSort =
    sortOptions.find((option) => option.value === sort) ?? sortOptions[0];

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  useEffect(() => {
    if (!isSortOpen) return;
    const closeSortOnOutsideClick = (event: MouseEvent) => {
      if (!sortPopoverRef.current?.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", closeSortOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeSortOnOutsideClick);
  }, [isSortOpen]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  return (
    <>
      <div className={styles.managerTopbar}>
        <div className={styles.statusTabs} aria-label="Quote status tabs">
          <button
            className={`${styles.statusTab} ${status === "ALL" ? styles.statusTabActive : ""}`}
            onClick={() => updateQuery({ status: "ALL", page: 1 })}
            type="button"
          >
            All
          </button>
          {status !== "ALL" && (
            <span className={`${styles.statusTab} ${styles.statusTabActive}`}>
              {activeStatus.label}
            </span>
          )}
          {sort !== DEFAULT_QUOTE_LIST_SORT && (
            <span className={`${styles.statusTab} ${styles.statusTabActive}`}>
              {activeSort.label}
            </span>
          )}
        </div>

        <div className={styles.managerIconTools}>
          <button
            aria-expanded={isFilterOpen}
            className={`${styles.toolButton} ${isFilterOpen ? styles.toolButtonActive : ""}`}
            onClick={() => setIsFilterOpen((value) => !value)}
            title="Search and filter"
            type="button"
          >
            {icons.search}
            {icons.filter}
          </button>
          <details
            className={styles.sortPopover}
            onToggle={(event) => setIsSortOpen(event.currentTarget.open)}
            open={isSortOpen}
            ref={sortPopoverRef}
          >
            <summary
              className={`${styles.toolButton} ${sort !== DEFAULT_QUOTE_LIST_SORT ? styles.toolButtonActive : ""}`}
              title={`Sort: ${activeSort.label}`}
            >
              {icons.sort}
            </summary>
            <div className={styles.sortMenu}>
              <div className={styles.sortMenuTitle}>Sort by</div>
              {sortOptions.map((option) => (
                <button
                  className={`${styles.sortMenuItem} ${option.value === sort ? styles.sortMenuItemActive : ""}`}
                  key={option.value}
                  onClick={() => {
                    updateQuery({ sort: option.value, page: 1 });
                    setIsSortOpen(false);
                  }}
                  type="button"
                >
                  <span>{option.value === sort ? "✓" : ""}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>

      {isFilterOpen && (
        <Form
          className={styles.managerFilters}
          method="get"
          onSubmit={(event) => event.preventDefault()}
        >
          <input
            className={styles.managerSearch}
            name="search"
            onChange={(event) => {
              const nextSearch = event.currentTarget.value;
              setDraftSearch(nextSearch);
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(
                () => updateQuery({ search: nextSearch, page: 1 }),
                500,
              );
            }}
            placeholder="Search by quote, customer or email..."
            value={draftSearch}
          />
          <select
            className={styles.managerSelect}
            name="status"
            onChange={(event) => updateQuery({ status: event.currentTarget.value, page: 1 })}
            value={status}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value={pageSize} />
          {sort !== DEFAULT_QUOTE_LIST_SORT && (
            <input name="sort" type="hidden" value={sort} />
          )}
          <button
            className={styles.filterReset}
            onClick={() => {
              if (searchTimer.current) clearTimeout(searchTimer.current);
              setDraftSearch("");
              updateQuery({
                search: "",
                status: "ALL",
                sort: DEFAULT_QUOTE_LIST_SORT,
                page: 1,
                pageSize,
              });
            }}
            type="button"
          >
            Reset
          </button>
        </Form>
      )}
    </>
  );
}
