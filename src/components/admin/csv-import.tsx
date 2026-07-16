"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  importProductsCsvAction,
  parseProductsCsvAction,
  type CsvImportResult,
  type CsvParseReport,
} from "@/server/actions/admin/products";

const ACTION_TONES = { create: "green", update: "blue", error: "red" } as const;

export function CsvImport() {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<CsvParseReport | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, startParse] = useTransition();
  const [importing, startImport] = useTransition();

  function onFile(file: File) {
    setError(null);
    setReport(null);
    setResult(null);
    if (file.size > 8 * 1024 * 1024) {
      setError("File too large (max 8 MB)");
      return;
    }
    setFileName(file.name);
    void file.text().then((text) => {
      setCsv(text);
      startParse(async () => {
        const r = await parseProductsCsvAction({ csv: text });
        setReport(r);
        if (!r.ok) setError(r.message ?? "Parse failed");
      });
    });
  }

  function confirmImport() {
    if (!csv) return;
    setError(null);
    startImport(async () => {
      const r = await importProductsCsvAction({ csv });
      setResult(r);
      if (!r.ok) setError(r.message ?? "Import failed");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-600">
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {fileName && <span className="text-sm text-gray-600">{fileName}</span>}
        {parsing && (
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner className="size-4" /> Validating…
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {report?.ok && !result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="gray">{report.totalRows} row(s)</Badge>
            <Badge tone="green">{report.createCount} to create</Badge>
            <Badge tone="blue">{report.updateCount} to update</Badge>
            <Badge tone={report.errorCount ? "red" : "gray"}>{report.errorCount} error(s)</Badge>
            {report.ignoredColumns && report.ignoredColumns.length > 0 && (
              <Badge tone="amber">ignored columns: {report.ignoredColumns.join(", ")}</Badge>
            )}
          </div>

          {report.preview && report.preview.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr>
                    {["Line", "Action", "SKU", "Name", "Price", "Note"].map((h) => (
                      <th
                        key={h}
                        className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.preview.map((r) => (
                    <tr key={r.line}>
                      <td className="border-b border-gray-100 px-3 py-1.5 text-xs text-gray-400">
                        {r.line}
                      </td>
                      <td className="border-b border-gray-100 px-3 py-1.5">
                        <Badge tone={ACTION_TONES[r.action]}>{r.action}</Badge>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-1.5 font-mono text-xs text-gray-500">
                        {r.sku || "—"}
                      </td>
                      <td className="max-w-sm border-b border-gray-100 px-3 py-1.5">
                        <span className="line-clamp-1">{r.name || "—"}</span>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-1.5 text-xs">{r.price || "—"}</td>
                      <td className="max-w-xs border-b border-gray-100 px-3 py-1.5 text-xs text-gray-500">
                        <span className="line-clamp-2">{r.note || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-400">
                Showing the first {report.preview.length} row(s).
              </p>
            </div>
          )}

          {report.rowErrors && report.rowErrors.length > 0 && (
            <details className="rounded-lg border border-red-200 bg-red-50/50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-red-700">
                {report.errorCount} row error(s) — these rows are skipped
              </summary>
              <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto text-xs text-red-700">
                {report.rowErrors.map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
            <Button onClick={confirmImport} disabled={importing || (report.createCount === 0 && report.updateCount === 0)}>
              {importing && <Spinner className="size-4 border-white/40 border-t-white" />}
              Import {report.createCount ?? 0} + update {report.updateCount ?? 0}
            </Button>
            <p className="text-xs text-gray-400">Rows with errors are skipped. This cannot be undone.</p>
          </div>
        </div>
      )}

      {result?.ok && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">{result.message}</p>
          {result.rowErrors && result.rowErrors.length > 0 && (
            <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto text-xs text-red-700">
              {result.rowErrors.map((e) => (
                <li key={e.line}>
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
