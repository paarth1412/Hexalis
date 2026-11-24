// JSON API for the /lna app. Every route here runs only for a logged-in user
// (see router.js). Everyone signs in with their @hexalis.in Google account.
import {
  DOMAIN, addDays, audit, clientIp, isValidDate, json, nowISO, securityHeaders, todayIST, weekday,
} from "./util.js";
import { endAllSessions } from "./auth.js";
import { notify } from "./notify.js";
import { mailInfo, sendMail } from "./mail.js";
import {
  distanceM, istMinutes, istToISO, loadSettings, minToHhmm, nowMinutesIST, saveSettings, shiftResult,
} from "./settings.js";

const bad = (msg, status = 400) => json({ error: msg }, status);
const ROLES = ["admin", "manager", "employee"];
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const yearStart = (y) => `${y}-01-01`;
const maxDate = (a, b) => (a > b ? a : b);
const minDate = (a, b) => (a < b ? a : b);
const fmtD = (d) => { const [y, m, day] = d.split("-"); return `${+day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1]} ${y}`; };
const fmtRange = (a, b) => (a === b ? fmtD(a) : `${fmtD(a)} – ${fmtD(b)}`);

// First day a person counts from: their joining date, else when the account was made.
const sinceOf = (u) => u.joining_date || todayIST(new Date(u.user_created || u.created_at));

// ---- who may approve whom ----------------------------------------------------
//  employee's request → their own manager, or any admin
//  manager's request  → admins only
//  admin's request    → another admin (or themselves, only if they are the sole admin)
async function soleAdmin(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").first();
  return r.n <= 1;
}
function canApproveSync(me, requester, sole) {
  if (me.id === requester.id) return me.role === "admin" && sole;
  if (me.role === "admin") return true;
  if (me.role === "manager") return requester.role === "employee" && requester.manager_id === me.id;
  return false;
}
async function canApprove(env, me, requester) {
  if (me.id === requester.id) return me.role === "admin" && (await soleAdmin(env));
  if (me.role === "admin") return true;
  if (me.role === "manager") return requester.role === "employee" && requester.manager_id === me.id;
  return false;
}
// Who hears about a new request: an employee's own manager if they have one,
// otherwise the admins.
async function approverIds(env, requester) {
  if (requester.role === "employee" && requester.manager_id) return [requester.manager_id];
  const { results } = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1").all();
  const ids = results.map((r) => r.id).filter((id) => id !== requester.id);
  return ids.length ? ids : [requester.id];
}
// Whose records a user may see (Team, dashboard, reports).
function teamFilter(me, { includeInactive = false } = {}) {
  const act = includeInactive ? "1 = 1" : "u.active = 1";
  if (me.role === "admin") return { sql: act, args: [] };
  return { sql: `${act} AND u.role = 'employee' AND u.manager_id = ?`, args: [me.id] };
}
async function canSee(env, me, userId) {
  if (me.role === "admin" || me.id === userId) return true;
  const u = await env.DB.prepare("SELECT role, manager_id FROM users WHERE id = ?").bind(userId).first();
  return Boolean(u && me.role === "manager" && u.role === "employee" && u.manager_id === me.id);
}

// ---- calendar arithmetic -----------------------------------------------------
async function holidaySet(env, from, to) {
  const { results } = await env.DB.prepare("SELECT date FROM holidays WHERE date BETWEEN ? AND ?").bind(from, to).all();
  return new Set(results.map((r) => r.date));
}
function countWorking(cfg, hols, start, end) {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (!cfg.weekend.has(weekday(d)) && !hols.has(d)) n++;
  return n;
}
async function workingDays(env, cfg, start, end, halfDay) {
  const n = countWorking(cfg, await holidaySet(env, start, end), start, end);
  return halfDay ? Math.min(n, 1) * 0.5 : n;
}
async function isWorkingDay(env, cfg, date) {
  if (cfg.weekend.has(weekday(date))) return false;
  return !(await env.DB.prepare("SELECT 1 FROM holidays WHERE date = ?").bind(date).first());
}

