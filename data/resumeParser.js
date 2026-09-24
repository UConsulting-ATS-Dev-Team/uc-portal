// Real text extraction + heuristic field parsing for uploaded resumes.
// No LLM/external API involved (a real cost/setup tradeoff the user chose
// not to take on for this pass) -- pattern-matching against common resume
// phrasing instead. Deliberately conservative: every extracted field is
// only ever used to fill a currently-EMPTY My Profile field (never
// overwrite), same "no invented precision, never silently overwrite a
// member's own edit" rule every other prefill source in this app follows
// (Directory auto-fill, etc.) -- a wrong heuristic match is a worse
// outcome than leaving a field blank, but it's never worse than what the
// member already typed themselves.
//
// pdfjs-dist/mammoth are both dynamically imported (inside the two
// extract* functions below), not imported at module top level -- a static
// import pulled both into the app's main JS bundle, adding ~1MB to the
// initial page load for every single visit regardless of whether that
// member ever touches resume upload. Dynamic import code-splits them into
// their own chunk(s), fetched only the moment a resume is actually parsed.

// Handles a real PDF regardless of how it was produced -- a LaTeX/Overleaf
// export is just a normal PDF once compiled, no special-casing needed.
//
// Reconstructs real line breaks from each text item's own y-position
// (pdf.js's getTextContent() has no notion of "lines" on its own -- items
// are just positioned glyphs/runs) -- this used to just space-join every
// item with no newlines within a page at all, which silently limited
// parseClassYear()/parseMajor() below (their [^.\n] boundaries only ever
// matched across a *page* break, never a real line break) and made a real
// per-bullet resume-quality read (analyzeResumeText() below) impossible.
// A >2pt vertical jump between consecutive items is treated as a new
// line -- generous enough to not fire on normal sub/superscript jitter
// within one line, tight enough to catch real line changes.
async function extractPdfText(arrayBuffer) {
  const [pdfjsLib, { default: pdfWorkerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let pageText = "";
    let lastY = null;
    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        pageText += "\n";
      } else if (pageText && !/[\s\n]$/.test(pageText)) {
        pageText += " ";
      }
      pageText += item.str;
      lastY = y;
    }
    pages.push(pageText);
  }
  return { text: pages.join("\n"), pageCount: pdf.numPages };
}

// Covers both real Word documents and a Google Doc exported/downloaded as
// .docx (Google Docs' own native format isn't directly fetchable by this
// app, so .docx is the real common ground for both sources). No real page
// count available from mammoth's raw-text extraction -- pageCount stays
// null, and analyzeResumeText() below skips the length check rather than
// guess one from word count.
async function extractDocxText(arrayBuffer) {
  const { default: mammoth } = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return { text: result.value, pageCount: null };
}

// Returns { text, pageCount } -- pageCount is a real PDF page count, or
// null for .docx / anything analyzeResumeText() can't measure.
export async function extractResumeText(file) {
  const buffer = await file.arrayBuffer();
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return extractPdfText(buffer);
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name)
  ) {
    return extractDocxText(buffer);
  }
  throw new Error("Resume must be a PDF or Word (.docx) file.");
}

const CURRENT_YEAR = new Date().getFullYear();

// Looks for a real graduation-year signal near the phrasing resumes
// actually use ("Expected May 2027", "Expected Graduation: 2027", "Class
// of 2027", "Graduation Date 2027") -- bounded to a plausible near-future
// range so a birth year, a past employment year, or a phone-number digit
// run never gets mistaken for a graduation year.
function parseClassYear(text) {
  const nearKeyword = text.match(
    /(?:expected|anticipated)[^.\n]{0,40}?(20\d{2})|class of[^.\n]{0,10}?(20\d{2})|graduat(?:e|ion|ing)[^.\n]{0,40}?(20\d{2})/i
  );
  const year = nearKeyword && Number(nearKeyword[1] || nearKeyword[2] || nearKeyword[3]);
  if (year && year >= CURRENT_YEAR - 1 && year <= CURRENT_YEAR + 6) return year;
  return null;
}

