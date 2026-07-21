import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { Buffer } from "node:buffer";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import {
  getQuoteSettings,
  normalizeWidgetSettingsForm,
  updateWidgetSettings,
} from "~/models/quote-setting.server";
import { authenticate } from "~/shopify.server";
import pageStyles from "~/styles/widget-admin.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

type PositionKey =
  | "top_left"
  | "top_center"
  | "top_right"
  | "middle_left"
  | "middle_center"
  | "middle_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right";

const desktopPositions: PositionKey[] = [
  "top_left",
  "top_center",
  "top_right",
  "middle_left",
  "middle_center",
  "middle_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
];

const mobilePositions: PositionKey[] = [
  "top_left",
  "top_center",
  "top_right",
  "middle_left",
  "middle_center",
  "middle_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getQuoteSettings(session.shop);

  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const input = normalizeWidgetSettingsForm(formData);
  input.widgetIconDataUrl = await resolveWidgetIconDataUrl(
    formData,
    input.widgetIconDataUrl,
  );
  await updateWidgetSettings(session.shop, input);

  return { ok: true, message: "Widget settings saved." };
};

async function resolveWidgetIconDataUrl(formData: FormData, fallback: string) {
  if (formData.get("removeWidgetIcon") === "on") return "";

  const file = formData.get("widgetIconFile");
  if (!(file instanceof File) || file.size === 0) return fallback;

  const allowedTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ]);
  if (!allowedTypes.has(file.type)) return fallback;
  if (file.size > 1_000_000) return fallback;

  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export default function WidgetPage() {
  const { settings } = useLoaderData<typeof loader>() as {
    settings: Awaited<ReturnType<typeof getQuoteSettings>>;
  };
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const formRef = useRef<HTMLFormElement>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [widgetStyle, setWidgetStyle] = useState(settings.widgetStyle);
  const [buttonText, setButtonText] = useState(settings.widgetButtonText);
  const [size, setSize] = useState(settings.widgetSize);
  const [orientation, setOrientation] = useState(settings.widgetOrientation);
  const [desktopPosition, setDesktopPosition] = useState(
    settings.widgetDesktopPosition as PositionKey,
  );
  const [mobilePosition, setMobilePosition] = useState(
    settings.widgetMobilePosition as PositionKey,
  );
  const [displayMode, setDisplayMode] = useState(settings.widgetDisplayMode);
  const [backgroundColor, setBackgroundColor] = useState(
    settings.widgetBackgroundColor,
  );
  const [textColor, setTextColor] = useState(settings.widgetTextColor);
  const [iconDataUrl, setIconDataUrl] = useState(settings.widgetIconDataUrl);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [animation, setAnimation] = useState(settings.widgetAnimation);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );

  useEffect(() => {
    if (!actionData) return;

    setToastVisible(true);
    const timeout = window.setTimeout(() => setToastVisible(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [actionData]);

  const previewStyle = useMemo(
    () =>
      ({
        "--widget-bg": backgroundColor,
        "--widget-color": textColor,
      }) as CSSProperties,
    [backgroundColor, textColor],
  );

  const currentPreviewPosition =
    previewDevice === "desktop" ? desktopPosition : mobilePosition;

  return (
    <main className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <p className={styles.kicker}>Request a Quote</p>
          <h1 className={styles.adminTitle}>Widget customization</h1>
        </div>
      </header>

      {actionData && toastVisible && (
        <div
          className={`${styles.quoteToast} ${
            actionData.ok ? styles.quoteToastSuccess : styles.quoteToastError
          }`}
          role="status"
        >
          {actionData.ok ? actionData.message : "Could not save widget settings."}
        </div>
      )}

      <Form
        ref={formRef}
        className={styles.widgetLayout}
        encType="multipart/form-data"
        method="post"
      >
        <section className={`${styles.settingsPanel} ${styles.widgetPanel}`}>
          <div className={styles.widgetSectionHeader}>
            <h2>Widget style</h2>
            <p>Choose icon or text style and tune the size.</p>
          </div>

          <div className={styles.widgetStyleGrid}>
            <label
              className={`${styles.widgetChoiceCard} ${
                widgetStyle === "icon" ? styles.widgetChoiceCardActive : ""
              }`}
            >
              <input
                aria-label="Circle and icon widget style"
                checked={widgetStyle === "icon"}
                name="widgetStyle"
                onChange={() => setWidgetStyle("icon")}
                type="radio"
                value="icon"
              />
              <span>
                <strong>Circle + Icon</strong>
                <small>Compact floating cart icon.</small>
              </span>
            </label>
            <label
              className={`${styles.widgetChoiceCard} ${
                widgetStyle === "text" ? styles.widgetChoiceCardActive : ""
              }`}
            >
              <input
                aria-label="Rectangle and text widget style"
                checked={widgetStyle === "text"}
                name="widgetStyle"
                onChange={() => setWidgetStyle("text")}
                type="radio"
                value="text"
              />
              <span>
                <strong>Rectangle + Text</strong>
                <small>Show a text button such as Get Quote.</small>
              </span>
            </label>
          </div>

          <div className={styles.widgetFormGrid}>
            <label className={styles.widgetField}>
              <span>Button text</span>
              <input
                maxLength={20}
                name="widgetButtonText"
                onChange={(event) => setButtonText(event.target.value)}
                value={buttonText}
              />
              <small>{buttonText.length}/20</small>
            </label>
            <label className={styles.widgetField}>
              <span>Size</span>
              <select
                name="widgetSize"
                onChange={(event) => setSize(event.target.value)}
                value={size}
              >
                <option value="small">Small (50px)</option>
                <option value="medium">Medium (60px)</option>
                <option value="large">Large (70px)</option>
              </select>
            </label>
            <label className={styles.widgetField}>
              <span>Orientation</span>
              <select
                name="widgetOrientation"
                onChange={(event) => setOrientation(event.target.value)}
                value={orientation}
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
            <label className={styles.widgetField}>
              <span>Animation</span>
              <select
                name="widgetAnimation"
                onChange={(event) => setAnimation(event.target.value)}
                value={animation}
              >
                <option value="none">None</option>
                <option value="pulse">Pulse</option>
                <option value="bounce">Bounce</option>
              </select>
            </label>
          </div>

          {widgetStyle === "icon" && (
            <div className={styles.widgetIconUpload}>
              <div>
                <span>Upload Icon</span>
                <small>PNG, JPG, GIF, WEBP, or SVG. Max 1MB.</small>
              </div>
              <div className={styles.widgetIconUploadControls}>
                <div
                  className={`${styles.widgetIconPreview} ${
                    iconDataUrl && !removeIcon
                      ? styles.widgetIconPreviewCustom
                      : ""
                  }`}
                >
                  {iconDataUrl && !removeIcon ? (
                    <img alt="" src={iconDataUrl} />
                  ) : (
                    <CartIcon />
                  )}
                </div>
                <label className={styles.secondaryButton}>
                  Upload
                  <input
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    hidden
                    name="widgetIconFile"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setIconDataUrl(String(reader.result || ""));
                        setRemoveIcon(false);
                      };
                      reader.readAsDataURL(file);
                    }}
                    type="file"
                  />
                </label>
                <label className={styles.widgetIconRemove}>
                  <input
                    checked={removeIcon}
                    name="removeWidgetIcon"
                    onChange={(event) => setRemoveIcon(event.target.checked)}
                    type="checkbox"
                  />
                  Remove
                </label>
              </div>
              <input
                name="widgetIconDataUrl"
                type="hidden"
                value={removeIcon ? "" : iconDataUrl}
              />
            </div>
          )}
        </section>

        <section className={`${styles.settingsPanel} ${styles.widgetPanel}`}>
          <div className={styles.widgetSectionHeader}>
            <h2>Position</h2>
            <p>Set independent positions for desktop and mobile.</p>
          </div>
          <div className={styles.widgetPositionGrid}>
            <PositionPicker
              label="Desktop Position"
              name="widgetDesktopPosition"
              onChange={setDesktopPosition}
              positions={desktopPositions}
              value={desktopPosition}
            />
            <PositionPicker
              label="Mobile Position"
              name="widgetMobilePosition"
              onChange={setMobilePosition}
              positions={mobilePositions}
              value={mobilePosition}
            />
          </div>
        </section>

        <section className={`${styles.settingsPanel} ${styles.widgetPanel}`}>
          <div className={styles.widgetSectionHeader}>
            <h2>Display options</h2>
            <p>Choose where the widget is shown on the storefront.</p>
          </div>
          <label className={styles.radioRow}>
            <input
              checked={displayMode === "all"}
              name="widgetDisplayMode"
              onChange={() => setDisplayMode("all")}
              type="radio"
              value="all"
            />
            <span>Show on all pages</span>
          </label>
          <label className={styles.radioRow}>
            <input
              checked={displayMode === "specific"}
              name="widgetDisplayMode"
              onChange={() => setDisplayMode("specific")}
              type="radio"
              value="specific"
            />
            <span>Specific pages</span>
          </label>
          <label
            className={`${styles.widgetField} ${styles.widgetFullField}`}
            hidden={displayMode !== "specific"}
          >
            <span>Page paths</span>
            <textarea
              defaultValue={settings.widgetSpecificPages ?? ""}
              name="widgetSpecificPages"
              placeholder="/products/snowboard&#10;/collections/wholesale"
              rows={3}
            />
            <small>One path per line. Example: /products/snowboard</small>
          </label>
        </section>

        <section className={`${styles.settingsPanel} ${styles.widgetPanel}`}>
          <div className={styles.widgetSectionHeader}>
            <h2>Brand colors</h2>
            <p>Match the quote widget with the merchant storefront.</p>
          </div>
          <div className={styles.widgetColorGrid}>
            <label className={styles.widgetColorField}>
              <span>Background Color</span>
              <em style={{ backgroundColor }} />
              <input
                name="widgetBackgroundColor"
                onChange={(event) => setBackgroundColor(event.target.value)}
                type="color"
                value={backgroundColor}
              />
              <input
                onChange={(event) => setBackgroundColor(event.target.value)}
                value={backgroundColor}
              />
            </label>
            <label className={styles.widgetColorField}>
              <span>Text/Icon Color</span>
              <em style={{ backgroundColor: textColor }} />
              <input
                name="widgetTextColor"
                onChange={(event) => setTextColor(event.target.value)}
                type="color"
                value={textColor}
              />
              <input
                onChange={(event) => setTextColor(event.target.value)}
                value={textColor}
              />
            </label>
          </div>
        </section>

        <aside className={`${styles.settingsPanel} ${styles.widgetPreviewPanel}`}>
          <div className={styles.widgetSectionHeader}>
            <h2>Preview</h2>
            <p>Check how the widget appears before saving.</p>
          </div>
          <div className={styles.widgetPreviewTabs}>
            <button
              className={previewDevice === "desktop" ? styles.widgetPreviewTabActive : ""}
              onClick={() => setPreviewDevice("desktop")}
              type="button"
            >
              Desktop
            </button>
            <button
              className={previewDevice === "mobile" ? styles.widgetPreviewTabActive : ""}
              onClick={() => setPreviewDevice("mobile")}
              type="button"
            >
              Mobile
            </button>
          </div>
          <div
            className={`${styles.widgetPreviewFrame} ${
              previewDevice === "mobile" ? styles.widgetPreviewFrameMobile : ""
            }`}
          >
            <div
              className={`${styles.widgetPreviewButton} ${
                styles[`widgetPos_${currentPreviewPosition}`]
              } ${styles[`widgetSize_${size}`]} ${
                widgetStyle === "icon" ? styles.widgetPreviewButtonIcon : ""
              } ${
                widgetStyle === "icon" && iconDataUrl && !removeIcon
                  ? styles.widgetPreviewButtonCustomIcon
                  : ""
              } ${
                orientation === "vertical" && widgetStyle === "text"
                  ? styles.widgetPreviewButtonVertical
                  : ""
              } ${animation !== "none" ? styles[`widgetAnimation_${animation}`] : ""}`}
              style={previewStyle}
            >
              {widgetStyle === "icon" ? (
                iconDataUrl && !removeIcon ? (
                  <img
                    alt=""
                    className={styles.widgetPreviewIconImage}
                    src={iconDataUrl}
                  />
                ) : (
                  <CartIcon />
                )
              ) : (
                <span>{buttonText || "Get Quote"}</span>
              )}
              <em>1</em>
            </div>
          </div>
        </aside>

        <div className={styles.widgetActions}>
          <s-button
            variant="primary"
            type="button"
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={() => formRef.current?.requestSubmit()}
          >
            Save widget
          </s-button>
        </div>
      </Form>
    </main>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5 6h1.6l1.15 8.25a2 2 0 0 0 1.98 1.75h6.7a2 2 0 0 0 1.93-1.48L20 8H7.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <circle cx="10" cy="20" fill="currentColor" r="1.3" />
      <circle cx="17" cy="20" fill="currentColor" r="1.3" />
    </svg>
  );
}

function PositionPicker({
  label,
  name,
  onChange,
  positions,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: PositionKey) => void;
  positions: PositionKey[];
  value: PositionKey;
}) {
  return (
    <fieldset className={styles.widgetPositionPicker}>
      <legend>{label}</legend>
      <div className={styles.widgetPositionMatrix}>
        {positions.map((position) => (
          <label key={position}>
            <input
              aria-label={`${label}: ${position.replaceAll("_", " ")}`}
              checked={value === position}
              name={name}
              onChange={() => onChange(position)}
              type="radio"
              value={position}
            />
            <span aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
