/**
 * Utility functions for exporting tabular financial data to CSV and Excel-compatible formats
 * while preserving high-precision financial decimals.
 */

export function convertToCsv(headers: string[], rows: (string | number)[][]): string {
  const escapeCsv = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCsv).join(",");
  const dataLines = rows.map((r) => r.map(escapeCsv).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

export function downloadCsvInBrowser(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
