import pageStyles from "~/styles/settings.module.css";

const styles = pageStyles;
export type EligibilityTab = "requesters" | "products";

export function EligibilityTabs({ activeTab, onChange }: { activeTab: EligibilityTab; onChange: (tab: EligibilityTab) => void }) {
  return (
    <div className={styles.settingsTabSwitch} role="tablist">
      <button aria-selected={activeTab === "requesters"} className={activeTab === "requesters" ? styles.settingsTabButtonActive : styles.settingsTabButton} onClick={() => onChange("requesters")} role="tab" type="button">
        Who can request quotes?
      </button>
      <button aria-selected={activeTab === "products"} className={activeTab === "products" ? styles.settingsTabButtonActive : styles.settingsTabButton} onClick={() => onChange("products")} role="tab" type="button">
        Product Eligibility
      </button>
    </div>
  );
}