// ---- leave balances ------------------------------------------------------------
// How each leave type is given out within a calendar year:
//   yearly  — the full allowance on 1 January (or on joining)
//   monthly — 1/12 of it for every calendar month completed
//   days    — 1 day for every N days completed (e.g. 1 per 20 days, up to 18)
// Counting starts on the later of 1 January and the joining date; nothing is
// given in advance, and unused leave doesn't carry into the next year.
const dayNumber = (d) => Date.parse(d + "T00:00:00Z") / 86400000;
function entitlement(type, since, year, today) {
  if (type.yearly_quota === null) return null;
  if (since > `${year}-12-31`) return 0;
  const start = maxDate(yearStart(year), since);
  const ref = minDate(today, `${year}-12-31`);
  if (type.accrual === "days") {
    const every = type.accrual_days || 20;
    const done = Math.max(0, dayNumber(ref) - dayNumber(start));
    return Math.min(type.yearly_quota, Math.floor(done / every));
  }
  if (type.accrual !== "monthly") return type.yearly_quota;
  let months = 0;
  for (let m = 1; m <= 12; m++) {
    const first = `${year}-${String(m).padStart(2, "0")}-01`;
    const last = addDays(m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, "0")}-01`, -1);
    if (first >= start && last <= ref) months++;
    // A month started on its first working day still counts as complete.
    else if (first < start && start <= addDays(first, 3) && last <= ref) months++;
  }
  return Math.floor((type.yearly_quota / 12) * months * 2) / 2;
}
// The two queries balances need; usable inside a batch with other queries.
const TYPES_SQL = "SELECT * FROM leave_types WHERE active = 1 ORDER BY id";
const USED_SQL = `SELECT user_id, leave_type_id, status, SUM(days) AS days FROM leaves
  WHERE status IN ('approved','pending') AND substr(start_date,1,4) = ? AND user_id IN (SELECT value FROM json_each(?))
  GROUP BY user_id, leave_type_id, status`;
const usedStmt = (env, userIds, year) => env.DB.prepare(USED_SQL).bind(String(year), JSON.stringify(userIds));

async function balances(env, user, year) {
  const [t, u] = await env.DB.batch([env.DB.prepare(TYPES_SQL), usedStmt(env, [user.id], year)]);
  return computeBalances(t.results, u.results, user, year);
}
function computeBalances(types, usedAll, user, year) {
  year = Number(year);
  const today = todayIST();
  const used = usedAll.filter((x) => x.user_id === user.id);
  const since = sinceOf(user);
  return types.map((t) => {
    const approved = used.find((u) => u.leave_type_id === t.id && u.status === "approved")?.days || 0;
    const pending = used.find((u) => u.leave_type_id === t.id && u.status === "pending")?.days || 0;
    const earned = entitlement(t, since, year, today);
    return {
      id: t.id, name: t.name, quota: t.yearly_quota, accrual: t.accrual, accrual_days: t.accrual_days, earned, approved, pending,
      doc_after_days: t.doc_after_days,
      remaining: earned === null ? null : earned - approved - pending,
    };
  });
}

// ---- documents (sick notes etc.) ------------------------------------------------
const DOC_TYPES = [
  { mime: "application/pdf", ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
];
const MAX_DOC = 1024 * 1024;
function readDoc(doc) {
  if (!doc || typeof doc.data !== "string") return { none: true };
  let bytes;
  try { bytes = Uint8Array.from(atob(doc.data), (c) => c.charCodeAt(0)); } catch { return { error: "That file couldn't be read." }; }
  if (bytes.length > MAX_DOC) return { error: "Documents must be 1 MB or smaller." };
  // The file's real type is checked from its first bytes, not its name.
  const t = DOC_TYPES.find((x) => x.magic.every((b, i) => bytes[i] === b));
  if (!t) return { error: "Upload a PDF, JPG or PNG file." };
  const base = str(doc.name, 80).replace(/\.[^.]*$/, "").replace(/[^\w\- ]+/g, "").trim() || "document";
  return { bytes, mime: t.mime, name: `${base}.${t.ext}` };
}

// ---- Today -----------------------------------------------------------------------
async function overview(env, me) {
  const today = todayIST();
  // Everything the Today screen needs, read in one database round trip.
  const [cfg, rows, pendingList] = await Promise.all([
    loadSettings(env),
    env.DB.batch([
      env.DB.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").bind(me.id, today),
      env.DB.prepare("SELECT l.*, t.name AS type FROM leaves l JOIN leave_types t ON t.id = l.leave_type_id WHERE user_id = ? AND status = 'approved' AND ? BETWEEN start_date AND end_date LIMIT 1").bind(me.id, today),
      env.DB.prepare("SELECT name FROM holidays WHERE date = ?").bind(today),
      env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(me.manager_id || 0),
      // Days in the last two weeks with a check-in but no check-out, and no reminder yet.
      env.DB.prepare(
        `SELECT a.date, EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = a.user_id AND n.link = 'today' AND n.text LIKE '%' || a.date || '%') AS reminded
           FROM attendance a WHERE a.user_id = ? AND a.check_out_at IS NULL AND a.date < ? AND a.date >= ?
            AND NOT EXISTS (SELECT 1 FROM corrections c WHERE c.user_id = a.user_id AND c.date = a.date AND c.status = 'pending')
          ORDER BY a.date DESC`
      ).bind(me.id, today, addDays(today, -14)),
      env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").bind(me.id),
    ]),
    me.role === "employee" ? [] : pendingApprovals(env, me),
  ]);
  const one = (i) => rows[i].results[0] || null;
  const att = one(0), onLeave = one(1), holiday = one(2), manager = me.manager_id ? one(3) : null;
  const openDays = rows[4].results;
  const pending = pendingList.length;
  let unreadN = one(5).n;
  const toRemind = openDays.filter((d) => !d.reminded);
  if (toRemind.length) {
    // The date is in the text as YYYY-MM-DD too, so it's only ever sent once.
    await env.DB.batch(toRemind.map((d) => env.DB.prepare("INSERT INTO notifications (user_id, text, link, created_at) VALUES (?, ?, 'today', ?)")
      .bind(me.id, `You didn't check out on ${fmtD(d.date)} (${d.date}). Request a correction so your hours are right.`, nowISO())));
    unreadN += toRemind.length;
  }
  const unread = { n: unreadN };

  return json({
    user: { id: me.id, name: me.name, email: me.email, role: me.role, manager: manager?.name || null, since: sinceOf(me) },
    today, nowMin: nowMinutesIST(), weekend: cfg.weekend.has(weekday(today)), holiday: holiday?.name || null,
    shift: { start: cfg.raw.shift_start, end: cfg.raw.shift_end, grace: cfg.grace, fullHours: Number(cfg.raw.full_day_hours) },
    officeCheck: Boolean(cfg.office),
    attendance: att, onLeave, pendingApprovals: pending, openDays: openDays.map((d) => d.date), unread: unread.n,
  });
}

async function myMonth(env, me, url) {
  const cfg = await loadSettings(env);
  const month = url.searchParams.get("month") || todayIST().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return bad("Bad month.");
  const from = month + "-01", to = month + "-31";
  const [a, l, h] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM attendance WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date").bind(me.id, from, to),
    env.DB.prepare("SELECT l.*, t.name AS type FROM leaves l JOIN leave_types t ON t.id = l.leave_type_id WHERE user_id = ? AND status IN ('approved','pending') AND end_date >= ? AND start_date <= ?").bind(me.id, from, to),
    env.DB.prepare("SELECT * FROM holidays WHERE date BETWEEN ? AND ?").bind(from, to),
  ]);
  const attendance = a.results, leaves = l.results, holidays = h.results;
  // Days before someone joined aren't counted as missing.
  return json({ month, today: todayIST(), since: sinceOf(me), weekend: [...cfg.weekend], attendance, leaves, holidays });
}

