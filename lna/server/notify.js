// Notifications: the in-app bell, plus an email when it's worth one.
import { nowISO, todayIST } from "./util.js";
import { enqueue, processOutbox, queueState } from "./mail.js";
import { loadSettings, nowMinutesIST } from "./settings.js";

// userIds may repeat or include nulls; each person gets one copy.
//   email:    { subject, body? } to also email it (body defaults to the text)
//   security: true to email even if the person turned emails off
export async function notify(env, userIds, text, link = null, { email = null, security = false, inApp = true } = {}) {
  const at = nowISO();
  for (const id of new Set(userIds.filter(Boolean))) {
    if (inApp) {
      await env.DB.prepare("INSERT INTO notifications (user_id, text, link, created_at) VALUES (?, ?, ?, ?)").bind(id, text, link, at).run();
    }
    if (!email) continue;
    const u = await env.DB.prepare("SELECT email, name, active, email_notify FROM users WHERE id = ?").bind(id).first();
    if (!u || (!u.active && !security) || (!u.email_notify && !security)) continue;
    await enqueue(env, { userId: id, to: u.email, subject: email.subject, body: `Hi ${u.name.split(" ")[0]},\n\n${email.body || text}`, link });
  }
}

// Once a day, an hour after the shift ends, remind anyone still checked in.
async function checkoutReminders(env) {
  const cfg = await loadSettings(env);
  if (nowMinutesIST() < cfg.shiftEnd + 60) return;
  const today = todayIST();
  // Claim today's run, so only one request ever sends the reminders.
  const claimed = await env.DB.prepare("UPDATE settings SET value = ? WHERE key = 'reminders_sent_on' AND value != ? RETURNING key").bind(today, today).first();
  if (!claimed) return;
  const { results } = await env.DB.prepare("SELECT user_id FROM attendance WHERE date = ? AND check_out_at IS NULL").bind(today).all();
  for (const r of results) {
    await notify(env, [r.user_id], `You haven't checked out today. Check out now, or request a correction tomorrow if you left earlier.`, "today",
      { email: { subject: "Reminder: you haven't checked out today" } });
  }
}

// Runs after each /lna response (context.waitUntil): reminders, then due emails.
// Each server instance does this at most once a minute; it never delays a page.
let lastRun = 0;
export async function background(env, origin) {
  if (!queueState.fresh && Date.now() - lastRun < 60000) return;
  queueState.fresh = false;
  lastRun = Date.now();
  try { await checkoutReminders(env); } catch (e) { console.error("reminders", e); }
  try { await processOutbox(env, origin); } catch (e) { console.error("outbox", e); }
}
