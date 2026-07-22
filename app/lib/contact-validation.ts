export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value));
}

export function isValidE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}
