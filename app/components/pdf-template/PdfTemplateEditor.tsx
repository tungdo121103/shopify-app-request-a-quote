import type { RefObject } from "react";
import { formatPreviewDate } from "~/features/pdf-template/pdf-template.client";
import type { QuotePdfSetting } from "~/models/quote-pdf-setting.server";
import pageStyles from "~/styles/pdf.module.css";

const styles = pageStyles;

type PdfTemplateEditorProps = {
  formRef: RefObject<HTMLFormElement | null>;
  isSubmitting: boolean;
  settings: QuotePdfSetting;
  todayIso: string;
  onChange: <K extends keyof QuotePdfSetting>(key: K, value: QuotePdfSetting[K]) => void;
};

export function PdfTemplateEditor({ formRef, isSubmitting, settings, todayIso, onChange }: PdfTemplateEditorProps) {
  return (
    <div className={styles.pdfTemplateEditor}>
      <section className={styles.pdfSettingsCard}>
        <div className={styles.pdfCardHeader}><h2>Content</h2></div>
        <fieldset className={styles.pdfFieldset}>
          <legend>Quote information</legend>
          <Checkbox name="showQuoteDate" label="Quote date" checked={settings.showQuoteDate} onChange={(checked) => onChange("showQuoteDate", checked)} />
          <Checkbox name="showDueDate" label="Due date" checked={settings.showDueDate} onChange={(checked) => onChange("showDueDate", checked)} />
          <label className={styles.pdfField}>
            <span>Date format</span>
            <select name="dateFormat" value={settings.dateFormat} onChange={(event) => onChange("dateFormat", event.currentTarget.value as QuotePdfSetting["dateFormat"])}>
              <option value="DD/MM/YYYY">DD/MM/YYYY ({formatPreviewDate(todayIso, "DD/MM/YYYY")})</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY ({formatPreviewDate(todayIso, "MM/DD/YYYY")})</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD ({formatPreviewDate(todayIso, "YYYY-MM-DD")})</option>
            </select>
          </label>
        </fieldset>
        <fieldset className={styles.pdfFieldset}>
          <legend>Product information</legend>
          <Checkbox name="showOriginalPrice" label="Original price" checked={settings.showOriginalPrice} onChange={(checked) => onChange("showOriginalPrice", checked)} />
          <Checkbox name="showUnitPrice" label="Quote price" checked={settings.showUnitPrice} onChange={(checked) => onChange("showUnitPrice", checked)} />
          <Checkbox name="showTotal" label="Total" checked={settings.showTotal} onChange={(checked) => onChange("showTotal", checked)} />
          <Checkbox name="showImage" label="Product image" checked={settings.showImage} onChange={(checked) => onChange("showImage", checked)} />
        </fieldset>
      </section>

      <section className={styles.pdfSettingsCard}>
        <div className={styles.pdfCardHeader}><h2>Design</h2></div>
        <label className={styles.pdfRangeField}>
          <span>Logo size <strong>{settings.logoSize}%</strong></span>
          <input name="logoSize" type="range" min="20" max="80" value={settings.logoSize} onChange={(event) => onChange("logoSize", Number(event.currentTarget.value))} />
        </label>
        <div className={styles.pdfDesignGrid}>
          <label className={styles.pdfField}>
            <span>Font</span>
            <select name="font" value={settings.font} onChange={(event) => onChange("font", event.currentTarget.value as QuotePdfSetting["font"])}>
              <option>Inter</option><option>Arial</option><option>Georgia</option>
            </select>
          </label>
          <label className={styles.pdfField}>
            <span>Font size</span>
            <input name="fontSize" type="number" min="10" max="16" value={settings.fontSize} onChange={(event) => onChange("fontSize", Number(event.currentTarget.value))} />
          </label>
        </div>
        <div className={styles.pdfColorGrid}>
          <ColorField name="primaryColor" label="Primary color" value={settings.primaryColor} onChange={(value) => onChange("primaryColor", value)} />
          <ColorField name="textColor" label="Text color" value={settings.textColor} onChange={(value) => onChange("textColor", value)} />
          <ColorField name="productHeaderColor" label="Product header text" value={settings.productHeaderColor} onChange={(value) => onChange("productHeaderColor", value)} />
        </div>
      </section>
      <div className={styles.pdfTemplateActions}>
        <s-button variant="primary" type="button" loading={isSubmitting} disabled={isSubmitting} onClick={() => formRef.current?.requestSubmit()}>
          Save template
        </s-button>
      </div>
    </div>
  );
}

function Checkbox({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className={styles.pdfCheckbox}><input name={name} type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} /><span>{label}</span></label>;
}

function ColorField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={styles.pdfColorField}>
      <input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
      <span><strong>{label}</strong><small>{value}</small></span>
      <input name={name} type="hidden" value={value} />
    </label>
  );
}
