export type ExpirationSettingsErrors = Partial<
  Record<"quoteExpiresAfterDays" | "reminderBeforeExpireDays", string>
>;

export function validateExpirationSettingsForm(
  formData: FormData,
): ExpirationSettingsErrors {
  const errors: ExpirationSettingsErrors = {};
  const expiresValue = String(formData.get("quoteExpiresAfterDays") ?? "").trim();
  const reminderValue = String(formData.get("reminderBeforeExpireDays") ?? "").trim();
  const expiresAfterDays = Number(expiresValue);
  const reminderBeforeExpireDays = Number(reminderValue);

  if (!expiresValue || !Number.isInteger(expiresAfterDays) || expiresAfterDays < 1 || expiresAfterDays > 365) {
    errors.quoteExpiresAfterDays = "Enter a whole number between 1 and 365 days.";
  }
  if (!reminderValue || !Number.isInteger(reminderBeforeExpireDays) || reminderBeforeExpireDays < 0 || reminderBeforeExpireDays > 364) {
    errors.reminderBeforeExpireDays = "Enter a whole number between 0 and 364 days.";
  } else if (!errors.quoteExpiresAfterDays && reminderBeforeExpireDays >= expiresAfterDays) {
    errors.reminderBeforeExpireDays = "Reminder must be earlier than the quote expiration. Use 0 to disable it.";
  }
  return errors;
}
