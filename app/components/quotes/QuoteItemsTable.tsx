import type { Ref } from "react";
import { Form } from "react-router";
import pageStyles from "~/styles/quote-detail.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

type QuoteItemRow = {
  id: string;
  imageUrl?: string | null;
  quantity: number;
  quotePrice: unknown;
  sku?: string | null;
  title: string;
  unitPrice: unknown;
};

type QuoteItemsTableProps = {
  currency: string;
  editAction: string;
  firstQuotePriceInputRef: Ref<HTMLInputElement>;
  isLockedStatus: boolean;
  isPriceReadOnly: boolean;
  isSubmitting: boolean;
  isViewMode: boolean;
  items: QuoteItemRow[];
  orderId?: string | null;
  originalTotal: unknown;
  quoteTotal: unknown;
};

function money(value: unknown, currency: string) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function moneyInputValue(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return String(Number(amount.toFixed(2)));
}

export function QuoteItemsTable({
  currency,
  editAction,
  firstQuotePriceInputRef,
  isLockedStatus,
  isPriceReadOnly,
  isSubmitting,
  isViewMode,
  items,
  orderId,
  originalTotal,
  quoteTotal,
}: QuoteItemsTableProps) {
  return (
    <Form action={editAction} id="quote-detail-prices" method="post">
      <div className={styles.merchantItemsTableWrap}>
        <table className={styles.merchantItemsTable}>
          <thead>
            <tr><th>Product</th><th>Price</th><th>Qty</th><th>Quote Price</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4}>No quote items found.</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.merchantItemProduct}>
                      {item.imageUrl ? <img alt="" src={item.imageUrl} /> : <span>{index + 1}</span>}
                      <div><strong>{item.title}</strong><small>{item.sku || "Default Title"}</small></div>
                    </div>
                  </td>
                  <td>{money(item.unitPrice, currency)}</td>
                  <td>
                    <input className={styles.merchantSmallInput} defaultValue={item.quantity} disabled={isPriceReadOnly} min="1" name={`qty:${item.id}`} step="1" type="number" />
                  </td>
                  <td>
                    <input className={styles.merchantSmallInput} defaultValue={moneyInputValue(item.quotePrice)} disabled={isPriceReadOnly} min="0" name={`price:${item.id}`} ref={index === 0 ? firstQuotePriceInputRef : null} step="0.01" type="number" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td>{money(originalTotal, currency)}</td><td /><td>{money(quoteTotal, currency)}</td></tr>
          </tfoot>
        </table>
      </div>

      <div className={styles.merchantItemsActions}>
        <button className={styles.quoteDetailGhostButton} disabled={isSubmitting || Boolean(orderId) || isViewMode || isLockedStatus} name="intent" type="submit" value="save_prices">
          Save prices
        </button>
      </div>
    </Form>
  );
}
