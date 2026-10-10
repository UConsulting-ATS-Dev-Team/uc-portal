// Turns rows into a CSV file the browser downloads. Used by the admin exports (mailing list, reports). A cell that starts with =, +,
// - or @ is prefixed with an apostrophe so a spreadsheet shows it as text instead of running it as a formula; plain numbers are left alone.

function cell(value) {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// header: string[]; rows: array of arrays in the same column order.
export function toCsv(header, rows) {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
