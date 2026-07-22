import styles from "~/styles/widget-admin.module.css";
import type { WidgetDisplayMode } from "~/features/widget/widget-settings";

type WidgetDisplayPanelProps = {
  displayMode: WidgetDisplayMode;
  specificPages: string;
  onDisplayModeChange: (value: WidgetDisplayMode) => void;
};

export function WidgetDisplayPanel({ displayMode, specificPages, onDisplayModeChange }: WidgetDisplayPanelProps) {
  return (
    <section className={`${styles.settingsPanel} ${styles.widgetPanel}`}>
      <div className={styles.widgetSectionHeader}>
        <h2>Display options</h2>
        <p>Choose where the widget is shown on the storefront.</p>
      </div>
      <label className={styles.radioRow}>
        <input checked={displayMode === "all"} name="widgetDisplayMode" onChange={() => onDisplayModeChange("all")} type="radio" value="all" />
        <span>Show on all pages</span>
      </label>
      <label className={styles.radioRow}>
        <input checked={displayMode === "specific"} name="widgetDisplayMode" onChange={() => onDisplayModeChange("specific")} type="radio" value="specific" />
        <span>Specific pages</span>
      </label>
      <label className={`${styles.widgetField} ${styles.widgetFullField}`} hidden={displayMode !== "specific"}>
        <span>Page paths</span>
        <textarea defaultValue={specificPages} name="widgetSpecificPages" placeholder="/products/snowboard&#10;/collections/wholesale" rows={3} />
        <small>One path per line. Example: /products/snowboard</small>
      </label>
    </section>
  );
}
