import type { CSSProperties } from "react";
import { WidgetCartIcon } from "~/components/widget/WidgetCartIcon";
import type { PositionKey } from "~/components/widget/widget-admin.types";
import styles from "~/styles/widget-admin.module.css";
import type {
  WidgetAnimation,
  WidgetOrientation,
  WidgetSize,
  WidgetStyle,
} from "~/features/widget/widget-settings";

type WidgetPreviewPanelProps = {
  animation: WidgetAnimation;
  backgroundColor: string;
  buttonText: string;
  desktopPosition: PositionKey;
  iconDataUrl: string;
  mobilePosition: PositionKey;
  orientation: WidgetOrientation;
  previewDevice: "desktop" | "mobile";
  removeIcon: boolean;
  size: WidgetSize;
  textColor: string;
  widgetStyle: WidgetStyle;
  onPreviewDeviceChange: (value: "desktop" | "mobile") => void;
};

export function WidgetPreviewPanel(props: WidgetPreviewPanelProps) {
  const position = props.previewDevice === "desktop" ? props.desktopPosition : props.mobilePosition;
  const previewStyle = { "--widget-bg": props.backgroundColor, "--widget-color": props.textColor } as CSSProperties;

  return (
    <aside className={`${styles.settingsPanel} ${styles.widgetPreviewPanel}`}>
      <div className={styles.widgetSectionHeader}>
        <h2>Preview</h2>
        <p>Check how the widget appears before saving.</p>
      </div>
      <div className={styles.widgetPreviewTabs}>
        <button className={props.previewDevice === "desktop" ? styles.widgetPreviewTabActive : ""} onClick={() => props.onPreviewDeviceChange("desktop")} type="button">Desktop</button>
        <button className={props.previewDevice === "mobile" ? styles.widgetPreviewTabActive : ""} onClick={() => props.onPreviewDeviceChange("mobile")} type="button">Mobile</button>
      </div>
      <div className={`${styles.widgetPreviewFrame} ${props.previewDevice === "mobile" ? styles.widgetPreviewFrameMobile : ""}`}>
        <div
          className={`${styles.widgetPreviewButton} ${styles[`widgetPos_${position}`]} ${styles[`widgetSize_${props.size}`]} ${props.widgetStyle === "icon" ? styles.widgetPreviewButtonIcon : ""} ${props.widgetStyle === "icon" && props.iconDataUrl && !props.removeIcon ? styles.widgetPreviewButtonCustomIcon : ""} ${props.orientation === "vertical" && props.widgetStyle === "text" ? styles.widgetPreviewButtonVertical : ""} ${props.animation !== "none" ? styles[`widgetAnimation_${props.animation}`] : ""}`}
          style={previewStyle}
        >
          {props.widgetStyle === "icon" ? (
            props.iconDataUrl && !props.removeIcon ? <img alt="" className={styles.widgetPreviewIconImage} src={props.iconDataUrl} /> : <WidgetCartIcon />
          ) : <span>{props.buttonText || "Get Quote"}</span>}
          <em>1</em>
        </div>
      </div>
    </aside>
  );
}
