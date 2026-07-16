import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { fmtDateTime } from "@/components/admin/format";
import { EmptyState, PageHeader, TableShell, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Import batches" };

interface BatchRow {
  id: string;
  source: string;
  stats: Record<string, unknown>;
  created_at: string;
}

export default async function AdminImportsPage() {
  await requireAdmin();
  const service = supabaseService();

  const { data, error } = await service
    .from("import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) console.error("import batches query failed:", error.message);
  const batches = (data ?? []) as BatchRow[];

  return (
    <div className="rise-in">
      <PageHeader
        title="Import batches"
        description="History of catalog imports (initial script + admin CSV imports)."
      />

      {batches.length === 0 ? (
        <EmptyState title="No imports recorded" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Source</Th>
              <Th>Stats</Th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="align-top hover:bg-gray-50">
                <Td className="whitespace-nowrap text-xs text-gray-400">
                  {fmtDateTime(b.created_at)}
                </Td>
                <Td className="whitespace-nowrap font-medium">{b.source}</Td>
                <Td>
                  <div className="flex max-w-xl flex-wrap gap-1.5">
                    {Object.entries(b.stats ?? {}).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
