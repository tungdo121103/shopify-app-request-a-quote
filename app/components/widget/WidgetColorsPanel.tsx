import styles from "~/styles/widget-admin.module.css";

type WidgetColorsPanelProps = {
  backgroundColor: string;
  textColor: string;
  onBackgroundColorChange: (value: string) => void;
  onTextColorChange: (value: string) => void;
};

export function WidgetColorsPanel({ backgroundColor, textColor, onBackgroundColorChange, onTextColorChange }: WidgetColorsPanelProps) {
  return (
    <section className={`${styles.settingsPanel} ${styles.widgetPanel}`}>
      <div className={styles.widgetSectionHeader}>
        <h2>Brand colors</h2>
        <p>Match the quote widget with the merchant storefront.</p>
      </div>
      <div className={styles.widgetColorGrid}>
        <label className={styles.widgetColorField}>
          <span>Background Color</span>
          <em style={{ backgroundColor }} />
          <input name="widgetBackgroundColor" onChange={(event) => onBackgroundColorChange(event.target.value)} type="color" value={backgroundColor} />
          <input onChange={(event) => onBackgroundColorChange(event.target.value)} value={backgroundColor} />
        </label>
        <label className={styles.widgetColorField}>
          <span>Text/Icon Color</span>
          <em style={{ backgroundColor: textColor }} />
          <input name="widgetTextColor" onChange={(event) => onTextColorChange(event.target.value)} type="color" value={textColor} />
          <input onChange={(event) => onTextColorChange(event.target.value)} value={textColor} />
        </label>
      </div>
    </section>
  );
}
