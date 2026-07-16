/**
 * Hardened SSRF allowlist — single source of truth for all Edge Functions.
 *
 * SECURITY: URLs are validated by parsing the real host with `new URL()` and
 * matching it against an exact host/suffix allowlist. Never validate a URL by
 * running a regex over the raw string — a pattern like `/^https:\/\/.*fal\.media\//`
 * matches `https://169.254.169.254/x.fal.media/`, letting an attacker put an
 * allowed domain in the PATH while pointing the HOST at an internal address.
 *
 * Any user-supplied URL that will be fetched server-side MUST pass isAllowedUrl().
 */

/** Base domains we trust. Matches the apex and any subdomain (e.g. v3.fal.media). */
const ALLOWED_HOSTS = [
  "supabase.co",              // Supabase Storage
  "fal.media",                // Fal.ai results (fal.media, v3.fal.media, ...)
  "fal.run",                  // Fal.ai CDN / queue
  "fal.ai",                   // Fal.ai
  "kie.ai",                   // NanoBanana / kie.ai
  "nanobanana.com",           // NanoBanana
  "googleapis.com",           // storage.googleapis.com, generativelanguage.googleapis.com
  "replicate.delivery",       // Replicate results CDN
  "openai.com",               // cdn.openai.com, DALL·E
  "blob.core.windows.net",    // Azure Blob (OpenAI DALL·E outputs)
];

/** True if `host` is exactly an allowed domain or a subdomain of one. */
function hostIsAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

/** Reject IPv4/IPv6 literals outright — every trusted source is a named domain. */
function isIpLiteral(host: string): boolean {
  // IPv4 dotted quad
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6 (bracketed in URLs, e.g. [::1]) — URL.hostname strips brackets
  if (host.includes(":")) return true;
  // Decimal / hex / octal integer forms of an IP (e.g. http://2130706433/)
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) return true;
  return false;
}

/**
 * Validate a URL is safe to fetch server-side (SSRF protection).
 * Accepts `data:image/...` inline images and https URLs to allowlisted hosts.
 */
export function isAllowedUrl(raw: unknown): boolean {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 5000) return false;

  // Inline base64 images are safe (no network request).
  if (raw.startsWith("data:image/")) return true;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }

  // Only https — blocks http, file:, gopher:, blob:, etc.
  if (u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase();
  if (!host || isIpLiteral(host)) return false;

  return hostIsAllowed(host);
}
