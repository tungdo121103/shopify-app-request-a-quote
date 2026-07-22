import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { EmailInput } from "~/components/email-template/EmailInput";
import { EmailPreviewPanel } from "~/components/email-template/EmailPreviewPanel";
import {
  loadEmailTemplates,
  saveEmailTemplates,
  type EmailTemplateActionData,
  type EmailTemplateLoaderData,
} from "~/features/email-template/email-template.server";
import {
  emailTemplateMeta,
  renderPreview,
  renderStructuredPreview,
} from "~/features/email-template/email-preview";
import {
  emailTemplateKeys,
  emailTemplateLabels,
  defaultEmailPreheaders,
  defaultEmailSubjects,
  type QuoteEmailTemplateKey,
} from "~/models/quote-email.shared";
import type { QuoteEmailBranding } from "~/features/email/quote-email.server";
import {
  defaultEmailContent,
  defaultEmailDisplay,
  quoteEmailThemes,
} from "~/models/quote-email-config.shared";
import pageStyles from "~/styles/email.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

export const loader = loadEmailTemplates;
export const action = saveEmailTemplates;


export default function EmailPage() {
  const {
    selectedTemplate,
    branding: loadedBranding,
    previewItems,
    uploadedLogoUrl,
  } = useLoaderData<EmailTemplateLoaderData>();
  const actionData = useActionData<EmailTemplateActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submittingIntent = String(navigation.formData?.get("intent") ?? "");
  const isSendingTest = isSubmitting && submittingIntent === "send_test";
  const [activeTemplateKey, setActiveTemplateKey] = useState<QuoteEmailTemplateKey>(
    selectedTemplate,
  );
  const [branding, setBranding] = useState<QuoteEmailBranding>(loadedBranding);
  const [testEmail, setTestEmail] = useState("");
  const intentRef = useRef<HTMLInputElement>(null);
  const emailThemeRef = useRef<HTMLInputElement>(null);
  const editorFormRef = useRef<HTMLFormElement>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!actionData) return;
    setToastVisible(true);
    const timeout = window.setTimeout(() => setToastVisible(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [actionData]);

  useEffect(() => {
    setBranding(loadedBranding);
  }, [loadedBranding]);

  const previewHtml = useMemo(
    () => renderStructuredPreview(
      defaultEmailContent(activeTemplateKey),
      defaultEmailDisplay(activeTemplateKey),
      activeTemplateKey,
      branding,
      previewItems,
    ),
    [activeTemplateKey, branding, previewItems],
  );
  const previewSubject = useMemo(
    () => renderPreview(defaultEmailSubjects[activeTemplateKey]),
    [activeTemplateKey],
  );
  const previewPreheader = useMemo(
    () => renderPreview(defaultEmailPreheaders[activeTemplateKey]),
    [activeTemplateKey],
  );
  const activeMeta = emailTemplateMeta[activeTemplateKey];

  return (
    <s-page heading="Email templates" inlineSize="large">
      {actionData && actionData.intent !== "send_test" && toastVisible && (
        <div
          className={`${styles.quoteToast} ${
            actionData.ok ? styles.quoteToastSuccess : styles.quoteToastError
          }`}
          role="status"
        >
          {actionData.ok ? actionData.message : actionData.error}
        </div>
      )}

      <div className={styles.emailWorkspace}>
        <div className={styles.emailEditorCard}>
        <s-section padding="none">
          <Form ref={editorFormRef} method="post" encType="multipart/form-data">
            <input name="templateKey" type="hidden" value={activeTemplateKey} />
            <input ref={intentRef} name="intent" type="hidden" defaultValue="save" />
            <input name="brandingSenderName" type="hidden" value={branding.senderName} />
            <input name="brandingFallbackLogoUrl" type="hidden" value={uploadedLogoUrl} />
            <input name="brandingPrimaryColor" type="hidden" value={branding.primaryColor} />
            <input name="brandingLinkColor" type="hidden" value={branding.linkColor} />
            <input name="brandingSignature" type="hidden" value={branding.signature} />
            <input name="brandingReplyToEmail" type="hidden" value={branding.replyToEmail} />
            <input name="brandingFooterText" type="hidden" value={branding.footerText} />
            <input ref={emailThemeRef} name="emailTheme" type="hidden" value={branding.theme} />
            <input name="testEmail" type="hidden" value={testEmail} />

            <div className={styles.emailEditorHeader}>
              <div className={styles.emailTemplateSelect}>
                <s-button commandFor="email-template-menu" variant="secondary">
                  {`${activeMeta.step}. ${emailTemplateLabels[activeTemplateKey]}`}
                </s-button>
                <s-menu id="email-template-menu" accessibilityLabel="Choose automatic email template">
                  {emailTemplateKeys.map((key) => (
                    <s-button
                      key={key}
                      variant={activeTemplateKey === key ? "secondary" : "tertiary"}
                      icon={activeTemplateKey === key ? "check-circle" : undefined}
                      onClick={() => {
                        setActiveTemplateKey(key);
                        const url = new URL(window.location.href);
                        url.searchParams.set("templateKey", key);
                        window.history.replaceState({}, "", url);
                      }}
                    >
                      {`${emailTemplateMeta[key].step}. ${emailTemplateLabels[key]}`}
                    </s-button>
                  ))}
                </s-menu>
              </div>
              <s-badge tone="success">{activeMeta.trigger}</s-badge>
            </div>

            <div className={styles.emailEditorBody}>
              <div className={styles.emailDesignControls}>
                <s-button commandFor="email-design-menu" variant="secondary">
                  Choose another template
                </s-button>
                <s-menu id="email-design-menu" accessibilityLabel="Choose email design">
                  {quoteEmailThemes.map((theme) => (
                    <s-button
                      key={theme.key}
                      variant={branding.theme === theme.key ? "secondary" : "tertiary"}
                      icon={branding.theme === theme.key ? "check-circle" : undefined}
                      onClick={() => {
                        setBranding({ ...branding, theme: theme.key });
                        if (emailThemeRef.current) emailThemeRef.current.value = theme.key;
                        if (intentRef.current) intentRef.current.value = "save";
                        window.setTimeout(() => editorFormRef.current?.requestSubmit(), 0);
                      }}
                    >
                      {theme.label}
                    </s-button>
                  ))}
                </s-menu>
              </div>

              <div className={styles.emailLogoUpload}>
                <div className={styles.emailFieldHeading}>
                  <strong>Upload logo</strong>
                </div>
                <input
                  id="email-logo-file"
                  className={styles.emailLogoFileInput}
                  type="file"
                  name="logoFile"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={isSubmitting}
                  onChange={() => {
                    if (intentRef.current) intentRef.current.value = "upload_logo";
                    window.setTimeout(() => editorFormRef.current?.requestSubmit(), 0);
                  }}
                />
                <div
                  className={`${styles.emailLogoDropArea} ${
                    isSubmitting ? styles.emailLogoDropAreaDisabled : ""
                  }`}
                >
                  {uploadedLogoUrl ? (
                    <div className={styles.emailUploadedLogo}>
                      <img src={uploadedLogoUrl} alt="Uploaded email logo" />
                      <div className={styles.emailUploadedLogoDetails}>
                        <s-badge tone="success">Uploaded</s-badge>
                        <small>PNG, JPG or WebP; maximum 2 MB.</small>
                      </div>
                      <div className={styles.emailUploadedLogoActions}>
                        <label
                          htmlFor="email-logo-file"
                          className={styles.emailLogoChooseButton}
                        >
                          {isSubmitting && submittingIntent === "upload_logo"
                            ? "Uploading..."
                            : "Replace logo"}
                        </label>
                        <s-button
                          variant="tertiary"
                          tone="critical"
                          disabled={isSubmitting}
                          type="button"
                          onClick={() => {
                            if (intentRef.current) intentRef.current.value = "remove_logo";
                            editorFormRef.current?.requestSubmit();
                          }}
                        >
                          Remove
                        </s-button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label
                        htmlFor="email-logo-file"
                        className={styles.emailLogoChooseButton}
                      >
                        {isSubmitting && submittingIntent === "upload_logo"
                          ? "Uploading..."
                          : "Upload logo"}
                      </label>
                      <small>PNG, JPG or WebP; maximum 2 MB.</small>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.emailTestRow}>
                <div>
                <EmailInput
                  type="email"
                  label="Send test email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={setTestEmail}
                />
                </div>
                <s-button
                  variant="secondary"
                  disabled={isSubmitting}
                  type="button"
                  onClick={() => {
                    if (intentRef.current) intentRef.current.value = "send_test";
                    editorFormRef.current?.requestSubmit();
                  }}
                >
                  {isSendingTest ? "Sending..." : "Send test"}
                </s-button>
              </div>

              {actionData?.intent === "send_test" && (
                <div className={styles.emailInlineFeedback}>
                  <s-banner tone={actionData.ok ? "success" : "critical"}>
                    {actionData.ok ? actionData.message : actionData.error}
                  </s-banner>
                </div>
              )}

            </div>
          </Form>
        </s-section>
        </div>

        <EmailPreviewPanel html={previewHtml} preheader={previewPreheader} subject={previewSubject} />
      </div>
    </s-page>
  );
}
