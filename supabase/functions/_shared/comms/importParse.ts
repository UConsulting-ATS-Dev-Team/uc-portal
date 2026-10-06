// Reads a pasted or uploaded list of contacts (a spreadsheet saved as CSV, or lines typed by hand) into rows the mailing list can
// take. Pure and tested; the page shows the problems it finds before anything is saved.

export interface ParsedContact {
  email: string;
  name: string | null;
  tags: string[];
}

export interface ParseResult {
  rows: ParsedContact[];
  problems: Array<{ line: number; text: string; reason: string }>;
  duplicates: number;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(current.trim());
      current = "";
    } else current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function guessDelimiter(line: string): string {
  if (line.includes("\t")) return "\t";
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

// Columns are email, name, tags (tags separated by | or ;). A header row naming those columns, in any order, is honored.
export function parseContactList(text: string): ParseResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const rows: ParsedContact[] = [];
  const problems: ParseResult["problems"] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let columns = { email: 0, name: 1, tags: 2 };
  let started = false;

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const delimiter = guessDelimiter(line);
    const cells = splitLine(line, delimiter);

    if (!started) {
      started = true;
      const lower = cells.map((c) => c.toLowerCase());
      if (lower.some((c) => c === "email" || c === "email address" || c === "e-mail")) {
        const find = (...names: string[]) => lower.findIndex((c) => names.includes(c));
        const email = find("email", "email address", "e-mail");
        const name = find("name", "full name");
        const tags = find("tags", "tag", "groups");
        columns = { email, name: name >= 0 ? name : -1, tags: tags >= 0 ? tags : -1 };
        return;
      }
    }

    const email = (cells[columns.email] ?? "").toLowerCase();
    if (!EMAIL.test(email)) {
      problems.push({ line: index + 1, text: line, reason: email ? "Not a valid email address" : "No email address" });
      return;
    }
    if (seen.has(email)) {
      duplicates++;
      return;
    }
    seen.add(email);
    const name = columns.name >= 0 ? cells[columns.name] || null : null;
    const tags = columns.tags >= 0 && cells[columns.tags] ? cells[columns.tags].split(/[|;]/).map((t) => t.trim()).filter(Boolean) : [];
    rows.push({ email, name, tags });
  });

  return { rows, problems, duplicates };
}
