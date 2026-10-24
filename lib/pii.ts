/**
 * pii — mask personal data before it is put on screen (decided 2026-10-24).
 *
 * Rule: emails and names are shown partially masked in the admin console and
 * anywhere one person could see another's details, and the signed-in user's
 * OWN email is masked too (it shows on shared screens and in screenshots).
 * Masking is display-only: values sent to the server, search, sign-in and the
 * data export still use the real value. A user's own display name is not
 * masked — it is what we greet them with.
 *
 * The bullet is U+2022, rendered as text so screen readers read "bullet"
 * rather than spelling out a hidden address.
 */

const DOT = "•";

/** "vijay.m@gmail.com" → "v•••@gmail.com". The domain stays: it says which
 *  account (Google, work) without identifying the person. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  if (at <= 0) return maskText(email);
  const local = email.slice(0, at);
  return `${local[0]}${DOT.repeat(3)}${email.slice(at)}`;
}

/** "Vijay Panwar" → "V••• P•••". Every word keeps only its first letter. */
export function maskName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => `${w[0]}${DOT.repeat(3)}`)
    .join(" ");
}

/** "+91 98765 43210" → "••••••••10". Only the last two digits survive. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 2) return DOT.repeat(4);
  return `${DOT.repeat(Math.max(4, digits.length - 2))}${digits.slice(-2)}`;
}

/** Anything else: first character, then dots. */
export function maskText(value: string | null | undefined): string {
  if (!value) return "";
  return `${value[0]}${DOT.repeat(3)}`;
}

/** A person's display label for someone ELSE's screen: masked name, or the
 *  masked email when there is no name. */
export function maskedPerson(name: string | null | undefined, email: string | null | undefined): string {
  return name ? maskName(name) : maskEmail(email) || "—";
}
