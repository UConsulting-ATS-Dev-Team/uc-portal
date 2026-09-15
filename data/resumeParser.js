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
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
}

// Covers both real Word documents and a Google Doc exported/downloaded as
// .docx (Google Docs' own native format isn't directly fetchable by this
// app, so .docx is the real common ground for both sources).
async function extractDocxText(arrayBuffer) {
  const { default: mammoth } = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

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
