// Turning what an admin types (a small Markdown dialect with {{merge fields}}) into the email or text that goes out. Pure, shared
// by the compose page's live preview and the send function, tested directly.

export const MERGE_FIELDS = ["firstName", "lastName", "fullName", "email"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeVars = Partial<Record<MergeField, string>> & Record<string, string | undefined>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mergeVarsFor(person: { name: string; email: string | null }): MergeVars {
  const name = (person.name ?? "").trim();
  const [first = "", ...rest] = name.split(/\s+/).filter(Boolean);
  return { firstName: first, lastName: rest.join(" "), fullName: name, email: person.email ?? "" };
}

const FIELD_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

// Names used in `text` that are not merge fields we know, so the form can refuse to send "Hi {{frstName}}".
export function unknownMergeFields(text: string, known: readonly string[] = MERGE_FIELDS): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(FIELD_PATTERN)) if (!known.includes(match[1])) found.add(match[1]);
  return [...found];
}

// Plain-text fill-in (subjects, the text part of an email, SMS bodies).
export function fillMergeFields(text: string, vars: MergeVars): string {
  return text.replace(FIELD_PATTERN, (whole, name: string) => (vars[name] !== undefined ? String(vars[name]) : whole));
}

// HTML fill-in: values are escaped. Run on HTML that was already made from Markdown, so a name containing `*` or `[` can't be
// read as formatting.
export function fillMergeFieldsHtml(html: string, vars: MergeVars): string {
  return html.replace(FIELD_PATTERN, (whole, name: string) => (vars[name] !== undefined ? escapeHtml(String(vars[name])) : whole));
}

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

function inline(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, url: string) => {
      const decoded = url.replace(/&amp;/g, "&");
      return SAFE_LINK.test(decoded) ? `<a href="${url}" style="color:#0C74C1">${label}</a>` : whole;
    })
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

// Supported: **bold**, *italic*, - bullet lists, [links](https://...), blank-line paragraphs, and single line breaks kept.
export function markdownToHtml(markdown: string): string {
  const blocks = markdown.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length > 0 && lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      const items = lines.map((l) => `<li style="margin:0 0 4px">${inline(escapeHtml(l.replace(/^\s*[-*]\s+/, "")))}</li>`);
      out.push(`<ul style="margin:0 0 16px;padding-left:22px">${items.join("")}</ul>`);
    } else if (block.trim()) {
      out.push(`<p style="margin:0 0 16px">${lines.map((l) => inline(escapeHtml(l))).join("<br>")}</p>`);
    }
  }
  return out.join("\n");
}

export function markdownToText(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
    .trim();
}

// Slack formats text its own way: *bold*, _italic_, <url|label>, and no list markup. Bold is parked behind a placeholder while
// italics are converted, otherwise the new *bold* would be read as italic.
export function markdownToSlack(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "<$2|$1>")
    .replace(/\*\*([^*\n]+)\*\*/g, "\u0000$1\u0000")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1_$2_")
    .replace(/\u0000/g, "*")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

export interface EmailLayoutInput {
  bodyHtml: string;
  // Present for bulk mail; absent for a test to yourself.
  unsubscribeUrl?: string | null;
  footerNote?: string | null;
}

// The branded wrapper around a message: UC navy and blue, one column, with the unsubscribe line every bulk email needs.
export function composeEmailHtml({ bodyHtml, unsubscribeUrl, footerNote }: EmailLayoutInput): string {
  const unsubscribe = unsubscribeUrl
    ? `<p style="margin:8px 0 0"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#5c5c60">Unsubscribe</a> from messages like this.</p>`
    : "";
  const note = footerNote ? `<p style="margin:0">${escapeHtml(footerNote)}</p>` : "";
  return `<!doctype html>
<html><body style="margin:0;background:#f2f2f3;font-family:Montserrat,Arial,Helvetica,sans-serif;color:#042742">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #d3d3d7">
<tr><td style="padding:20px 28px;border-bottom:3px solid #0C74C1;font-weight:700;font-size:20px"><span style="color:#0C74C1">U</span>Consulting</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#5c5c60;border-top:1px solid #d3d3d7">${note}${unsubscribe}</td></tr>
</table></td></tr></table></body></html>`;
}

// What lands in the log for a message: the first line of text, for scanning a list of sends.
export function previewLine(text: string, max = 120): string {
  const flat = markdownToText(text).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
