import { useEffect, useRef, useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { PdfTemplateEditor } from "~/components/pdf-template/PdfTemplateEditor";
import { PdfTemplatePreview } from "~/components/pdf-template/PdfTemplatePreview";
import {
  loadPdfTemplate,
  savePdfTemplate,
} from "~/features/pdf-template/pdf-template.server";
import type { QuotePdfSetting } from "~/models/quote-pdf-setting.server";
import pageStyles from "~/styles/pdf.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

export const loader = loadPdfTemplate;
export const action = savePdfTemplate;

export default function PdfPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const [settings, setSettings] = useState(data.settings);
  const [toastVisible, setToastVisible] = useState(false);

  const updateSetting = <K extends keyof QuotePdfSetting>(
    key: K,
    value: QuotePdfSetting[K],
  ) => setSettings((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!actionData?.message) return;
    setToastVisible(true);
    const timeout = window.setTimeout(() => setToastVisible(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [actionData]);

  return (
    <s-page heading="PDF templates" inlineSize="large">
      {toastVisible && actionData?.message && (
        <div className={`${styles.quoteToast} ${styles.quoteToastSuccess}`} role="status">
          {actionData.message}
        </div>
      )}
      <Form ref={formRef} method="post" className={styles.pdfTemplateForm}>
        <div className={styles.pdfTemplateLayout}>
          <PdfTemplateEditor
            formRef={formRef}
            isSubmitting={navigation.state === "submitting"}
            onChange={updateSetting}
            settings={settings}
            todayIso={data.todayIso}
          />
          <PdfTemplatePreview
            dueDateIso={data.dueDateIso}
            latestQuote={data.latestQuote}
            logoUrl={data.logoUrl}
            settings={settings}
            storeName={data.storeName}
            todayIso={data.todayIso}
          />
        </div>
      </Form>
    </s-page>
  );
}
