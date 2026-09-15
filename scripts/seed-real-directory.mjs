#!/usr/bin/env node
// Re-seeds the real `roster`/`people` tables from the club's own
// "UConsulting Directory" Google Sheet -- the reusable replacement for
// what used to be a one-time, git-committed migration
// (20260914010000_seed_roster_from_directory.sql,
// 20260914070000_import_real_people.sql). Those were removed from this
// repo's git history on 2026-09-15 because committing real member PII
// (names, personal emails, LinkedIn URLs) directly into a migration file
// means it's sitting in plain text in every clone forever -- see
// CLAUDE.md's dated entry for the full story. The rule going forward:
// real member data is never committed to git, full stop. This script is
// how a fresh environment (or an admin adding newly graduated/admitted
// members) gets that data back, without ever putting it in git.
//
// HOW TO USE
// 1. Open the real "UConsulting Directory" sheet, and for each tab you
//    want (Active and/or Alumni), File > Download > Comma Separated
//    Values (.csv), save it as scripts/directory-export.csv (gitignored
//    -- see .gitignore -- never remove that entry). If you have both
//    tabs as separate exports, run this script once per file, or
//    combine them into one CSV with a Status column distinguishing them
//    (this script expects a Status column either way -- see
//    COLUMN_MAP below).
// 2. Run a dry run first (the default -- this never touches the
//    database):
//      node scripts/seed-real-directory.mjs
//    Read the printed summary carefully: row counts, any skipped/
//    warned rows, and a sample of what would actually be written.
// 3. Once the dry run looks right, apply it for real:
//      node scripts/seed-real-directory.mjs --apply
//    You'll be prompted for a real admin account's email/password --
//    typed at the terminal, never written to any file. Both `roster`
//    and `people` grant admins full write access via RLS
//    (`roster_admin_all`/`people_admin_all`), so this authenticates as
//    that admin and writes through the normal RLS path -- no service-
//    role key needed or used anywhere in this script.
//
// COLUMN_MAP below is a best guess at the real sheet's header names,
// based on what fields ended up in the (now-removed) original import --
// NOT verified against a live export, since no CSV was available while
// writing this. Check the real sheet's actual headers and adjust
// COLUMN_MAP before your first real run if they don't match; the dry
// run's printed sample is exactly for catching a wrong mapping before
// anything gets written.
//
// Deliberately does NOT estimate class_year/graduating_class from
// admit_class, and does NOT populate role/industry from a "Designation"-
// style column (a club committee position, not a job title) -- same
// no-invented-precision rule the original import followed. Only fields
// with a direct, real source column get populated.

import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = process.argv.find((a) => a.startsWith("--csv="))?.slice("--csv=".length) ?? path.join(__dirname, "directory-export.csv");
const APPLY = process.argv.includes("--apply");

// Adjust these to match the real sheet's actual column headers if they
// differ -- the dry run's sample output is exactly how you'd catch a
// mismatch (e.g. every row showing an empty email) before it matters.
const COLUMN_MAP = {
  name: "Name",
  status: "Status", // must read as "Active" or "Alumni" (case-insensitive) -- other values are skipped
  admitClass: "Admit Class",
  major: "Major",
  company: "Company",
  location: "Location",
  email: "Email",
  linkedin: "LinkedIn",
  mentor: "Mentor",
};

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

// A small RFC4180-ish CSV parser -- not a full spec implementation, but
// handles quoted fields (incl. embedded commas/quotes) and, critically,
// preserves EMPTY fields as empty strings at their real column position.
// A prior pass at this exact real-data import (see CLAUDE.md's Progress
// log) found that dropping empty cells before mapping columns silently
// shifts every later value into the wrong field -- this parser is
// deliberately index-aligned throughout to avoid that bug by
// construction, not by discipline.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function rowsToObjects(rows) {
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()])));
}

