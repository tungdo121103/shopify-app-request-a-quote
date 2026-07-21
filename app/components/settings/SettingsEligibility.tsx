import { useState } from "react";
import { EligibilityTabs, type EligibilityTab } from "./EligibilityTabs";
import { ProductEligibilitySettings } from "./ProductEligibilitySettings";
import { RequesterEligibilitySettings } from "./RequesterEligibilitySettings";
import type { QuoteSettings } from "~/features/settings/quote-settings.server";
import pageStyles from "~/styles/settings.module.css";

const styles = pageStyles;

export function SettingsEligibility({ settings }: { settings: QuoteSettings }) {
  const [activeTab, setActiveTab] = useState<EligibilityTab>("requesters");

  return (
    <section className={`${styles.settingsPanel} ${styles.settingsAccessPanel}`}>
      <EligibilityTabs activeTab={activeTab} onChange={setActiveTab} />
      <RequesterEligibilitySettings settings={settings} hidden={activeTab !== "requesters"} />
      <ProductEligibilitySettings settings={settings} hidden={activeTab !== "products"} />
    </section>
  );
}