async function checkIn(env, me, body, request) {
  const cfg = await loadSettings(env);
  const mode = body.mode;
  if (!["office", "wfh"].includes(mode)) return bad("Choose Office or Work from home.");
  const today = todayIST();
  if (today < sinceOf(me)) return bad(`Your joining date is ${fmtD(sinceOf(me))}. Check in from then.`);
  const onLeave = await env.DB.prepare("SELECT id FROM leaves WHERE user_id = ? AND status = 'approved' AND half_day = 0 AND ? BETWEEN start_date AND end_date").bind(me.id, today).first();
  if (onLeave) return bad("You're on approved leave today. Cancel the leave first if you're working.");
  const existing = await env.DB.prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ?").bind(me.id, today).first();
  if (existing) return bad("You've already checked in today.");

  // Optional office location check (Settings → Office location).
  let distance = null;
  if (mode === "office" && cfg.office) {
    const lat = Number(body.lat), lon = Number(body.lon);
    if (body.lat === undefined || body.lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return bad("Allow location access to check in at the office. Your location is checked once, at check-in, and only the distance is kept.");
    }
    distance = distanceM(lat, lon, cfg.office.lat, cfg.office.lon);
    if (distance > cfg.office.radius) {
      return bad(`You seem to be about ${distance} m from the office (the limit is ${cfg.office.radius} m). Move closer, or check in as work from home.`);
    }
  }
  const at = nowISO();
  const working = await isWorkingDay(env, cfg, today);
  const late = working ? shiftResult(cfg, at, null).late : 0;
  // Office is accepted as-is; work from home waits for approval.
  const status = mode === "office" ? "approved" : "pending";
  await env.DB.prepare(
    "INSERT INTO attendance (user_id, date, mode, status, check_in_at, late, ip, user_agent, distance_m) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(me.id, today, mode, status, at, late, clientIp(request), (request.headers.get("User-Agent") || "").slice(0, 200), distance).run();
  await audit(env, me.id, "attendance.check_in", { date: today, mode, late });
  if (mode === "wfh") {
    await notify(env, await approverIds(env, me), `${me.name} is working from home today and needs approval.`, "approvals",
      { email: { subject: `Work from home to approve: ${me.name}`, body: `${me.name} checked in from home today (${fmtD(today)}) and needs your approval.` } });
  }
  return json({ ok: true, late });
}

async function checkOut(env, me) {
  const cfg = await loadSettings(env);
  const today = todayIST();
  const row = await env.DB.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").bind(me.id, today).first();
  if (!row) return bad("Check in first.");
  if (row.check_out_at) return bad("You've already checked out today.");
  const at = nowISO();
  const r = shiftResult(cfg, row.check_in_at, at);
  if (!(await isWorkingDay(env, cfg, today))) { r.late = 0; r.early = 0; }
  await env.DB.prepare("UPDATE attendance SET check_out_at = ?, early = ?, worked_min = ?, day_status = ? WHERE id = ?")
    .bind(at, r.early, r.worked_min, r.day_status, row.id).run();
  await audit(env, me.id, "attendance.check_out", { date: today, worked_min: r.worked_min });
  return json({ ok: true, ...r });
}

// ---- attendance corrections -------------------------------------------------------
async function myCorrections(env, me) {
  const { results } = await env.DB.prepare(
    `SELECT c.*, r.name AS reviewer FROM corrections c LEFT JOIN users r ON r.id = c.reviewer_id
      WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 30`
  ).bind(me.id).all();
  return json({ items: results });
}

async function requestCorrection(env, me, body) {
  const { date, kind } = body;
  const today = todayIST();
  if (!isValidDate(date)) return bad("Pick the date to correct.");
  if (date > today) return bad("You can only correct today or earlier.");
  if (date < addDays(today, -60)) return bad("Corrections can go back 60 days at most. Ask an admin about older records.");
  if (date < sinceOf(me)) return bad("That's before your joining date.");
  if (!["in", "out", "both"].includes(kind)) return bad("Choose what needs correcting.");
  const reason = str(body.reason, 300);
  if (!reason) return bad("Say briefly what happened.");
  const timeOk = (t) => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if ((kind === "in" || kind === "both") && !timeOk(body.check_in)) return bad("Enter the check-in time.");
  if ((kind === "out" || kind === "both") && !timeOk(body.check_out)) return bad("Enter the check-out time.");

  const row = await env.DB.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").bind(me.id, date).first();
  const inAt = kind === "out" ? row?.check_in_at : istToISO(date, body.check_in);
  const outAt = kind === "in" ? row?.check_out_at : istToISO(date, body.check_out);
  if (kind === "out" && !row) return bad("There's no check-in that day. Choose \"Both\" to add the whole day.");
  if (inAt && outAt && outAt <= inAt) return bad("Check-out must be after check-in.");
  if (date === today && ((kind !== "out" && inAt > nowISO()) || (kind !== "in" && outAt > nowISO()))) return bad("That time hasn't happened yet.");
  let mode = null;
  if (!row) {
    if (!["office", "wfh"].includes(body.mode)) return bad("Say whether you were at the office or working from home.");
    mode = body.mode;
  }
  const onLeave = await env.DB.prepare("SELECT id FROM leaves WHERE user_id = ? AND status = 'approved' AND half_day = 0 AND ? BETWEEN start_date AND end_date").bind(me.id, date).first();
  if (onLeave) return bad("You're on approved leave that day. Cancel the leave first.");
  if (await env.DB.prepare("SELECT id FROM corrections WHERE user_id = ? AND date = ? AND status = 'pending'").bind(me.id, date).first()) {
    return bad("You already have a correction waiting for that date.");
  }
  await env.DB.prepare(
    "INSERT INTO corrections (user_id, date, kind, mode, check_in_at, check_out_at, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)"
  ).bind(me.id, date, kind, mode, kind === "out" ? null : inAt, kind === "in" ? null : outAt, reason, nowISO()).run();
  await audit(env, me.id, "correction.requested", { date, kind });
  await notify(env, await approverIds(env, me), `${me.name} asked to correct their attendance for ${fmtD(date)}.`, "approvals",
    { email: { subject: `Attendance correction to review: ${me.name}`, body: `${me.name} asked to correct their attendance for ${fmtD(date)}.\n\nReason: ${reason}` } });
  return json({ ok: true });
}

async function cancelCorrection(env, me, id) {
  const r = await env.DB.prepare("UPDATE corrections SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending' RETURNING id").bind(id, me.id).first();
  if (!r) return bad("Only a correction that's still waiting can be withdrawn.");
  await audit(env, me.id, "correction.cancelled", { id });
  return json({ ok: true });
}

// Applies an approved correction to the day's record.
async function applyCorrection(env, cfg, c, reviewer) {
  const row = await env.DB.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").bind(c.user_id, c.date).first();
  const inAt = c.check_in_at || row?.check_in_at;
  const outAt = c.check_out_at || row?.check_out_at || null;
  if (!inAt) return "There's no check-in for that day any more.";
  if (outAt && outAt <= inAt) return "With this change, check-out would be before check-in. Reject it and ask for a new one.";
  const r = shiftResult(cfg, inAt, outAt);
  if (!(await isWorkingDay(env, cfg, c.date))) { r.late = 0; r.early = 0; }
  if (row) {
    await env.DB.prepare("UPDATE attendance SET check_in_at = ?, check_out_at = ?, late = ?, early = ?, worked_min = ?, day_status = ?, corrected = 1 WHERE id = ?")
      .bind(inAt, outAt, r.late, r.early, r.worked_min, r.day_status, row.id).run();
  } else {
    // A whole missing day. Approving the correction also approves a work-from-home day.
    await env.DB.prepare(
      `INSERT INTO attendance (user_id, date, mode, status, check_in_at, check_out_at, late, early, worked_min, day_status, corrected, reviewer_id, reviewed_at)
       VALUES (?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(c.user_id, c.date, c.mode || "office", inAt, outAt, r.late, r.early, r.worked_min, r.day_status, reviewer.id, nowISO()).run();
  }
  return null;
}

// ---- Leave ------------------------------------------------------------------------
async function leaveOverview(env, me) {
  const year = todayIST().slice(0, 4);
  const [rq, wf, ty, us] = await env.DB.batch([
    env.DB.prepare(
      `SELECT l.*, t.name AS type, r.name AS reviewer, d.name AS doc_name FROM leaves l
         JOIN leave_types t ON t.id = l.leave_type_id LEFT JOIN users r ON r.id = l.reviewer_id
         LEFT JOIN leave_docs d ON d.leave_id = l.id
        WHERE l.user_id = ? ORDER BY l.start_date DESC LIMIT 100`).bind(me.id),
    env.DB.prepare(
      `SELECT a.*, r.name AS reviewer FROM attendance a LEFT JOIN users r ON r.id = a.reviewer_id
        WHERE a.user_id = ? AND a.mode = 'wfh' ORDER BY a.date DESC LIMIT 30`).bind(me.id),
    env.DB.prepare(TYPES_SQL),
    usedStmt(env, [me.id], year),
  ]);
  return json({ year, since: sinceOf(me), balances: computeBalances(ty.results, us.results, me, year), requests: rq.results, wfh: wf.results, today: todayIST() });
}

async function applyLeave(env, me, body) {
  const cfg = await loadSettings(env);
  const { leave_type_id, start_date, end_date } = body;
  const half = body.half_day ? 1 : 0;
  const reason = str(body.reason, 500);
  if (!isValidDate(start_date) || !isValidDate(end_date)) return bad("Pick a start and end date.");
  if (end_date < start_date) return bad("The end date is before the start date.");
  if (half && start_date !== end_date) return bad("A half day must start and end on the same date.");
  if (start_date.slice(0, 4) !== end_date.slice(0, 4)) return bad("Split leave that crosses into a new year into two requests.");
  if (start_date < sinceOf(me)) return bad(`Leave can't start before your joining date (${fmtD(sinceOf(me))}).`);
  const type = await env.DB.prepare("SELECT * FROM leave_types WHERE id = ? AND active = 1").bind(leave_type_id).first();
  if (!type) return bad("Choose a leave type.");
  const days = await workingDays(env, cfg, start_date, end_date, half);
  if (days <= 0) return bad("Those dates are all weekly offs or holidays, so no leave is needed.");
  const overlap = await env.DB.prepare(
    "SELECT id FROM leaves WHERE user_id = ? AND status IN ('pending','approved') AND start_date <= ? AND end_date >= ?"
  ).bind(me.id, end_date, start_date).first();
  if (overlap) return bad("You already have leave requested for some of those dates.");
  if (type.yearly_quota !== null) {
    const bal = (await balances(env, me, start_date.slice(0, 4))).find((b) => b.id === type.id);
    if (bal && days > bal.remaining) {
      const built = type.accrual === "monthly" ? " (it builds up month by month)" : type.accrual === "days" ? ` (you get 1 day for every ${type.accrual_days} days)` : "";
      return bad(`That's ${days} day(s), but you have ${bal.remaining} ${type.name.toLowerCase()} available${built}.`);
    }
  }
  const doc = readDoc(body.doc);
  if (doc.error) return bad(doc.error);
  if (doc.none && type.doc_after_days !== null && days > type.doc_after_days) {
    return bad(`${type.name} of more than ${type.doc_after_days} day(s) needs a supporting document, such as a doctor's note (PDF, JPG or PNG, up to 1 MB).`);
  }
  const res = await env.DB.prepare(
    "INSERT INTO leaves (user_id, leave_type_id, start_date, end_date, half_day, days, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id"
  ).bind(me.id, type.id, start_date, end_date, half, days, reason, nowISO()).first();
  if (!doc.none) {
    await env.DB.prepare("INSERT INTO leave_docs (leave_id, name, mime, size, data) VALUES (?, ?, ?, ?, ?)")
      .bind(res.id, doc.name, doc.mime, doc.bytes.length, doc.bytes).run();
  }
  await audit(env, me.id, "leave.applied", { start_date, end_date, days, type: type.name, document: !doc.none });
  await notify(env, await approverIds(env, me), `${me.name} asked for ${type.name.toLowerCase()}: ${fmtRange(start_date, end_date)} (${days} day${days === 1 ? "" : "s"}).`, "approvals",
    { email: { subject: `Leave request from ${me.name}`, body: `${me.name} asked for ${type.name.toLowerCase()}: ${fmtRange(start_date, end_date)} (${days} day${days === 1 ? "" : "s"}).${reason ? `\n\nReason: ${reason}` : ""}${doc.none ? "" : "\n\nA supporting document is attached to the request."}` } });
  return json({ ok: true, days });
}

async function cancelLeave(env, me, id) {
  const row = await env.DB.prepare("SELECT * FROM leaves WHERE id = ? AND user_id = ?").bind(id, me.id).first();
  if (!row) return bad("Not found.", 404);
  const today = todayIST();
  if (row.status === "pending" || (row.status === "approved" && row.start_date > today)) {
    await env.DB.prepare("UPDATE leaves SET status = 'cancelled' WHERE id = ?").bind(id).run();
    await audit(env, me.id, "leave.cancelled", { id });
    if (row.status === "approved") await notify(env, [row.reviewer_id], `${me.name} cancelled their approved leave for ${fmtRange(row.start_date, row.end_date)}.`, "team",
      { email: { subject: `Leave cancelled: ${me.name}` } });
    return json({ ok: true });
  }
  return bad("Only pending leave, or approved leave that hasn't started, can be cancelled.");
}

async function leaveDoc(env, me, id) {
  const l = await env.DB.prepare("SELECT l.user_id, u.role, u.manager_id FROM leaves l JOIN users u ON u.id = l.user_id WHERE l.id = ?").bind(id).first();
  if (!l) return bad("Not found.", 404);
  const allowed = l.user_id === me.id || me.role === "admin" || (await canApprove(env, me, { id: l.user_id, role: l.role, manager_id: l.manager_id }));
  if (!allowed) return bad("Not allowed.", 403);
  const d = await env.DB.prepare("SELECT * FROM leave_docs WHERE leave_id = ?").bind(id).first();
  if (!d) return bad("No document.", 404);
  await audit(env, me.id, "leave.document_viewed", { leave: id });
  return new Response(new Uint8Array(d.data), {
    headers: {
      ...securityHeaders(),
      "Content-Type": d.mime,
      "Content-Disposition": `attachment; filename="${d.name}"`,
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}

// ---- Approvals ----------------------------------------------------------------------
async function pendingApprovals(env, me) {
  if (me.role === "employee") return [];
  const [lv, wf, co, admins] = await env.DB.batch([env.DB.prepare(
    `SELECT 'leave' AS kind, l.id, l.start_date, l.end_date, l.half_day, l.days, l.reason, l.created_at, t.name AS type,
            d.name AS doc_name, u.id AS user_id, u.name, u.role, u.manager_id, u.department
       FROM leaves l JOIN users u ON u.id = l.user_id JOIN leave_types t ON t.id = l.leave_type_id
       LEFT JOIN leave_docs d ON d.leave_id = l.id
      WHERE l.status = 'pending' ORDER BY l.created_at`
  ), env.DB.prepare(
    `SELECT 'wfh' AS kind, a.id, a.date AS start_date, a.date AS end_date, a.check_in_at AS created_at,
            u.id AS user_id, u.name, u.role, u.manager_id, u.department
       FROM attendance a JOIN users u ON u.id = a.user_id
      WHERE a.mode = 'wfh' AND a.status = 'pending' ORDER BY a.date`
  ), env.DB.prepare(
    `SELECT 'correction' AS kind, c.id, c.date AS start_date, c.date AS end_date, c.kind AS fix, c.mode, c.check_in_at, c.check_out_at,
            c.reason, c.created_at, a.check_in_at AS was_in, a.check_out_at AS was_out, a.mode AS was_mode,
            u.id AS user_id, u.name, u.role, u.manager_id, u.department
       FROM corrections c JOIN users u ON u.id = c.user_id
       LEFT JOIN attendance a ON a.user_id = c.user_id AND a.date = c.date
      WHERE c.status = 'pending' ORDER BY c.created_at`
  ), env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")]);
  const sole = admins.results[0].n <= 1;
  return [...lv.results, ...wf.results, ...co.results].filter((r) => canApproveSync(me, { id: r.user_id, role: r.role, manager_id: r.manager_id }, sole));
}

async function decide(env, me, kind, id, body) {
  const decision = body.decision;
  if (!["approved", "rejected"].includes(decision)) return bad("Approve or reject.");
  const note = str(body.note, 300);
  const table = { leave: "leaves", wfh: "attendance", correction: "corrections" }[kind];
  if (!table) return bad("Unknown request.", 404);
  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row || row.status !== "pending" || (kind === "wfh" && row.mode !== "wfh")) return bad("This request is no longer waiting for a decision.", 409);
  const requester = await env.DB.prepare("SELECT id, name, role, manager_id FROM users WHERE id = ?").bind(row.user_id).first();
  if (!(await canApprove(env, me, requester))) return bad("You can't decide on this request.", 403);
  if (kind === "correction" && decision === "approved") {
    const err = await applyCorrection(env, await loadSettings(env), row, me);
    if (err) return bad(err, 409);
  }
  await env.DB.prepare(`UPDATE ${table} SET status = ?, reviewer_id = ?, reviewed_at = ?, review_note = ? WHERE id = ?`)
    .bind(decision, me.id, nowISO(), note || null, id).run();
  await audit(env, me.id, `${kind}.${decision}`, { id, for: row.user_id });
  const what = kind === "leave" ? `leave for ${fmtRange(row.start_date, row.end_date)}`
    : kind === "wfh" ? `work from home on ${fmtD(row.date)}` : `attendance correction for ${fmtD(row.date)}`;
  await notify(env, [row.user_id], `${me.name} ${decision} your ${what}.${note ? ` Note: ${note}` : ""}`, kind === "leave" ? "leave" : "today",
    { email: { subject: `Your ${what} was ${decision}`, body: `${me.name} ${decision} your ${what}.${note ? `\n\nNote: ${note}` : ""}` } });
  return json({ ok: true });
}

// ---- Team: live dashboard and leave balances ----------------------------------------
async function team(env, me, url) {
  if (me.role === "employee") return bad("Not available.", 403);
  const cfg = await loadSettings(env);
  const today = todayIST();
  const date = url.searchParams.get("date") || today;
  if (!isValidDate(date)) return bad("Bad date.");
  const dept = url.searchParams.get("department") || "";
  const f = teamFilter(me);
  // The team, today's holiday and pending requests, all at the same time.
  const [{ results: all }, holiday, pend] = await Promise.all([env.DB.prepare(
    `SELECT u.id, u.name, u.role, u.email, u.employee_code, u.department, u.designation, u.joining_date, u.created_at, u.dob,
            a.mode, a.status AS att_status, a.check_in_at, a.check_out_at, a.late, a.early, a.worked_min, a.day_status, a.corrected,
            (SELECT t.name || CASE WHEN l.half_day THEN ' (half day)' ELSE '' END FROM leaves l JOIN leave_types t ON t.id = l.leave_type_id
              WHERE l.user_id = u.id AND l.status = 'approved' AND ? BETWEEN l.start_date AND l.end_date LIMIT 1) AS leave_type
       FROM users u LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ?
      WHERE ${f.sql} ORDER BY u.name`
  ).bind(date, date, ...f.args).all(),
    env.DB.prepare("SELECT name FROM holidays WHERE date = ?").bind(date).first(),
    pendingApprovals(env, me),
  ]);
  const departments = [...new Set(all.map((p) => p.department).filter(Boolean))].sort();
  const people = (dept ? all.filter((p) => p.department === dept) : all).filter((p) => sinceOf(p) <= date);
  const working = !cfg.weekend.has(weekday(date)) && !holiday;
  const dayOver = date < today || (date === today && nowMinutesIST() >= cfg.shiftEnd);
  const lateNow = date < today || (date === today && nowMinutesIST() > cfg.shiftStart + cfg.grace);

  const c = { total: people.length, present: 0, office: 0, wfh: 0, onLeave: 0, late: 0, early: 0, notIn: 0, absent: 0, notOut: 0 };
  for (const p of people) {
    if (p.check_in_at) {
      c.present++; p.mode === "office" ? c.office++ : c.wfh++;
      if (p.late) c.late++;
      if (p.early) c.early++;
      if (!p.check_out_at && dayOver) { c.notOut++; p.flag = "not_out"; }
    } else if (p.leave_type && !p.leave_type.includes("half day")) { c.onLeave++; }
    else if (working) {
      if (dayOver) { c.absent++; p.flag = "absent"; }
      else { c.notIn++; p.flag = lateNow ? "not_in_late" : "not_in"; }
    }
    if (p.leave_type && p.leave_type.includes("half day")) c.onLeave += 0.5;
  }
  const birthdays = all.filter((p) => p.dob && p.dob.slice(5) === date.slice(5)).map((p) => p.name);
  for (const p of people) { delete p.dob; delete p.created_at; }
  return json({
    date, today, weekend: cfg.weekend.has(weekday(date)), holiday: holiday?.name || null, working,
    shift: { start: cfg.raw.shift_start, end: cfg.raw.shift_end }, departments, department: dept,
    counts: { ...c, pendingLeave: pend.filter((x) => x.kind === "leave").length, pendingWfh: pend.filter((x) => x.kind === "wfh").length, pendingCorrections: pend.filter((x) => x.kind === "correction").length },
    birthdays, people,
  });
}

async function teamBalances(env, me) {
  if (me.role === "employee") return bad("Not available.", 403);
  const f = teamFilter(me);
  const { results } = await env.DB.prepare(`SELECT u.id, u.name, u.department, u.joining_date, u.created_at FROM users u WHERE ${f.sql} ORDER BY u.name`).bind(...f.args).all();
  const year = todayIST().slice(0, 4);
  const [ty, us] = await env.DB.batch([env.DB.prepare(TYPES_SQL), usedStmt(env, results.map((p) => p.id), year)]);
  return json({ year, people: results.map((p) => ({ id: p.id, name: p.name, department: p.department, balances: computeBalances(ty.results, us.results, p, year) })) });
}

// ---- Reports ----------------------------------------------------------------------------
function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           // stops spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const hhmm = (iso) => (iso ? minToHhmm(istMinutes(iso)) : "");
const hours = (min) => (min === null || min === undefined ? "" : (min / 60).toFixed(2));
const DAY_STATUS = { present: "Full day", half_day: "Half day", short: "Short hours" };

async function report(env, me, url) {
  if (me.role === "employee") return bad("Not available.", 403);
  const cfg = await loadSettings(env);
  const p = url.searchParams;
  const today = todayIST();
  const from = p.get("from") || today.slice(0, 8) + "01";
  const to = p.get("to") || today;
  const type = p.get("type") || "summary";
  if (!isValidDate(from) || !isValidDate(to) || to < from) return bad("Pick a valid date range.");
  if (addDays(from, 366) < to) return bad("Reports can cover up to one year at a time.");
  if (!["summary", "detail", "leave"].includes(type)) return bad("Unknown report.");
  const person = p.get("person") ? Number(p.get("person")) : null;
  const dept = p.get("department") || "";
  if (person && !(await canSee(env, me, person))) return bad("You can't see that person's records.", 403);

  const f = teamFilter(me, { includeInactive: true });
  let { results: users } = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.employee_code, u.department, u.designation, u.joining_date, u.created_at, u.active FROM users u WHERE ${f.sql} ORDER BY u.name`
  ).bind(...f.args).all();
  if (person) users = users.filter((u) => u.id === person);
  if (dept) users = users.filter((u) => u.department === dept);
  const ids = users.map((u) => u.id);
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  const inList = ids.length ? ids.join(",") : "0";   // integers from our own query, safe to inline
  const admin = me.role === "admin";
  let columns, rows;

  if (type === "detail") {
    const { results } = await env.DB.prepare(
      `SELECT a.*, r.name AS reviewer FROM attendance a LEFT JOIN users r ON r.id = a.reviewer_id
        WHERE a.user_id IN (${inList}) AND a.date BETWEEN ? AND ? ORDER BY a.date, a.user_id`
    ).bind(from, to).all();
    columns = ["Date", "Employee ID", "Name", "Department", "Mode", "WFH approval", "Check-in", "Check-out", "Hours", "Day", "Late", "Left early", "Corrected"];
    if (admin) columns.push("IP address", "Distance from office (m)");
    rows = results.map((a) => {
      const u = byId[a.user_id];
      const r = [a.date, u.employee_code, u.name, u.department, a.mode === "wfh" ? "Work from home" : "Office",
        a.mode === "wfh" ? a.status : "", hhmm(a.check_in_at), hhmm(a.check_out_at), hours(a.worked_min),
        a.check_out_at ? DAY_STATUS[a.day_status] || "" : "No check-out", a.late ? "Yes" : "", a.early ? "Yes" : "", a.corrected ? "Yes" : ""];
      if (admin) r.push(a.ip || "", a.distance_m ?? "");
      return r;
    });
  } else if (type === "leave") {
    const { results } = await env.DB.prepare(
      `SELECT l.*, t.name AS type, r.name AS reviewer, d.name AS doc FROM leaves l JOIN leave_types t ON t.id = l.leave_type_id
         LEFT JOIN users r ON r.id = l.reviewer_id LEFT JOIN leave_docs d ON d.leave_id = l.id
        WHERE l.user_id IN (${inList}) AND l.end_date >= ? AND l.start_date <= ? ORDER BY l.start_date`
    ).bind(from, to).all();
    columns = ["Employee ID", "Name", "Department", "Type", "From", "To", "Days", "Status", "Decided by", "Reason", "Document"];
    rows = results.map((l) => {
      const u = byId[l.user_id];
      return [u.employee_code, u.name, u.department, l.type, l.start_date, l.end_date, l.days, l.status, l.reviewer, l.reason, l.doc ? "Yes" : ""];
    });
  } else {
    // One line per person over the range. Days only count from joining and up to today.
    const hols = await holidaySet(env, from, to);
    const { results: att } = await env.DB.prepare(`SELECT * FROM attendance WHERE user_id IN (${inList}) AND date BETWEEN ? AND ?`).bind(from, to).all();
    const { results: lv } = await env.DB.prepare(
      `SELECT user_id, start_date, end_date, half_day FROM leaves WHERE user_id IN (${inList}) AND status = 'approved' AND end_date >= ? AND start_date <= ?`
    ).bind(from, to).all();
    columns = ["Employee ID", "Name", "Department", "Designation", "Working days", "Days worked", "Office", "WFH (approved)", "WFH (not approved / waiting)",
      "Leave days", "Absent", "Late arrivals", "Left early", "Full days", "Half days", "Short days", "No check-out", "Total hours", "Average hours / day"];
    rows = users.map((u) => {
      const start = maxDate(from, sinceOf(u));
      const end = minDate(to, today);
      const working = start <= end ? countWorking(cfg, hols, start, end) : 0;
      const mine = att.filter((a) => a.user_id === u.id);
      const counted = mine.filter((a) => a.mode === "office" || a.status === "approved");
      let leaveDays = 0;
      for (const l of lv.filter((x) => x.user_id === u.id)) {
        const s = maxDate(l.start_date, start), e = minDate(l.end_date, end);
        if (s <= e) leaveDays += l.half_day ? 0.5 * Math.min(1, countWorking(cfg, hols, s, e)) : countWorking(cfg, hols, s, e);
      }
      const workedOnWorking = counted.filter((a) => a.date >= start && a.date <= end && !cfg.weekend.has(weekday(a.date)) && !hols.has(a.date)).length;
      const totalMin = mine.reduce((n, a) => n + (a.worked_min || 0), 0);
      const withHours = mine.filter((a) => a.worked_min !== null && a.worked_min !== undefined).length;
      return [u.employee_code, u.name + (u.active ? "" : " (disabled)"), u.department, u.designation, working, counted.length,
        mine.filter((a) => a.mode === "office").length, mine.filter((a) => a.mode === "wfh" && a.status === "approved").length,
        mine.filter((a) => a.mode === "wfh" && a.status !== "approved").length, leaveDays,
        Math.max(0, working - workedOnWorking - leaveDays), mine.filter((a) => a.late).length, mine.filter((a) => a.early).length,
        mine.filter((a) => a.day_status === "present").length, mine.filter((a) => a.day_status === "half_day").length,
        mine.filter((a) => a.day_status === "short").length, mine.filter((a) => !a.check_out_at && a.date < today).length,
        hours(totalMin), withHours ? hours(Math.round(totalMin / withHours)) : ""];
    });
  }

  if (p.get("format") === "csv") {
    await audit(env, me.id, "report.downloaded", { type, from, to, person, department: dept || null });
    const name = `hexalis-${type}-${from}-to-${to}.csv`;
    return new Response("﻿" + [columns, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"), {
      headers: { ...securityHeaders(), "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
    });
  }
  const departments = [...new Set((await env.DB.prepare(`SELECT DISTINCT u.department FROM users u WHERE ${f.sql}`).bind(...f.args).all()).results.map((r) => r.department).filter(Boolean))].sort();
  const pickable = (await env.DB.prepare(`SELECT u.id, u.name FROM users u WHERE ${f.sql} ORDER BY u.name`).bind(...f.args).all()).results;
  return json({ type, from, to, columns, rows, people: pickable, departments });
}

// ---- profile (each person's own contact details) ----------------------------------
const PROFILE_FIELDS = { phone: 20, dob: 10, address: 300, emergency_name: 80, emergency_relation: 40, emergency_phone: 20 };
async function getProfile(env, id) {
  return env.DB.prepare(
    `SELECT u.name, u.email, u.role, u.employee_code, u.department, u.designation, u.joining_date,
            u.phone, u.dob, u.address, u.emergency_name, u.emergency_relation, u.emergency_phone, u.email_notify, m.name AS manager
       FROM users u LEFT JOIN users m ON m.id = u.manager_id WHERE u.id = ?`
  ).bind(id).first();
}
async function saveProfile(env, me, body) {
  const v = {};
  if (body.email_notify !== undefined && Object.keys(body).length === 1) {
    await env.DB.prepare("UPDATE users SET email_notify = ? WHERE id = ?").bind(body.email_notify ? 1 : 0, me.id).run();
    await audit(env, me.id, "profile.email_preference", { email_notify: Boolean(body.email_notify) });
    return json({ ok: true });
  }
  for (const [k, max] of Object.entries(PROFILE_FIELDS)) v[k] = str(body[k], max) || null;
  const phoneOk = (x) => !x || /^[+\d][\d\s-]{6,18}$/.test(x);
  if (!phoneOk(v.phone) || !phoneOk(v.emergency_phone)) return bad("Enter phone numbers with digits only (a leading + is fine).");
  if (v.dob && (!isValidDate(v.dob) || v.dob > todayIST())) return bad("Enter a valid date of birth.");
  if ((v.emergency_name || v.emergency_relation) && !v.emergency_phone) return bad("Add the emergency contact's phone number.");
  await env.DB.prepare(`UPDATE users SET ${Object.keys(v).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...Object.values(v), me.id).run();
  await audit(env, me.id, "profile.updated");
  return json({ ok: true });
}

// ---- notifications ---------------------------------------------------------------
async function notifications(env, me) {
  const { results } = await env.DB.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30").bind(me.id).all();
  const unread = await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").bind(me.id).first();
  return json({ items: results, unread: unread.n });
}
async function markRead(env, me) {
  await env.DB.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(nowISO(), me.id).run();
  // Keep the last 200 per person.
  await env.DB.prepare("DELETE FROM notifications WHERE user_id = ? AND id NOT IN (SELECT id FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 200)").bind(me.id, me.id).run();
  return json({ ok: true });
}

// ---- admin ---------------------------------------------------------------------
function adminOnly(me) { return me.role === "admin" ? null : bad("Admins only.", 403); }

async function people(env) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.manager_id, m.name AS manager, u.active, u.last_login_at, u.created_at,
            u.employee_code, u.department, u.designation, u.joining_date,
            u.phone, u.emergency_name, u.emergency_relation, u.emergency_phone
       FROM users u LEFT JOIN users m ON m.id = u.manager_id ORDER BY u.active DESC, u.name`
  ).all();
  return json({ people: results, now: nowISO() });
}

async function validManager(env, managerId, selfId) {
  if (managerId === null || managerId === undefined || managerId === "") return { id: null };
  const m = await env.DB.prepare("SELECT id, role, active FROM users WHERE id = ?").bind(managerId).first();
  if (!m || !m.active || !["manager", "admin"].includes(m.role)) return { error: "The reporting manager must be an active manager or admin." };
  if (selfId && m.id === selfId) return { error: "Someone can't report to themselves." };
  return { id: m.id };
}
// Work details the admin sets: employee ID, department, designation, joining date.
async function workFields(env, body, selfId) {
  const w = {
    employee_code: str(body.employee_code, 20).toUpperCase() || null,
    department: str(body.department, 60) || null,
    designation: str(body.designation, 60) || null,
    joining_date: str(body.joining_date, 10) || null,
  };
  if (w.employee_code && !/^[A-Z0-9-]+$/.test(w.employee_code)) return { error: "Employee ID can use letters, numbers and dashes." };
  if (w.joining_date && !isValidDate(w.joining_date)) return { error: "Enter a valid joining date." };
  if (w.employee_code) {
    const clash = await env.DB.prepare("SELECT id FROM users WHERE employee_code = ? AND id != ?").bind(w.employee_code, selfId || 0).first();
    if (clash) return { error: "Someone else already has that employee ID." };
  }
  return { w };
}

async function addPerson(env, me, body) {
  const name = str(body.name, 80);
  const email = String(body.email || "").trim().toLowerCase();
  if (!name) return bad("Enter a name.");
  if (!/^[a-z0-9._%+-]+@hexalis\.in$/.test(email)) return bad(`Use an @${DOMAIN} email address.`);
  if (!ROLES.includes(body.role)) return bad("Choose a role.");
  const mgr = await validManager(env, body.manager_id);
  if (mgr.error) return bad(mgr.error);
  const wf = await workFields(env, body);
  if (wf.error) return bad(wf.error);
  if (await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()) return bad("Someone already has that email.");
  const r = await env.DB.prepare(
    `INSERT INTO users (email, name, role, manager_id, must_change, employee_code, department, designation, joining_date)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?) RETURNING id`
  ).bind(email, name, body.role, mgr.id, wf.w.employee_code, wf.w.department, wf.w.designation, wf.w.joining_date).first();
  await audit(env, me.id, "admin.person_added", { email, role: body.role });
  await notify(env, [r.id], "Welcome to HEXALIS Leave & Attendance. Add your phone and emergency contact under Account.", "account", {
    email: {
      subject: "Your HEXALIS Leave & Attendance account",
      body: `An account has been made for you on HEXALIS Leave & Attendance, where you check in, apply for leave and see your requests.\n\nSign in with your Google account (${email}) using the button below. There's no separate password.`,
    },
  });
  return json({ ok: true, email });
}

async function updatePerson(env, me, id, body) {
  const person = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  if (!person) return bad("Not found.", 404);
  const role = body.role ?? person.role;
  const active = body.active === undefined ? person.active : (body.active ? 1 : 0);
  const name = body.name !== undefined ? str(body.name, 80) : person.name;
  if (!name) return bad("Enter a name.");
  if (!ROLES.includes(role)) return bad("Choose a role.");
  const mgr = body.manager_id !== undefined ? await validManager(env, body.manager_id, person.id) : { id: person.manager_id };
  if (mgr.error) return bad(mgr.error);
  let w = { employee_code: person.employee_code, department: person.department, designation: person.designation, joining_date: person.joining_date };
  if (body.department !== undefined || body.employee_code !== undefined) {
    const wf = await workFields(env, body, person.id);
    if (wf.error) return bad(wf.error);
    w = wf.w;
  }
  if (person.role === "admin" && (role !== "admin" || !active)) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?").bind(id).first();
    if (n.n === 0) return bad("There must always be at least one active admin.");
  }
  if (person.role !== "employee" && role === "employee") {
    // Anyone who reported to this person now reports to nobody (admins approve).
    await env.DB.prepare("UPDATE users SET manager_id = NULL WHERE manager_id = ?").bind(id).run();
  }
  await env.DB.prepare("UPDATE users SET name = ?, role = ?, manager_id = ?, active = ?, employee_code = ?, department = ?, designation = ?, joining_date = ? WHERE id = ?")
    .bind(name, role, mgr.id, active, w.employee_code, w.department, w.designation, w.joining_date, id).run();
  if (!active) await endAllSessions(env, id); // disabling signs them out everywhere, immediately
  await audit(env, me.id, "admin.person_updated", { id, role, active });
  return json({ ok: true });
}

// Ends every session someone has, e.g. for a lost laptop. They can sign in
// again with Google straight away (to block them, disable the account).
async function signOutPerson(env, me, id) {
  const person = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(id).first();
  if (!person) return bad("Not found.", 404);
  await endAllSessions(env, id);
  await audit(env, me.id, "admin.signed_out_person", { id });
  return json({ ok: true });
}

async function leaveTypes(env) {
  const { results } = await env.DB.prepare("SELECT * FROM leave_types ORDER BY active DESC, id").all();
  return json({ types: results });
}
async function saveLeaveType(env, me, id, body) {
  const name = str(body.name, 60);
  const quota = body.yearly_quota === null || body.yearly_quota === "" || body.yearly_quota === undefined ? null : Number(body.yearly_quota);
  const accrual = ["monthly", "days"].includes(body.accrual) ? body.accrual : "yearly";
  const every = accrual === "days" ? Number(body.accrual_days) : null;
  if (accrual === "days" && (!Number.isInteger(every) || every < 1 || every > 365)) return bad("Enter how many days earn 1 day of leave (a whole number, e.g. 20).");
  const docAfter = body.doc_after_days === null || body.doc_after_days === "" || body.doc_after_days === undefined ? null : Number(body.doc_after_days);
  if (!name) return bad("Enter a name.");
  if (quota !== null && (!Number.isFinite(quota) || quota < 0 || quota > 366 || (quota * 2) % 1 !== 0)) return bad("Days per year must be a whole or half number, or left blank for no limit.");
  if (docAfter !== null && (!Number.isFinite(docAfter) || docAfter < 0 || docAfter > 366)) return bad("\"Document needed after\" must be a number of days, or blank.");
  const active = body.active === undefined ? 1 : (body.active ? 1 : 0);
  try {
    if (id) await env.DB.prepare("UPDATE leave_types SET name = ?, yearly_quota = ?, accrual = ?, accrual_days = ?, doc_after_days = ?, active = ? WHERE id = ?").bind(name, quota, accrual, every, docAfter, active, id).run();
    else await env.DB.prepare("INSERT INTO leave_types (name, yearly_quota, accrual, accrual_days, doc_after_days, active) VALUES (?, ?, ?, ?, ?, 1)").bind(name, quota, accrual, every, docAfter).run();
  } catch { return bad("A leave type with that name already exists."); }
  await audit(env, me.id, "admin.leave_type_saved", { id, name, quota, accrual, every, docAfter });
  return json({ ok: true });
}

async function holidays(env) {
  const { results } = await env.DB.prepare("SELECT * FROM holidays WHERE date >= ? ORDER BY date").bind(todayIST().slice(0, 4) + "-01-01").all();
  return json({ holidays: results });
}
async function addHoliday(env, me, body) {
  const name = str(body.name, 80);
  if (!isValidDate(body.date)) return bad("Pick a date.");
  if (!name) return bad("Enter a name.");
  try { await env.DB.prepare("INSERT INTO holidays (date, name) VALUES (?, ?)").bind(body.date, name).run(); }
  catch { return bad("There's already a holiday on that date."); }
  await audit(env, me.id, "admin.holiday_added", { date: body.date, name });
  return json({ ok: true });
}
async function removeHoliday(env, me, id) {
  await env.DB.prepare("DELETE FROM holidays WHERE id = ?").bind(id).run();
  await audit(env, me.id, "admin.holiday_removed", { id });
  return json({ ok: true });
}

async function getSettings(env) {
  return json({ settings: (await loadSettings(env)).raw });
}
async function putSettings(env, me, body) {
  try {
    const changed = await saveSettings(env, body);
    await audit(env, me.id, "admin.settings_saved", changed);
    return json({ ok: true });
  } catch (e) { return bad(e.message); }
}

async function emailStatus(env) {
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.to_addr, o.subject, o.status, o.tries, o.error, o.created_at, o.sent_at, u.name
       FROM outbox o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 50`
  ).all();
  const counts = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM outbox GROUP BY status").all();
  return json({ mail: mailInfo(env), items: results, counts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])) });
}
async function emailTest(env, me) {
  if (!mailInfo(env).configured) return bad("Email isn't set up yet. Add the SMTP settings (see lna/README.md) and restart.");
  try {
    await sendMail(env, {
      to: me.email, subject: "Test email from HEXALIS Leave & Attendance",
      text: `Hi ${me.name.split(" ")[0]},\n\nEmail notifications are working.`,
      html: `<p>Hi ${me.name.split(" ")[0].replace(/[<>&"']/g, "")},</p><p>Email notifications are working.</p>`,
    });
  } catch (e) {
    const hint = /^53[05]/.test(e.message) ? " The mail server didn't accept the login: check SMTP_USER and SMTP_PASS (for Google, use an app password, not the normal password)."
      : /timed out|closed|ECONN|refused/i.test(e.message) ? " Couldn't reach the mail server: check SMTP_HOST and SMTP_PORT." : "";
    return bad(`The test email couldn't be sent.${hint} (${e.message.slice(0, 160)})`);
  }
  await audit(env, me.id, "admin.email_test");
  return json({ ok: true, to: me.email });
}
async function emailRetry(env, me) {
  const r = await env.DB.prepare("UPDATE outbox SET status = 'pending', tries = 0, next_at = ?, error = NULL, created_at = ? WHERE status = 'failed' RETURNING id").bind(nowISO(), nowISO()).all();
  await audit(env, me.id, "admin.email_retry", { count: r.results.length });
  return json({ ok: true, count: r.results.length });
}

async function auditLog(env, url) {
  const before = Number(url.searchParams.get("before")) || 2 ** 52;
  const who = Number(url.searchParams.get("person")) || null;
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.action, a.detail, a.at, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.id < ? ${who ? "AND a.user_id = ?" : ""} ORDER BY a.id DESC LIMIT 100`
  ).bind(...(who ? [before, who] : [before])).all();
  return json({ items: results });
}

// ---- routing ---------------------------------------------------------------------
export async function handleApi(env, request, me, parts) {
  const url = new URL(request.url);
  const m = request.method;
  let body = {};
  if (m === "POST") {
    if (Number(request.headers.get("Content-Length") || 0) > 2 * 1024 * 1024) return bad("That's too large to send.", 413);
    try { body = await request.json(); } catch { body = {}; }
    if (!body || typeof body !== "object") body = {};
  }
  const [a, b, c] = parts;
  const id = b && /^\d+$/.test(b) ? Number(b) : null;

  if (m === "GET" && a === "me") return overview(env, me);
  if (m === "GET" && a === "month") return myMonth(env, me, url);
  if (m === "POST" && a === "check-in") return checkIn(env, me, body, request);
  if (m === "POST" && a === "check-out") return checkOut(env, me);
  if (m === "GET" && a === "corrections") return myCorrections(env, me);
  if (m === "POST" && a === "corrections" && !b) return requestCorrection(env, me, body);
  if (m === "POST" && a === "corrections" && id && c === "cancel") return cancelCorrection(env, me, id);
  if (m === "GET" && a === "leave" && !b) return leaveOverview(env, me);
  if (m === "POST" && a === "leave" && !b) return applyLeave(env, me, body);
  if (m === "POST" && a === "leave" && id && c === "cancel") return cancelLeave(env, me, id);
  if (m === "GET" && a === "leave" && id && c === "document") return leaveDoc(env, me, id);
  if (m === "GET" && a === "approvals") return json({ items: await pendingApprovals(env, me) });
  if (m === "POST" && a === "approvals" && ["leave", "wfh", "correction"].includes(b) && /^\d+$/.test(c || "")) return decide(env, me, b, Number(c), body);
  if (m === "GET" && a === "team" && !b) return team(env, me, url);
  if (m === "GET" && a === "team" && b === "balances") return teamBalances(env, me);
  if (m === "GET" && a === "reports") return report(env, me, url);
  if (m === "GET" && a === "holidays") return holidays(env);
  if (m === "GET" && a === "profile") return json({ profile: await getProfile(env, me.id) });
  if (m === "POST" && a === "profile") return saveProfile(env, me, body);
  if (m === "GET" && a === "notifications") return notifications(env, me);
  if (m === "POST" && a === "notifications" && b === "read") return markRead(env, me);
  if (m === "POST" && a === "sign-out-others") { await endAllSessions(env, me.id, me.session_id); return json({ ok: true }); }

  if (a === "admin") {
    const denied = adminOnly(me);
    if (denied) return denied;
    const [, what, wid, action] = parts;
    const n = wid && /^\d+$/.test(wid) ? Number(wid) : null;
    if (m === "GET" && what === "people") return people(env);
    if (m === "POST" && what === "people" && !wid) return addPerson(env, me, body);
    if (m === "POST" && what === "people" && n && action === "sign-out") return signOutPerson(env, me, n);
    if (m === "POST" && what === "people" && n && !action) return updatePerson(env, me, n, body);
    if (m === "GET" && what === "leave-types") return leaveTypes(env);
    if (m === "POST" && what === "leave-types") return saveLeaveType(env, me, n, body);
    if (m === "POST" && what === "holidays" && !wid) return addHoliday(env, me, body);
    if (m === "POST" && what === "holidays" && n && action === "delete") return removeHoliday(env, me, n);
    if (m === "GET" && what === "settings") return getSettings(env);
    if (m === "POST" && what === "settings") return putSettings(env, me, body);
    if (m === "GET" && what === "audit") return auditLog(env, url);
    if (m === "GET" && what === "email") return emailStatus(env);
    if (m === "POST" && what === "email" && wid === "test") return emailTest(env, me);
    if (m === "POST" && what === "email" && wid === "retry") return emailRetry(env, me);
  }
  return bad("Not found.", 404);
}
