import { useEffect, useRef, useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { QuoteExpirationSettings } from "~/components/settings/QuoteExpirationSettings";
import { SettingsEligibility } from "~/components/settings/SettingsEligibility";
import {
  loadQuoteSettings,
  saveQuoteSettings,
  type QuoteSettings,
} from "~/features/settings/quote-settings.server";
import pageStyles from "~/styles/settings.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

export const loader = loadQuoteSettings;
export const action = saveQuoteSettings;

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>() as { settings: QuoteSettings };
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);

  useEffect(() => {
    if (!actionData) return;
    setIsToastVisible(true);
    const timeout = window.setTimeout(() => setIsToastVisible(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [actionData]);

  const isSubmitting = navigation.state === "submitting";

  return (
    <main className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div><p className={styles.kicker}>Request a Quote</p><h1 className={styles.adminTitle}>Quote settings</h1></div>
      </header>
      {actionData && isToastVisible && (
        <div className={`${styles.quoteToast} ${actionData.ok ? styles.quoteToastSuccess : styles.quoteToastError}`} role="status">
          {actionData.message}
        </div>
      )}
      <Form ref={formRef} method="post">
        <SettingsEligibility settings={settings} />
        <QuoteExpirationSettings fieldErrors={actionData?.fieldErrors} settings={settings} />
        <div className={styles.settingsActions}>
          <s-button variant="primary" type="button" loading={isSubmitting} disabled={isSubmitting} onClick={() => formRef.current?.requestSubmit()}>
            Save settings
          </s-button>
        </div>
      </Form>
    </main>
  );
}
