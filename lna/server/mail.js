// Email notifications. Messages are queued in the outbox table and sent in the
// background over SMTP (works with Google Workspace, Zoho, Microsoft 365, Brevo…).
//
// Settings come from environment variables (.dev.vars locally, encrypted
// secrets on Cloudflare once live), never from the database:
//   SMTP_HOST   e.g. smtp.gmail.com
//   SMTP_PORT   465 (TLS) or 587 (STARTTLS); 25/2525 plain is for local testing only
//   SMTP_USER   the mailbox that sends, e.g. noreply@hexalis.in
//   SMTP_PASS   its app password
//   MAIL_FROM   optional, defaults to SMTP_USER
//   SITE_URL    optional, e.g. https://hexalis.in (used for links in emails)
import { connect } from "cloudflare:sockets";
import { nowISO } from "./util.js";

const BACKOFF_MIN = [1, 5, 15, 60, 240];        // minutes between attempts
const MAX_TRIES = BACKOFF_MIN.length + 1;
const EXPIRE_HOURS = 24;                         // a notification older than this isn't worth sending
const BATCH = 5;

export function mailConfigured(env) {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}
export function mailInfo(env) {
  return mailConfigured(env)
    ? { configured: true, host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465), from: env.MAIL_FROM || env.SMTP_USER }
    : { configured: false };
}
const later = (min) => new Date(Date.now() + min * 60000).toISOString().replace(/\.\d{3}Z$/, "Z");
const oneLine = (s) => String(s).replace(/[\r\n]+/g, " ").trim();

// ---- queue -----------------------------------------------------------------------
// Set when this server instance queues an email, so it's sent right after the response.
export const queueState = { fresh: false };

