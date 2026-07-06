// Open-redirect guard for the ?callbackUrl= param on /login and /register
// (Phase C.2). Only a relative path within this site is honored — anything
// else (absolute URLs, protocol-relative "//evil.com", backslash variants the
// browser would normalize to "//") falls back to the default destination.

export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/account",
): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
