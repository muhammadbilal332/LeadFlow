export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

/** Strips everything but digits, and a leading '+', so phones like "(555) 123-4567" and "555-123-4567" match. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 7 ? digits : null;
}
