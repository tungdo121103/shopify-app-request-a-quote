import pageStyles from "~/styles/email.module.css";

const styles = pageStyles;

export function EmailPreviewPanel({ html, subject, preheader }: { html: string; subject: string; preheader: string }) {
  return (
    <section className={styles.emailPreviewPanel}>
      <div className={styles.emailPreviewHeader}>
        <div><strong>Email preview</strong><span>Buyer view</span></div>
        <s-badge>English</s-badge>
      </div>
      <div className={styles.emailClient}>
        <div className={styles.emailClientSubject}>
          <strong>Subject:</strong><span>{subject || "No subject"}</span>
          <span className={styles.emailClientPreheader}>— {preheader}</span>
        </div>
        <div className={styles.emailCanvas}>
          <div className={styles.emailCanvasContent} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </section>
  );
}
