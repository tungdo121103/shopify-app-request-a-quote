import { shouldShowQuoteDueDate } from "~/lib/quote-status";
import type { QuotePdfSetting } from "~/models/quote-pdf-setting.server";
import type { PdfTemplateData } from "~/features/pdf-template/pdf-template.server";
import {
  chunkItems,
  formatCustomerAddress,
  formatPreviewDate,
  formatPreviewMoney,
} from "~/features/pdf-template/pdf-template.client";
import pageStyles from "~/styles/pdf.module.css";

const styles = pageStyles;
type PreviewQuote = NonNullable<PdfTemplateData["latestQuote"]>;

type PdfTemplatePreviewProps = Pick<PdfTemplateData, "logoUrl" | "storeName" | "latestQuote" | "todayIso" | "dueDateIso"> & {
  settings: QuotePdfSetting;
};

export function PdfTemplatePreview({ settings, logoUrl, storeName, latestQuote, todayIso, dueDateIso }: PdfTemplatePreviewProps) {
  const customerAddress = latestQuote
    ? formatCustomerAddress(latestQuote.customerAddress, latestQuote.customerRegion, latestQuote.customerCountry)
    : "";
  const firstPageItems = latestQuote?.items.slice(0, 6) ?? [];
  const continuationPages = chunkItems(latestQuote?.items.slice(6) ?? [], 10);
  const pageCount = 1 + continuationPages.length;
  const paperStyle = {
    color: settings.textColor,
    fontFamily: settings.font,
    fontSize: `${settings.fontSize * 0.58}px`,
  };

  return (
    <aside className={styles.pdfPreviewPanel}>
      <div className={styles.pdfPreviewHeading}><div><h2>Preview</h2></div><s-badge tone="info">A4</s-badge></div>
      <div className={styles.pdfPaperWrap}>
        <article className={styles.pdfPaper} style={paperStyle}>
          <header className={styles.pdfPaperHeader}>
            <div className={styles.pdfDemoLogo} style={{ width: `${settings.logoSize + 26}px`, color: settings.primaryColor }}>
              {logoUrl ? <img src={logoUrl} alt="Store logo" /> : <><i>∞</i><span>YOUR STORE</span></>}
            </div>
            <h3 style={{ color: settings.primaryColor }}>QUOTE</h3>
          </header>
          <div className={styles.pdfMeta}>
            <div><strong>Request For Quote</strong><span>{storeName}</span></div>
            <dl>
              <div className={styles.pdfMetaRow}><dt>Quote #</dt><dd>{latestQuote?.quoteNumber ?? "—"}</dd></div>
              {settings.showQuoteDate && <div className={styles.pdfMetaRow}><dt>Quote date</dt><dd>{formatPreviewDate(latestQuote?.createdAt.slice(0, 10) ?? todayIso, settings.dateFormat)}</dd></div>}
              {settings.showDueDate && (latestQuote ? shouldShowQuoteDueDate(latestQuote.status, latestQuote.expiresAt) : Boolean(dueDateIso)) && (
                <div className={styles.pdfMetaRow}><dt>Due date</dt><dd>{formatPreviewDate(latestQuote?.expiresAt?.slice(0, 10) ?? dueDateIso, settings.dateFormat)}</dd></div>
              )}
            </dl>
          </div>
          {latestQuote ? (
            <>
              <div className={styles.pdfCustomer}>
                <strong>TO</strong><b>{latestQuote.customerName || "Customer"}</b>
                {latestQuote.customerEmail && <span>{latestQuote.customerEmail}</span>}
                {customerAddress && <span>{customerAddress}</span>}
              </div>
              <ProductTable items={firstPageItems} quote={latestQuote} settings={settings} />
              {settings.showTotal && continuationPages.length === 0 && <GrandTotal quote={latestQuote} color={settings.primaryColor} />}
            </>
          ) : <div className={styles.pdfEmptyPreview}>No quotes yet. Create a quote to preview real customer and product data.</div>}
          <footer>{pageCount === 1 ? "THANK YOU FOR YOUR BUSINESS!" : `Page 1 of ${pageCount}`}</footer>
        </article>

        {latestQuote && continuationPages.map((pageItems, pageIndex) => {
          const pageNumber = pageIndex + 2;
          const isLastPage = pageNumber === pageCount;
          return (
            <article className={`${styles.pdfPaper} ${styles.pdfContinuationPaper}`} key={pageNumber} style={paperStyle}>
              <header className={styles.pdfContinuationHeader}>
                <div>{logoUrl ? <img src={logoUrl} alt="Store logo" /> : <strong>{storeName}</strong>}</div>
                <span>Quote {latestQuote.quoteNumber} · Page {pageNumber} of {pageCount}</span>
              </header>
              <ProductTable items={pageItems} quote={latestQuote} settings={settings} />
              {settings.showTotal && isLastPage && <GrandTotal quote={latestQuote} color={settings.primaryColor} />}
              <footer>{isLastPage ? `THANK YOU FOR YOUR BUSINESS! · Page ${pageNumber} of ${pageCount}` : `Page ${pageNumber} of ${pageCount}`}</footer>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function ProductTable({ items, quote, settings }: { items: PreviewQuote["items"]; quote: PreviewQuote; settings: QuotePdfSetting }) {
  return (
    <table className={styles.pdfProductTable}>
      <thead style={{ background: settings.primaryColor, color: settings.productHeaderColor }}>
        <tr><th>Product</th><th>Qty</th>{settings.showOriginalPrice && <th>Price</th>}{settings.showUnitPrice && <th>Quote price</th>}{settings.showTotal && <th>Total</th>}</tr>
      </thead>
      <tbody>{items.map((item) => (
        <tr key={item.id}>
          <td><div className={styles.pdfProduct}>
            {settings.showImage && (item.imageUrl ? <img src={item.imageUrl} alt="" /> : <i />)}
            <span><b>{item.title}</b><small>{item.variantTitle || item.sku || ""}</small></span>
          </div></td>
          <td>{item.quantity}</td>
          {settings.showOriginalPrice && <td>{formatPreviewMoney(item.unitPrice, quote.currency)}</td>}
          {settings.showUnitPrice && <td>{formatPreviewMoney(item.quotePrice, quote.currency)}</td>}
          {settings.showTotal && <td>{formatPreviewMoney(item.quotePrice * item.quantity, quote.currency)}</td>}
        </tr>
      ))}</tbody>
    </table>
  );
}

function GrandTotal({ quote, color }: { quote: PreviewQuote; color: string }) {
  return <div className={styles.pdfGrandTotal}><span>TOTAL</span><strong style={{ color }}>{formatPreviewMoney(quote.quoteTotal, quote.currency)}</strong></div>;
}
