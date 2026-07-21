import pageStyles from "~/styles/quote-detail.module.css";

type QuoteInformationCardProps = {
  createdDate: string;
  currencyLabel: string;
  customerAddress: string;
  customerEmail: string;
  customerLabel: string;
  customerMarket: string;
  customerPhone: string;
  draftOrderAdminUrl: string;
  draftOrderName: string;
  orderAdminUrl: string;
  orderName: string;
  quoteNumber: string;
};

function ExternalAdminLink({ href, label }: { href: string; label: string }) {
  return href && label ? (
    <a href={href} rel="noreferrer" target="_blank">
      {label}
    </a>
  ) : (
    <>-</>
  );
}

export function QuoteInformationCard({
  createdDate,
  currencyLabel,
  customerAddress,
  customerEmail,
  customerLabel,
  customerMarket,
  customerPhone,
  draftOrderAdminUrl,
  draftOrderName,
  orderAdminUrl,
  orderName,
  quoteNumber,
}: QuoteInformationCardProps) {
  return (
    <section className={pageStyles.merchantInfoCard}>
      <div>
        <h2>Quote Information</h2>
        <dl>
          <dt>Quote ID:</dt>
          <dd>{quoteNumber}</dd>
          <dt>Draft Order:</dt>
          <dd><ExternalAdminLink href={draftOrderAdminUrl} label={draftOrderName} /></dd>
          <dt>Order:</dt>
          <dd><ExternalAdminLink href={orderAdminUrl} label={orderName} /></dd>
          <dt>Created date:</dt>
          <dd>{createdDate}</dd>
        </dl>
      </div>

      <div>
        <h2>Customer</h2>
        <p>{customerLabel}</p>
        <h3>Contact information</h3>
        <p>{customerEmail || "No email"}</p>
        <p>{customerPhone || "No phone"}</p>
        <h3>Markets</h3>
        <span className={pageStyles.merchantPill}>{customerMarket || "No market"}</span>
        <h3>Address</h3>
        <p>{customerAddress || "No address"}</p>
        <h3>Currency</h3>
        <span className={pageStyles.merchantPill}>{currencyLabel}</span>
      </div>
    </section>
  );
}
