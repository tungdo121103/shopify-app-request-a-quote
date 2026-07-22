import { useEffect, useRef, useState } from "react";
import { Form } from "react-router";
import { WidgetColorsPanel } from "~/components/widget/WidgetColorsPanel";
import { WidgetDisplayPanel } from "~/components/widget/WidgetDisplayPanel";
import { WidgetPositionPanel } from "~/components/widget/WidgetPositionPanel";
import { WidgetPreviewPanel } from "~/components/widget/WidgetPreviewPanel";
import { WidgetStylePanel } from "~/components/widget/WidgetStylePanel";
import type { PositionKey } from "~/components/widget/widget-admin.types";
import type { QuoteSettings } from "~/models/quote-setting.types";
import pageStyles from "~/styles/widget-admin.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

type WidgetAdminPageProps = {
  settings: QuoteSettings;
  actionData?: { ok: boolean; message: string };
  isSubmitting: boolean;
};

export function WidgetAdminPage({ settings, actionData, isSubmitting }: WidgetAdminPageProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [widgetStyle, setWidgetStyle] = useState(settings.widgetStyle);
  const [buttonText, setButtonText] = useState(settings.widgetButtonText);
  const [size, setSize] = useState(settings.widgetSize);
  const [orientation, setOrientation] = useState(settings.widgetOrientation);
  const [desktopPosition, setDesktopPosition] = useState(settings.widgetDesktopPosition as PositionKey);
  const [mobilePosition, setMobilePosition] = useState(settings.widgetMobilePosition as PositionKey);
  const [displayMode, setDisplayMode] = useState(settings.widgetDisplayMode);
  const [backgroundColor, setBackgroundColor] = useState(settings.widgetBackgroundColor);
  const [textColor, setTextColor] = useState(settings.widgetTextColor);
  const [iconDataUrl, setIconDataUrl] = useState(settings.widgetIconDataUrl);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [animation, setAnimation] = useState(settings.widgetAnimation);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (!actionData) return;
    setToastVisible(true);
    const timeout = window.setTimeout(() => setToastVisible(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [actionData]);

  return (
    <main className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <p className={styles.kicker}>Request a Quote</p>
          <h1 className={styles.adminTitle}>Widget customization</h1>
        </div>
      </header>

      {actionData && toastVisible && (
        <div className={`${styles.quoteToast} ${actionData.ok ? styles.quoteToastSuccess : styles.quoteToastError}`} role="status">
          {actionData.ok ? actionData.message : "Could not save widget settings."}
        </div>
      )}

      <Form ref={formRef} className={styles.widgetLayout} encType="multipart/form-data" method="post">
        <WidgetStylePanel
          animation={animation}
          buttonText={buttonText}
          iconDataUrl={iconDataUrl}
          orientation={orientation}
          removeIcon={removeIcon}
          size={size}
          widgetStyle={widgetStyle}
          onAnimationChange={setAnimation}
          onButtonTextChange={setButtonText}
          onIconChange={setIconDataUrl}
          onOrientationChange={setOrientation}
          onRemoveIconChange={setRemoveIcon}
          onSizeChange={setSize}
          onWidgetStyleChange={setWidgetStyle}
        />
        <WidgetPositionPanel
          desktopPosition={desktopPosition}
          mobilePosition={mobilePosition}
          onDesktopPositionChange={setDesktopPosition}
          onMobilePositionChange={setMobilePosition}
        />
        <WidgetDisplayPanel
          displayMode={displayMode}
          specificPages={settings.widgetSpecificPages ?? ""}
          onDisplayModeChange={setDisplayMode}
        />
        <WidgetColorsPanel
          backgroundColor={backgroundColor}
          textColor={textColor}
          onBackgroundColorChange={setBackgroundColor}
          onTextColorChange={setTextColor}
        />
        <WidgetPreviewPanel
          animation={animation}
          backgroundColor={backgroundColor}
          buttonText={buttonText}
          desktopPosition={desktopPosition}
          iconDataUrl={iconDataUrl}
          mobilePosition={mobilePosition}
          orientation={orientation}
          previewDevice={previewDevice}
          removeIcon={removeIcon}
          size={size}
          textColor={textColor}
          widgetStyle={widgetStyle}
          onPreviewDeviceChange={setPreviewDevice}
        />

        <div className={styles.widgetActions}>
          <s-button variant="primary" type="button" loading={isSubmitting} disabled={isSubmitting} onClick={() => formRef.current?.requestSubmit()}>
            Save widget
          </s-button>
        </div>
      </Form>
    </main>
  );
}
