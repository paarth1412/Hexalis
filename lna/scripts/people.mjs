#!/usr/bin/env node
// Manage /lna accounts from the terminal (the People screen does the same).
// Everyone signs in with their @hexalis.in Google account; there are no passwords.
//
//   npm run lna:people -- add --name "Asha K" --email asha@hexalis.in --role employee --manager deepak@hexalis.in
//   Optional: --code HX-001 --department Sales --designation "Sales Executive" --joined 2026-04-01
//   npm run lna:people -- list
//
// Add --remote to work on the live database instead of the one on this Mac.
import { execFileSync } from "node:child_process";

const DOMAIN = "hexalis.in";
const ROLES = ["admin", "manager", "employee"];
const REMOTE = process.argv.includes("--remote");
const where = REMOTE ? ["--remote"] : ["--local", ...(process.env.LNA_PERSIST ? ["--persist-to", process.env.LNA_PERSIST] : [])];

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--remote") continue;
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}
const sql = (s) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

// Runs SQL on this Mac's database, or the live one with --remote. The SQL is
// passed as one argument (no shell), and values are quoted by sql() above.
function d1(sqlText) {
  return execFileSync("npx", ["wrangler", "d1", "execute", "hexalis-lna", ...where, "--command", sqlText.replace(/\s+/g, " "), "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
// Wrangler may print progress lines before the JSON result.
const parse = (out) => JSON.parse(out.slice(out.search(/^\s*\[/m)));
function fail(msg) { console.error(`\n  ${msg}\n`); process.exit(1); }

const a = args(process.argv.slice(2));
const cmd = a._[0];

if (cmd === "add") {
  const name = (a.name || "").trim();
  const email = (a.email || "").trim().toLowerCase();
  const role = a.role;
  if (!name) fail('Give a name: --name "Full Name"');
  if (!new RegExp(`^[a-z0-9._%+-]+@${DOMAIN.replace(".", "\\.")}$`).test(email)) fail(`Give an @${DOMAIN} email: --email name@${DOMAIN}`);
  if (!ROLES.includes(role)) fail(`Give a role: --role ${ROLES.join(" | ")}`);
  const manager = a.manager ? a.manager.trim().toLowerCase() : null;

  const code = a.code ? a.code.trim().toUpperCase() : null;
  const joined = a.joined ? a.joined.trim() : null;
  if (joined && !/^\d{4}-\d{2}-\d{2}$/.test(joined)) fail("Give the joining date as YYYY-MM-DD: --joined 2026-04-01");
  const mgrSql = manager ? `(SELECT id FROM users WHERE email = ${sql(manager)} AND role IN ('manager','admin') AND active = 1)` : "NULL";
  try {
    d1(`INSERT INTO users (email, name, role, manager_id, must_change, employee_code, department, designation, joining_date)
        VALUES (${sql(email)}, ${sql(name)}, ${sql(role)}, ${mgrSql}, 0, ${sql(code)}, ${sql(a.department || null)}, ${sql(a.designation || null)}, ${sql(joined)});
        INSERT INTO audit_log (action, detail, at) VALUES ('cli.person_added', ${sql(JSON.stringify({ email, role }))}, strftime('%Y-%m-%dT%H:%M:%SZ','now'));`);
  } catch (e) {
    const msg = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    if (/UNIQUE/i.test(msg) && /employee_code/i.test(msg)) fail(`Someone already has employee ID ${code}.`);
    if (/UNIQUE/i.test(msg)) fail(`${email} already has an account.`);
    if (/no such (table|column)/i.test(msg)) fail("The database isn't set up yet. Run:  npm run lna:migrate");
    fail("Couldn't create the account:\n  " + msg.split("\n").filter((l) => /error|ERROR/.test(l)).slice(0, 2).join("\n  "));
  }
  if (manager) {
    const check = parse(d1(`SELECT manager_id FROM users WHERE email = ${sql(email)};`))[0].results[0];
    if (!check.manager_id) console.warn(`\n  Note: ${manager} isn't an active manager or admin yet, so ${name} has no manager for now. Set it later under People.`);
  }
  console.log(`
  Account created
  ───────────────
  Name:                ${name}
  Email:               ${email}
  Role:                ${role}
  Database:  ${REMOTE ? "LIVE (hexalis.in)" : "this Mac only"}

  They can sign in now with "Sign in with Google" using ${email}.
`);
} else if (cmd === "list") {
  const rows = parse(d1(`SELECT u.name, u.email, u.role, m.email AS manager, u.active, u.must_change FROM users u LEFT JOIN users m ON m.id = u.manager_id ORDER BY u.role, u.name;`))[0].results;
  if (!rows.length) console.log("\n  No accounts yet.\n");
  else console.table(rows.map((r) => ({ name: r.name, email: r.email, role: r.role, manager: r.manager || "", status: !r.active ? "disabled" : "active" })));
} else {
  console.log(`
  Usage:
    npm run lna:people -- add --name "Full Name" --email name@${DOMAIN} --role admin|manager|employee [--manager boss@${DOMAIN}]
        [--code HX-001] [--department Sales] [--designation "Sales Executive"] [--joined YYYY-MM-DD]
    npm run lna:people -- list
    Add --remote to use the live database.
`);
}
