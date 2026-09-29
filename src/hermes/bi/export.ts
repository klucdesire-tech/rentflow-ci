import { QueryResult } from "./semantic";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV au format Excel FR (séparateur ";"). */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map(r => r.map(cell).join(";")).join("\n");
}

export function resultToCsv(r: QueryResult): string {
  return toCsv(
    [...r.dimensions.map(d => d.label), ...r.metrics.map(m => m.label)],
    r.rows.map(row => [...row.labels, ...row.values.map(v => (v === null ? "" : Math.round(v * 10000) / 10000))]),
  );
}

export function tableToCsv(rows: object[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return toCsv(headers, rows.map(r => headers.map(h => (r as Record<string, unknown>)[h])));
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
