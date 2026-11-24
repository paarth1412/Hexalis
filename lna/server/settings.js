// Admin-editable settings (Settings → Office & shift) and the shift arithmetic
// that uses them. India has no daylight saving, so IST is always UTC+5:30.
import { nowISO, todayIST } from "./util.js";

const IST_OFFSET_MIN = 330;

export const DEFAULTS = {
  shift_start: "09:30",
  shift_end: "18:30",
  grace_min: "15",
  full_day_hours: "8",
  half_day_hours: "4",
  weekend: "0,6",
  idle_minutes: "60",
  office_lat: "",
  office_lon: "",
  office_radius_m: "0",
};

export async function loadSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const s = { ...DEFAULTS };
  for (const r of results) if (r.key in DEFAULTS) s[r.key] = r.value;
  return {
    raw: s,
    shiftStart: hhmmToMin(s.shift_start),
    shiftEnd: hhmmToMin(s.shift_end),
    grace: Number(s.grace_min) || 0,
    fullMin: Number(s.full_day_hours) * 60,
    halfMin: Number(s.half_day_hours) * 60,
    weekend: new Set(s.weekend.split(",").filter((x) => x !== "").map(Number)),
    idleMinutes: Number(s.idle_minutes) || 60,
    office: s.office_lat !== "" && s.office_lon !== "" && Number(s.office_radius_m) > 0
      ? { lat: Number(s.office_lat), lon: Number(s.office_lon), radius: Number(s.office_radius_m) } : null,
  };
}

// Validates and stores whatever subset of settings the admin sent.
export async function saveSettings(env, body) {
  const out = {};
  const time = (k) => { if (body[k] !== undefined) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body[k])) throw new Error("Enter times as HH:MM, e.g. 09:30."); out[k] = body[k]; } };
  const num = (k, min, max, label) => {
    if (body[k] === undefined) return;
    const n = Number(body[k]);
    if (body[k] === "" || !Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
    out[k] = String(n);
  };
  time("shift_start"); time("shift_end");
  num("grace_min", 0, 180, "Grace period");
  num("full_day_hours", 1, 16, "Full-day hours");
  num("half_day_hours", 0.5, 12, "Half-day hours");
  num("idle_minutes", 10, 720, "Idle sign-out");
  if (body.weekend !== undefined) {
    const days = [...new Set(String(body.weekend).split(",").filter((x) => x !== "").map(Number))];
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || days.length > 3) throw new Error("Pick up to three weekly days off.");
    out.weekend = days.sort().join(",");
  }
  if (body.office_radius_m !== undefined) {
    const r = Number(body.office_radius_m);
    if (!Number.isFinite(r) || r < 0 || r > 5000) throw new Error("Office radius must be between 0 and 5000 metres (0 turns the check off).");
    if (r > 0) {
      const lat = Number(body.office_lat), lon = Number(body.office_lon);
      if (body.office_lat === "" || body.office_lon === "" || !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) {
        throw new Error("Enter the office latitude and longitude, or set the radius to 0.");
      }
      out.office_lat = String(lat); out.office_lon = String(lon);
    }
    out.office_radius_m = String(r);
  }
  const merged = { ...(await loadSettings(env)).raw, ...out };
  if (hhmmToMin(merged.shift_end) <= hhmmToMin(merged.shift_start)) throw new Error("The shift must end after it starts.");
  if (Number(merged.half_day_hours) >= Number(merged.full_day_hours)) throw new Error("Half-day hours must be fewer than full-day hours.");
  for (const [k, v] of Object.entries(out)) {
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, v).run();
  }
  return out;
}

// ---- time helpers -------------------------------------------------------------
export function hhmmToMin(s) {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + m;
}
export function minToHhmm(n) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
// Minutes since midnight, India time, of a stored UTC timestamp.
export function istMinutes(iso) {
  return ((Math.floor(Date.parse(iso) / 60000) + IST_OFFSET_MIN) % 1440 + 1440) % 1440;
}
// UTC timestamp for a date + HH:MM in India time.
export function istToISO(date, hhmm) {
  const [y, m, d] = date.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + (hhmmToMin(hhmm) - IST_OFFSET_MIN) * 60000;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}
export const nowMinutesIST = () => istMinutes(nowISO());

// Shift results for one attendance record. Stored when the day is recorded,
// so changing the shift later doesn't rewrite history.
export function shiftResult(cfg, checkInISO, checkOutISO) {
  const inMin = istMinutes(checkInISO);
  const late = inMin > cfg.shiftStart + cfg.grace ? 1 : 0;
  if (!checkOutISO) return { late, early: 0, worked_min: null, day_status: null };
  const worked = Math.max(0, Math.round((Date.parse(checkOutISO) - Date.parse(checkInISO)) / 60000));
  const outMin = istMinutes(checkOutISO);
  return {
    late,
    early: outMin < cfg.shiftEnd ? 1 : 0,
    worked_min: worked,
    day_status: worked >= cfg.fullMin ? "present" : worked >= cfg.halfMin ? "half_day" : "short",
  };
}

// Great-circle distance in metres.
export function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export { todayIST };