// Common "B.S. in Computer Science" / "Bachelor of Arts, Economics" /
// "Major: Statistics" phrasing. Capped length and cut at the first
// newline/pipe/comma-separated trailing clause (GPA, minor, honors) so a
// match doesn't run on into unrelated text.
function parseMajor(text) {
  const degreeLine = text.match(
    /\b(?:B\.?A\.?|B\.?S\.?|Bachelor of (?:Arts|Science))\s*(?:in|,|:)?\s*([A-Z][A-Za-z&/ ]{2,60}?)(?:\s*[,|\n]|\s+GPA|\s+Minor|$)/
  );
  if (degreeLine) return degreeLine[1].trim();
  const labeled = text.match(/\bMajor\s*:\s*([A-Z][A-Za-z&/ ]{2,60}?)(?:\s*[,|\n]|$)/);
  if (labeled) return labeled[1].trim();
  return null;
}

function parseLinkedIn(text) {
  const match = text.match(/linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/i);
  return match ? `https://www.${match[0].replace(/^https?:\/\/(www\.)?/i, "")}` : null;
}

// Returns only fields it found real signal for (never a guessed default) --
// callers apply the "only fill if currently empty" rule on top of this.
export function parseResumeFields(text) {
  return {
    classYear: parseClassYear(text),
    majors: parseMajor(text),
    linkedIn: parseLinkedIn(text),
  };
}

// Real, heuristic resume-quality feedback -- the "resume workshops" item
// from the original MVP notes, scoped down once the user clarified UC
// doesn't actually run workshops: automated scanning + suggestions
// instead. Same no-LLM discipline as the rest of this file -- pattern-
// matching against well-established, generic resume-coaching heuristics
// (quantify impact, lead with an action verb, one page for undergrad),
// not a fabricated "AI review." Only fires a suggestion when there's real
// signal to point to (a real bullet count, a real page count) -- never a
// vague "this could be better."
const BULLET_PREFIX = /^[•\-*◦▪]\s*/;
const WEAK_START_PHRASES = [
  "responsible for",
  "duties included",
  "worked on",
  "helped with",
  "assisted with",
  "in charge of",
  "tasked with",
  "was involved in",
];
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function analyzeResumeText(text, { pageCount } = {}) {
  const suggestions = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((l) => BULLET_PREFIX.test(l)).map((l) => l.replace(BULLET_PREFIX, ""));

  if (pageCount != null && pageCount >= 2) {
    suggestions.push({
      id: "length",
      severity: "medium",
      message: `This resume is ${pageCount} pages -- most undergraduate/early-career resumes read best at one page.`,
    });
  }

  if (bulletLines.length > 0) {
    const quantified = bulletLines.filter((l) => /\d/.test(l)).length;
    if (quantified / bulletLines.length < 0.3) {
      suggestions.push({
        id: "quantify",
        severity: "medium",
        message: `Only ${quantified} of ${bulletLines.length} bullet points include a number (%, $, count) -- quantifying impact ("increased X by 20%") reads stronger than a plain description.`,
      });
    }

    const weakCount = bulletLines.filter((l) => WEAK_START_PHRASES.some((p) => l.toLowerCase().startsWith(p))).length;
    if (weakCount > 0) {
      suggestions.push({
        id: "weak-phrasing",
        severity: "low",
        message: `${weakCount} bullet point${weakCount === 1 ? "" : "s"} start${weakCount === 1 ? "s" : ""} with a weak phrase ("responsible for", "worked on", etc.) -- leading with a strong action verb instead is a common, easy fix.`,
      });
    }
  }

  if (!EMAIL_PATTERN.test(text)) {
    suggestions.push({
      id: "no-email",
      severity: "high",
      message: "No email address found on the resume -- make sure your contact info is clearly visible near the top.",
    });
  }

  return suggestions;
}
