// Login, sessions, lockouts, password changes and "Sign in with Google".
import {
  DOMAIN, audit, clientIp, cookie, hashPassword, nowISO, parseCookies, passwordProblem,
  randomToken, sha256, verifyPassword,
} from "./util.js";

import { notify } from "./notify.js";

export const SESSION_COOKIE = "lna_session";
const SESSION_HOURS = 12;           // a login lasts one working day

const minutesFromNow = (m) => new Date(Date.now() + m * 60000).toISOString().replace(/\.\d{3}Z$/, "Z");

// ---- sessions --------------------------------------------------------------
// The browser holds a random token; the database holds only its SHA-256, so a
// leaked database can't be used to log in as anyone.
export async function createSession(env, request, userId) {
  const token = randomToken(32);
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(await sha256(token), userId, nowISO(), minutesFromNow(SESSION_HOURS * 60), clientIp(request),
    (request.headers.get("User-Agent") || "").slice(0, 200)).run();
  await env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(nowISO(), userId).run();
  return cookie(request, SESSION_COOKIE, token, { maxAge: SESSION_HOURS * 3600 });
}

export async function currentSession(env, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const id = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, s.created_at AS session_started, u.id, u.email, u.name, u.role, u.manager_id, u.must_change, u.active,
            u.joining_date, u.department, u.created_at AS user_created,
            (SELECT value FROM settings WHERE key = 'idle_minutes') AS idle_minutes
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  ).bind(id).first();
  if (!row) return null;
  // Signed out after a set time with no activity (Settings → idle sign-out),
  // and in any case 12 hours after signing in.
  const idleMin = Number(row.idle_minutes) || 60;
  const lastSeen = row.last_seen_at || row.session_started;
  if (row.expires_at < nowISO() || !row.active || lastSeen < minutesFromNow(-idleMin)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return null;
  }
  // Activity is recorded at most every 5 minutes, to keep database writes low.
  if (lastSeen < minutesFromNow(-5)) {
    await env.DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(nowISO(), id).run();
  }
  return row;
}

export async function endSession(env, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
  return cookie(request, SESSION_COOKIE, "", { maxAge: 0 });
}

export async function endAllSessions(env, userId, exceptSessionId = null) {
  if (exceptSessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").bind(userId, exceptSessionId).run();
  } else {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  }
}

// ---- Sign in with Google ---------------------------------------------------
// Standard OpenID Connect "authorization code" flow. Only verified
// @hexalis.in Google Workspace accounts that already have an /lna account
// get in: Google proves who you are, /lna decides whether you're allowed.
export function googleConfigured(env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

// Google's addresses. For automated tests on this Mac only, they can point at a
// local stand-in; anything other than localhost is ignored.
function googleUrls(env) {
  const local = (u) => { try { return ["localhost", "127.0.0.1"].includes(new URL(u).hostname) ? u : null; } catch { return null; } };
  return {
    auth: local(env.LNA_TEST_GOOGLE_AUTH_URL) || "https://accounts.google.com/o/oauth2/v2/auth",
    token: local(env.LNA_TEST_GOOGLE_TOKEN_URL) || "https://oauth2.googleapis.com/token",
  };
}

function callbackUrl(request) {
  return new URL("/lna/auth/google/callback", request.url).toString();
}

export async function googleStart(env, request) {
  const state = randomToken(24);
  await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < ?").bind(nowISO()).run();
  await env.DB.prepare("INSERT INTO oauth_states (state, expires_at) VALUES (?, ?)").bind(await sha256(state), minutesFromNow(10)).run();
  const url = new URL(googleUrls(env).auth);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    hd: DOMAIN,                 // Google shows only @hexalis.in accounts
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), setCookie: cookie(request, "lna_oauth", state, { maxAge: 600 }) };
}

export async function googleFinish(env, request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  const code = params.get("code");
  const cookieState = parseCookies(request).lna_oauth;
  if (!state || !code || !cookieState || state !== cookieState) return { error: "google_failed" };

  const stateRow = await env.DB.prepare("DELETE FROM oauth_states WHERE state = ? AND expires_at > ? RETURNING state")
    .bind(await sha256(state), nowISO()).first();
  if (!stateRow) return { error: "google_failed" };

  const tokenRes = await fetch(googleUrls(env).token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(request), grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return { error: "google_failed" };
  const { id_token } = await tokenRes.json();
  if (!id_token) return { error: "google_failed" };

  // The ID token came straight from Google over TLS in exchange for our
  // secret, so its signature doesn't need re-checking (OpenID Connect §3.1.3.7);
  // its claims still do.
  let claims;
  try {
    claims = JSON.parse(atob(id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return { error: "google_failed" }; }
  const email = String(claims.email || "").toLowerCase();
  const ok = claims.aud === env.GOOGLE_CLIENT_ID
    && ["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)
    && claims.exp * 1000 > Date.now()
    && claims.email_verified === true
    && claims.hd === DOMAIN
    && email.endsWith("@" + DOMAIN);
  if (!ok) return { error: "google_wrong_account" };

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user || !user.active) return { error: "google_no_account" };

  // First sign-in: take the person's full name from their Google account.
  if (!user.last_login_at && typeof claims.name === "string" && claims.name.trim()) {
    await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(claims.name.trim().slice(0, 80), user.id).run();
  }
  await audit(env, user.id, "login.google", { ip: clientIp(request) });
  return { user, setCookie: await createSession(env, request, user.id) };
}
