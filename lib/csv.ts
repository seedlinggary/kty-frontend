export interface CsvColumn {
  key: string;
  label: string;
}

const UTF8_BOM = "﻿";

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(columns: CsvColumn[], rows: Record<string, string | number>[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(String(row[c.key] ?? ""))).join(",")
  );
  // Leading UTF-8 BOM so Excel opens Hebrew text correctly instead of mojibake.
  return UTF8_BOM + [header, ...lines].join("\r\n");
}
