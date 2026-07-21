import pageStyles from "~/styles/quote-list.module.css";

const styles = pageStyles;

type QuoteDeleteDialogProps = {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function QuoteDeleteDialog({ label, onCancel, onConfirm }: QuoteDeleteDialogProps) {
  return (
    <div className={styles.managerConfirmOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }} role="presentation">
      <div aria-labelledby="delete-quote-title" aria-modal="true" className={styles.managerConfirmDialog} role="dialog">
        <h2 id="delete-quote-title">Delete quote?</h2>
        <p>Are you sure you want to delete <strong>{label}</strong>? This action cannot be undone.</p>
        <div className={styles.managerConfirmActions}>
          <button className={styles.managerConfirmCancel} onClick={onCancel} type="button">Cancel</button>
          <button className={styles.managerConfirmDelete} onClick={onConfirm} type="button">Delete</button>
        </div>
      </div>
    </div>
  );
}
