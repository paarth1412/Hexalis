// Entry point for everything under /lna. The public website never reaches this file.
import loginTpl from "../client/login.html";
import appTpl from "../client/app.html";
import STYLES from "../client/styles.js";
import { LOGO_SVG } from "./logo.js";
import {
  currentSession, endSession, googleConfigured, googleFinish, googleStart,
} from "./auth.js";
import { handleApi } from "./api.js";
import { background } from "./notify.js";
import { cookie, escapeHtml, htmlPage, json, randomToken, redirect } from "./util.js";

const MESSAGES = {
  signed_out: { kind: "ok", text: "You've signed out." },
  expired: { kind: "ok", text: "Your session ended. Sign in again to continue." },
  google_off: { kind: "err", text: "Sign in with Google isn't set up on this server yet. See lna/README.md." },
  google_failed: { kind: "err", text: "Google sign-in didn't complete. Please try again." },
  google_wrong_account: { kind: "err", text: "Use your @hexalis.in Google account." },
  google_no_account: { kind: "err", text: "That Google account doesn't have Leave & Attendance access. Ask your admin." },
};

function render(tpl, nonce, vars = {}) {
  // Function replacers, so a "$" in any value is inserted literally.
  let out = tpl.replaceAll("{{NONCE}}", () => nonce).replace("{{STYLES}}", () => STYLES).replaceAll("{{LOGO}}", () => LOGO_SVG);
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, () => v);
  return out;
}
function notice(msg) {
  return msg ? `<p class="notice notice--${msg.kind}" role="${msg.kind === "err" ? "alert" : "status"}">${escapeHtml(msg.text)}</p>` : "";
}
function loginPage(env, msg, status = 200) {
  const nonce = randomToken(16);
  return htmlPage(render(loginTpl, nonce, {
    NOTICE: notice(msg),
    GOOGLE_NOTE: googleConfigured(env) ? "" : `<p class="notice notice--err">Google sign-in isn't set up on this server yet, so nobody can sign in. The admin needs to add the Google keys (see lna/README.md).</p>`,
  }), nonce, status);
}

// Forms and API calls must come from this site. Browsers always send Origin
// on POST, so a request from any other website is refused (blocks CSRF).
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}

export async function handle(context) {
  const res = await route(context);
  // After answering: send due emails and the evening check-out reminder.
  if (context.env.DB && context.waitUntil) context.waitUntil(background(context.env, new URL(context.request.url).origin));
  return res;
}

async function route(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = (context.params.path || []).filter(Boolean);
  const [first, second, third] = parts;
  const method = request.method;

  if (method === "POST" && !sameOrigin(request)) return json({ error: "Request refused." }, 403);

  // ---- open to anyone: the sign-in screens ---------------------------------
  if (first === "login") {
    if (method === "GET") {
      if (await currentSession(env, request)) return redirect("/lna");
      return loginPage(env, MESSAGES[url.searchParams.get("m")]);
    }
  }
  if (first === "auth" && second === "google") {
    if (!googleConfigured(env)) return redirect("/lna/login?m=google_off");
    if (!third) {
      const { url: to, setCookie } = await googleStart(env, request);
      return redirect(to, { "Set-Cookie": setCookie });
    }
    if (third === "callback") {
      const result = await googleFinish(env, request);
      const clear = cookie(request, "lna_oauth", "", { maxAge: 0 });
      if (result.error) return redirect(`/lna/login?m=${result.error}`, { "Set-Cookie": clear });
      const headers = new Headers({ Location: "/lna" });
      headers.append("Set-Cookie", clear);
      headers.append("Set-Cookie", result.setCookie);
      return new Response(null, { status: 303, headers });
    }
  }
  if (first === "logout" && method === "POST") {
    return redirect("/lna/login?m=signed_out", { "Set-Cookie": await endSession(env, request) });
  }

  // ---- everything below needs a valid session ---------------------------------
  const me = await currentSession(env, request);
  if (!me) {
    if (first === "api") return json({ error: "signed_out" }, 401);
    return redirect("/lna/login");
  }

  if (first === "api") {
    if (method === "POST" && request.headers.get("X-LNA") !== "1") return json({ error: "Request refused." }, 403);
    return handleApi(env, request, me, parts.slice(1));
  }
  if (!first && method === "GET") {
    const nonce = randomToken(16);
    return htmlPage(render(appTpl, nonce), nonce);
  }
  return redirect("/lna");
}
