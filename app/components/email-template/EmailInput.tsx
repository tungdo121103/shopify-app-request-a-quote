import pageStyles from "~/styles/email.module.css";

const styles = pageStyles;

export function EmailInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: "text" | "email" }) {
  return (
    <label className={`${styles.emailField} ${styles.emailStructuredField}`}>
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}