export async function enqueue(env, { userId = null, to, subject, body, link = null }) {
  await env.DB.prepare("INSERT INTO outbox (user_id, to_addr, subject, body, link, next_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(userId, oneLine(to), oneLine(subject).slice(0, 150), String(body).slice(0, 4000), link, nowISO(), nowISO()).run();
  queueState.fresh = true;
}

// Sends what's due. Called after responses (context.waitUntil), so nobody waits on it.
export async function processOutbox(env, origin) {
  const now = nowISO();
  await env.DB.prepare("UPDATE outbox SET status = 'expired', error = 'Not sent within 24 hours' WHERE status IN ('pending','sending') AND created_at < ?")
    .bind(later(-EXPIRE_HOURS * 60)).run();
  // A send that crashed half-way is retried after 5 minutes.
  await env.DB.prepare("UPDATE outbox SET status = 'pending' WHERE status = 'sending' AND next_at < ?").bind(later(-5)).run();
  if (!mailConfigured(env)) return;
  if (!(await env.DB.prepare("SELECT 1 FROM outbox WHERE status = 'pending' AND next_at <= ? LIMIT 1").bind(now).first())) return;
  // One sender at a time: overlapping runs would open parallel connections.
  const lock = await env.DB.prepare("UPDATE settings SET value = ? WHERE key = 'outbox_lock' AND value < ? RETURNING key").bind(now, later(-1)).first();
  if (!lock) return;
  try { await sendDue(env, origin, now); }
  finally { await env.DB.prepare("UPDATE settings SET value = '' WHERE key = 'outbox_lock'").run(); }
}

async function sendDue(env, origin, now) {
  const { results } = await env.DB.prepare("SELECT id FROM outbox WHERE status = 'pending' AND next_at <= ? ORDER BY id LIMIT ?").bind(now, BATCH).all();
  const site = (env.SITE_URL || origin).replace(/\/$/, "");
  for (const { id } of results) {
    // Claim the row, so two overlapping runs never send the same email twice.
    const row = await env.DB.prepare("UPDATE outbox SET status = 'sending', tries = tries + 1, next_at = ? WHERE id = ? AND status = 'pending' RETURNING *")
      .bind(now, id).first();
    if (!row) continue;
    try {
      await sendMail(env, { to: row.to_addr, subject: row.subject, text: textBody(row, site), html: htmlBody(row, site) });
      await env.DB.prepare("UPDATE outbox SET status = 'sent', sent_at = ?, error = NULL WHERE id = ?").bind(nowISO(), id).run();
    } catch (e) {
      const msg = String(e.message || e).slice(0, 300);
      const permanent = /^5\d\d/.test(msg) && !/^5(30|35)/.test(msg);   // e.g. 550 no such mailbox (but not a login problem we can fix)
      const done = permanent || row.tries >= MAX_TRIES;
      await env.DB.prepare("UPDATE outbox SET status = ?, error = ?, next_at = ? WHERE id = ?")
        .bind(done ? "failed" : "pending", msg, later(BACKOFF_MIN[row.tries - 1] || 240), id).run();
      if (/^5(30|35)|ECONN|refused|timed out|TLS|closed|cancel/i.test(msg)) break;   // the server or login is the problem: stop this round
    }
  }
}

// ---- message ------------------------------------------------------------------------
const tabUrl = (site, link) => `${site}/lna${link ? "#" + link : ""}`;
function textBody(row, site) {
  return `${row.body}\n\nOpen Leave & Attendance: ${tabUrl(site, row.link)}\n\n—\nHEXALIS Leave & Attendance. You can turn these emails off under Account.`;
}
function htmlBody(row, site) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const paras = esc(row.body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f3f9fa;font-family:Arial,Helvetica,sans-serif;color:#1f2433">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dce6e8">
<tr><td style="padding:18px 24px;border-bottom:3px solid #4fe4f2;font-weight:bold;letter-spacing:2px">HEXALIS <span style="font-weight:normal;letter-spacing:0;color:#6a7682">· Leave &amp; Attendance</span></td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${paras}
<a href="${esc(tabUrl(site, row.link))}" style="display:inline-block;margin-top:6px;padding:12px 20px;background:#4fe4f2;color:#1f2433;font-weight:bold;text-decoration:none">Open Leave &amp; Attendance</a></td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #dce6e8;font-size:12px;color:#6a7682">You can turn these emails off under Account.</td></tr>
</table></td></tr></table></body></html>`;
}

const enc = new TextEncoder();
function b64(str) {
  let s = "";
  for (const b of enc.encode(str)) s += String.fromCharCode(b);
  return btoa(s);
}
const wrap76 = (s) => s.replace(/.{1,76}/g, "$&\r\n");
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

function buildMessage({ from, to, subject, text, html }) {
  const boundary = "lna-" + crypto.randomUUID();
  const domain = from.split("@")[1] || "hexalis.in";
  return [
    `From: ${encodeHeader("HEXALIS Leave & Attendance")} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "Auto-Submitted: auto-generated",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(html)),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

// ---- SMTP ---------------------------------------------------------------------------
class Smtp {
  constructor(socket) { this.use(socket); this.buf = ""; }
  use(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.dec = new TextDecoder();
  }
  async reply() {
    // A reply is one or more lines; the last has a space after the code ("250 OK").
    for (;;) {
      const m = this.buf.match(/^(?:\d{3}-[^\r\n]*\r?\n)*(\d{3})(?: [^\r\n]*)?\r?\n/);
      if (m) { this.buf = this.buf.slice(m[0].length); return { code: Number(m[1]), text: m[0].trim() }; }
      const { value, done } = await this.reader.read();
      if (done) throw new Error("The mail server closed the connection.");
      this.buf += this.dec.decode(value, { stream: true });
    }
  }
  async cmd(line, expect, hide) {
    if (line !== null) await this.writer.write(enc.encode(line + "\r\n"));
    const r = await this.reply();
    if (!expect.includes(r.code)) throw new Error(`${r.text.split("\n").pop().slice(0, 200)}${hide ? "" : ` (after ${line ? line.split(" ")[0] : "connecting"})`}`);
    return r;
  }
  async close() { try { await this.writer.write(enc.encode("QUIT\r\n")); } catch {} try { await this.socket.close(); } catch {} }
}

export async function sendMail(env, { to, subject, text, html }) {
  const host = env.SMTP_HOST, port = Number(env.SMTP_PORT || 465);
  const from = oneLine(env.MAIL_FROM || env.SMTP_USER);
  to = oneLine(to);
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(to) || !/^[^\s@<>]+@[^\s@<>]+$/.test(from)) throw new Error("Bad email address.");
  const mode = port === 465 ? "on" : port === 587 ? "starttls" : "off";
  const work = (async () => {
    const s = new Smtp(connect({ hostname: host, port }, { secureTransport: mode, allowHalfOpen: false }));
    try {
      await s.cmd(null, [220]);
      let ehlo = await s.cmd("EHLO hexalis.in", [250]);
      if (mode === "starttls") {
        await s.cmd("STARTTLS", [220]);
        s.reader.releaseLock(); s.writer.releaseLock();
        s.use(s.socket.startTls());
        s.buf = "";
        ehlo = await s.cmd("EHLO hexalis.in", [250]);
      }
      if (/AUTH[ =][^\r\n]*PLAIN/i.test(ehlo.text)) {
        await s.cmd("AUTH PLAIN " + b64(`\0${env.SMTP_USER}\0${env.SMTP_PASS}`), [235], true);
      } else {
        await s.cmd("AUTH LOGIN", [334]);
        await s.cmd(b64(env.SMTP_USER), [334], true);
        await s.cmd(b64(env.SMTP_PASS), [235], true);
      }
      await s.cmd(`MAIL FROM:<${from}>`, [250]);
      await s.cmd(`RCPT TO:<${to}>`, [250, 251]);
      await s.cmd("DATA", [354]);
      const msg = buildMessage({ from, to, subject: oneLine(subject), text, html }).replace(/^\./gm, "..");  // dot-stuffing
      await s.writer.write(enc.encode(msg + "\r\n.\r\n"));
      await s.cmd(null, [250]);
    } finally { await s.close(); }
  })();
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("The mail server timed out.")), 20000); });
  try { await Promise.race([work, timeout]); } finally { clearTimeout(timer); }
}
