import { WidgetCartIcon } from "~/components/widget/WidgetCartIcon";
import styles from "~/styles/widget-admin.module.css";
import type {
  WidgetAnimation,
  WidgetOrientation,
  WidgetSize,
  WidgetStyle,
} from "~/features/widget/widget-settings";

type WidgetStylePanelProps = {
  animation: WidgetAnimation;
  buttonText: string;
  iconDataUrl: string;
  orientation: WidgetOrientation;
  removeIcon: boolean;
  size: WidgetSize;
  widgetStyle: WidgetStyle;
  onAnimationChange: (value: WidgetAnimation) => void;
  onButtonTextChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onOrientationChange: (value: WidgetOrientation) => void;
  onRemoveIconChange: (value: boolean) => void;
  onSizeChange: (value: WidgetSize) => void;
  onWidgetStyleChange: (value: WidgetStyle) => void;
};

export function WidgetStylePanel({
  animation,
  buttonText,
  iconDataUrl,
  orientation,
  removeIcon,
  size,
  widgetStyle,
  onAnimationChange,
  onButtonTextChange,
  onIconChange,
  onOrientationChange,
  onRemoveIconChange,
  onSizeChange,
  onWidgetStyleChange,
}: WidgetStylePanelProps) {
  const selectIcon = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onIconChange(String(reader.result || ""));
      onRemoveIconChange(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className={`${styles.settingsPanel} ${styles.widgetPanel}`}>
      <div className={styles.widgetSectionHeader}>
        <h2>Widget style</h2>
        <p>Choose icon or text style and tune the size.</p>
      </div>

      <div className={styles.widgetStyleGrid}>
        <label className={`${styles.widgetChoiceCard} ${widgetStyle === "icon" ? styles.widgetChoiceCardActive : ""}`}>
          <input aria-label="Circle and icon widget style" checked={widgetStyle === "icon"} name="widgetStyle" onChange={() => onWidgetStyleChange("icon")} type="radio" value="icon" />
          <span><strong>Circle + Icon</strong><small>Compact floating cart icon.</small></span>
        </label>
        <label className={`${styles.widgetChoiceCard} ${widgetStyle === "text" ? styles.widgetChoiceCardActive : ""}`}>
          <input aria-label="Rectangle and text widget style" checked={widgetStyle === "text"} name="widgetStyle" onChange={() => onWidgetStyleChange("text")} type="radio" value="text" />
          <span><strong>Rectangle + Text</strong><small>Show a text button such as Get Quote.</small></span>
        </label>
      </div>

      <div className={styles.widgetFormGrid}>
        <label className={styles.widgetField}>
          <span>Button text</span>
          <input maxLength={20} name="widgetButtonText" onChange={(event) => onButtonTextChange(event.target.value)} value={buttonText} />
          <small>{buttonText.length}/20</small>
        </label>
        <label className={styles.widgetField}>
          <span>Size</span>
          <select name="widgetSize" onChange={(event) => onSizeChange(event.target.value as WidgetSize)} value={size}>
            <option value="small">Small (50px)</option>
            <option value="medium">Medium (60px)</option>
            <option value="large">Large (70px)</option>
          </select>
        </label>
        <label className={styles.widgetField}>
          <span>Orientation</span>
          <select name="widgetOrientation" onChange={(event) => onOrientationChange(event.target.value as WidgetOrientation)} value={orientation}>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </label>
        <label className={styles.widgetField}>
          <span>Animation</span>
          <select name="widgetAnimation" onChange={(event) => onAnimationChange(event.target.value as WidgetAnimation)} value={animation}>
            <option value="none">None</option>
            <option value="pulse">Pulse</option>
            <option value="bounce">Bounce</option>
          </select>
        </label>
      </div>

      {widgetStyle === "icon" && (
        <div className={styles.widgetIconUpload}>
          <div><span>Upload Icon</span><small>PNG, JPG, GIF, WEBP, or SVG. Max 1MB.</small></div>
          <div className={styles.widgetIconUploadControls}>
            <div className={`${styles.widgetIconPreview} ${iconDataUrl && !removeIcon ? styles.widgetIconPreviewCustom : ""}`}>
              {iconDataUrl && !removeIcon ? <img alt="" src={iconDataUrl} /> : <WidgetCartIcon />}
            </div>
            <label className={styles.secondaryButton}>
              Upload
              <input accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" hidden name="widgetIconFile" onChange={(event) => selectIcon(event.target.files?.[0])} type="file" />
            </label>
            <label className={styles.widgetIconRemove}>
              <input checked={removeIcon} name="removeWidgetIcon" onChange={(event) => onRemoveIconChange(event.target.checked)} type="checkbox" />
              Remove
            </label>
          </div>
          <input name="widgetIconDataUrl" type="hidden" value={removeIcon ? "" : iconDataUrl} />
        </div>
      )}
    </section>
  );
}