// Deterministic, not random -- same email always produces the same slug,
// so re-running this script on the same/updated CSV safely upserts
// existing people instead of creating duplicates.
function slugFor(name, email) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let hash = 0;
  for (const ch of email.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `${base}-${hash.toString(16).slice(0, 6).padStart(6, "0")}`;
}

async function main() {
  loadEnvFile();

  if (!existsSync(CSV_PATH)) {
    console.error(`No CSV found at ${CSV_PATH}.`);
    console.error("Export the real Directory sheet as CSV and save it there first (see this script's header comment) -- pass --csv=<path> to use a different location.");
    process.exitCode = 1;
    return;
  }

  const objects = rowsToObjects(parseCsv(readFileSync(CSV_PATH, "utf8")));
  console.log(`Parsed ${objects.length} rows from ${CSV_PATH}.`);

  const peopleRows = [];
  const rosterRows = [];
  const seenEmails = new Set();
  const warnings = [];

  for (const [i, obj] of objects.entries()) {
    const statusRaw = (obj[COLUMN_MAP.status] || "").trim().toLowerCase();
    const status = statusRaw === "active" ? "Current member" : statusRaw === "alumni" ? "Alumni" : null;
    if (!status) {
      warnings.push(`Row ${i + 2}: unrecognized status "${obj[COLUMN_MAP.status]}", skipped.`);
      continue;
    }

    const name = (obj[COLUMN_MAP.name] || "").trim();
    const email = (obj[COLUMN_MAP.email] || "").trim().toLowerCase();
    if (!name || !email) {
      warnings.push(`Row ${i + 2}: missing name or email, skipped.`);
      continue;
    }
    if (seenEmails.has(email)) {
      warnings.push(`Row ${i + 2}: duplicate email ${email}, skipped.`);
      continue;
    }
    seenEmails.add(email);

    peopleRows.push({
      slug: slugFor(name, email),
      name,
      status,
      admit_class: obj[COLUMN_MAP.admitClass] || null,
      major: obj[COLUMN_MAP.major] || null,
      company: obj[COLUMN_MAP.company] || null,
      location: obj[COLUMN_MAP.location] || null,
      email,
      linkedin: obj[COLUMN_MAP.linkedin] || null,
      mentor: obj[COLUMN_MAP.mentor] || null,
    });

    // roster (the sign-up allowlist) is current members only -- alumni
    // get access via the real "Alumni -- request access" admin-approval
    // flow instead, same as the original seed's own scoping.
    if (status === "Current member") {
      rosterRows.push({ email, name });
    }
  }

  console.log(`\n${peopleRows.length} people rows ready (${rosterRows.length} of them also go to roster).`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings.slice(0, 20)) console.log(`  - ${w}`);
    if (warnings.length > 20) console.log(`  ...and ${warnings.length - 20} more.`);
  }
  console.log("\nSample (first 3 people rows):");
  console.log(peopleRows.slice(0, 3));

  if (!APPLY) {
    console.log("\nDry run only -- nothing written. Re-run with --apply once this looks correct.");
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error("Missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in .env.");
    process.exitCode = 1;
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question("Admin email: ");
  const password = await rl.question("Admin password: ");
  rl.close();

  const supabase = createClient(supabaseUrl, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error(`Sign-in failed: ${authError.message}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nWriting people...");
  const { error: peopleError } = await supabase.from("people").upsert(peopleRows, { onConflict: "slug" });
  if (peopleError) {
    console.error(`people upsert failed: ${peopleError.message}`);
    console.error("(If this is a permissions error, confirm the signed-in account really has profiles.role = 'admin'.)");
    process.exitCode = 1;
    return;
  }

  console.log("Writing roster...");
  const { error: rosterError } = await supabase.from("roster").upsert(rosterRows, { onConflict: "email", ignoreDuplicates: true });
  if (rosterError) {
    console.error(`roster upsert failed: ${rosterError.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nDone. ${peopleRows.length} people, ${rosterRows.length} roster rows upserted.`);
}

main();
