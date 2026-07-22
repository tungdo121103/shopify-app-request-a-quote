import type { PositionKey } from "~/components/widget/widget-admin.types";
import { widgetPositions } from "~/components/widget/widget-admin.types";
import styles from "~/styles/widget-admin.module.css";

type WidgetPositionPanelProps = {
  desktopPosition: PositionKey;
  mobilePosition: PositionKey;
  onDesktopPositionChange: (value: PositionKey) => void;
  onMobilePositionChange: (value: PositionKey) => void;
};

export function WidgetPositionPanel(props: WidgetPositionPanelProps) {
  return (
    <section className={`${styles.settingsPanel} ${styles.widgetPanel}`}>
      <div className={styles.widgetSectionHeader}>
        <h2>Position</h2>
        <p>Set independent positions for desktop and mobile.</p>
      </div>
      <div className={styles.widgetPositionGrid}>
        <PositionPicker label="Desktop Position" name="widgetDesktopPosition" onChange={props.onDesktopPositionChange} value={props.desktopPosition} />
        <PositionPicker label="Mobile Position" name="widgetMobilePosition" onChange={props.onMobilePositionChange} value={props.mobilePosition} />
      </div>
    </section>
  );
}

function PositionPicker({ label, name, onChange, value }: { label: string; name: string; onChange: (value: PositionKey) => void; value: PositionKey }) {
  return (
    <fieldset className={styles.widgetPositionPicker}>
      <legend>{label}</legend>
      <div className={styles.widgetPositionMatrix}>
        {widgetPositions.map((position) => (
          <label key={position}>
            <input aria-label={`${label}: ${position.replaceAll("_", " ")}`} checked={value === position} name={name} onChange={() => onChange(position)} type="radio" value={position} />
            <span aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
