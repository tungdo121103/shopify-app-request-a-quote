import type { QuoteSettings } from "~/features/settings/quote-settings.server";
import type { ReactNode } from "react";
import pageStyles from "~/styles/settings.module.css";

const styles = pageStyles;

type ExpirationFieldErrors = {
  quoteExpiresAfterDays?: string;
  reminderBeforeExpireDays?: string;
};

type QuoteExpirationSettingsProps = {
  settings: QuoteSettings;
  fieldErrors?: ExpirationFieldErrors;
};

export function QuoteExpirationSettings({ settings, fieldErrors }: QuoteExpirationSettingsProps) {
  return (
    <section className={`${styles.settingsPanel} ${styles.expirationPanel}`}>
      <h2>Quote Expiration</h2>
      <ExpirationField
        defaultValue={settings.quoteExpiresAfterDays}
        error={fieldErrors?.quoteExpiresAfterDays}
        id="quoteExpiresAfterDays"
        label="Quote expire after"
        max={365}
        suffix="day(s)"
      >
        Quotes will automatically expire if the customer does not respond
        (Accept/ Decline) within the specified number of days, counted from the
        last time the quote was sent. A reminder email will be sent before the
        expiration date if configured.
      </ExpirationField>
      <ExpirationField
        defaultValue={settings.reminderBeforeExpireDays}
        error={fieldErrors?.reminderBeforeExpireDays}
        id="reminderBeforeExpireDays"
        label="Quote reminders send before"
        max={364}
        min={0}
        suffix="day(s) before expiration"
      >
        Example: If the quote is sent on Oct 1, with expiry set to 7 days and
        reminder set to 3 days, the quote will expire on Oct 8 and a reminder
        email will be sent on Oct 5. Enter 0 to disable reminder emails.
      </ExpirationField>
    </section>
  );
}

type ExpirationFieldProps = {
  children: ReactNode;
  defaultValue: number;
  error?: string;
  id: string;
  label: string;
  max: number;
  min?: number;
  suffix: string;
};

function ExpirationField({ children, defaultValue, error, id, label, max, min = 1, suffix }: ExpirationFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.expirationField}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.suffixInput}>
        <input defaultValue={defaultValue} id={id} aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} max={max} min={min} name={id} required step={1} type="number" />
        <span>{suffix}</span>
      </div>
      {error && <p className={styles.settingsFieldError} id={errorId} role="alert">{error}</p>}
      <p>{children}</p>
    </div>
  );
}
