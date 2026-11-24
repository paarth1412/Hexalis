// Small shared helpers for /lna. No dependencies: Web Crypto only.

export const DOMAIN = "hexalis.in";
export const TZ = "Asia/Kolkata";

const enc = new TextEncoder();

export function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(str) {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(str)));
}

// Constant-time comparison, so response timing can't leak how much matched.
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// ---- passwords -----------------------------------------------------------
// PBKDF2-SHA256, 100,000 rounds (the maximum Cloudflare's runtime allows),
// unique random salt per password. Stored as  pbkdf2$100000$<salt>$<hash>.
// lna/scripts/people.mjs uses the identical scheme.
const PBKDF2_ROUNDS = 100000;

async function pbkdf2(password, salt, rounds) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ROUNDS);
  return `pbkdf2$${PBKDF2_ROUNDS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof password !== "string") return false;
  const [scheme, rounds, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const got = await pbkdf2(password, b64urlToBytes(salt), parseInt(rounds, 10));
  return safeEqual(b64url(got), hash);
}

// Temporary passwords: 12 characters from an alphabet without look-alikes
// (no 0/O, 1/l/I), shown as XXXX-XXXX-XXXX so it can be read out or typed.
export function tempPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const out = [];
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  for (const b of bytes) {
    if (b < 256 - (256 % alphabet.length)) out.push(alphabet[b % alphabet.length]);
    if (out.length === 12) break;
  }
  while (out.length < 12) out.push(alphabet[crypto.getRandomValues(new Uint8Array(1))[0] % alphabet.length]);
  return `${out.slice(0, 4).join("")}-${out.slice(4, 8).join("")}-${out.slice(8).join("")}`;
}

// The rules a new password must pass. Returned as a sentence, or null when fine.
export function passwordProblem(pw, { email, temp } = {}) {
  if (typeof pw !== "string" || pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 200) return "That password is too long.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use both letters and numbers.";
  // Compare letters and digits only, so "deepak.j" also catches "DeepakJ" and "deepak".
  const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const local = (email || "").split("@")[0];
  const pieces = [local, ...local.split(/[^A-Za-z0-9]+/)].map(flat).filter((x) => x.length >= 3);
  if (pieces.some((x) => flat(pw).includes(x))) return "Don't include your name or email in the password.";
  if (/hexalis/i.test(pw)) return "Don't include the company name in the password.";
  if (temp && pw === temp) return "Choose a new password, not the temporary one.";
  return null;
}

// ---- time (India) --------------------------------------------------------
export function nowISO() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
export function todayIST(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function isValidDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
export function addDays(s, n) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekday(s) {
  return new Date(s + "T00:00:00Z").getUTCDay(); // 0 = Sunday
}
// The working week (weekly days off) is set by the admin: see settings.js.

// ---- http ----------------------------------------------------------------
export function securityHeaders(nonce) {
  const csp = [
    "default-src 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}`,
    `style-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...securityHeaders() },
  });
}
export function htmlPage(body, nonce, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...securityHeaders(nonce), ...extraHeaders },
  });
}
export function redirect(location, extraHeaders = {}) {
  return new Response(null, { status: 303, headers: { Location: location, ...securityHeaders(), ...extraHeaders } });
}

export function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Secure is set whenever the site is served over https (always, once live).
export function cookie(request, name, value, { maxAge, path = "/lna", sameSite = "Lax" } = {}) {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, "HttpOnly", `SameSite=${sameSite}`];
  if (secure) parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "local";
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export async function audit(env, userId, action, detail) {
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, detail, at) VALUES (?, ?, ?, ?)")
    .bind(userId ?? null, action, detail ? JSON.stringify(detail) : null, nowISO()).run();
}

