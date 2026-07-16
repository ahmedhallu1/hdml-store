import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { Pagination } from "@/components/site/pagination";
import { fmtDateTime } from "@/components/admin/format";
import { EmptyState, PageHeader, TableShell, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

interface AuditRow {
  id: string;
  admin_id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export default async function AdminAuditPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const service = supabaseService();
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await service
    .from("admin_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) console.error("audit query failed:", error.message);

  const rows = (data ?? []) as AuditRow[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="rise-in">
      <PageHeader
        title="Audit log"
        description={`${total.toLocaleString("en-US")} recorded admin action(s), newest first.`}
      />

      {rows.length === 0 ? (
        <EmptyState title="No audit entries yet" hint="Every admin mutation is recorded here." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Admin</Th>
              <Th>Meta</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-gray-50">
                <Td className="whitespace-nowrap text-xs text-gray-400">
                  {fmtDateTime(r.created_at)}
                </Td>
                <Td className="whitespace-nowrap font-medium text-gray-900">{r.action}</Td>
                <Td className="whitespace-nowrap text-xs">
                  {r.entity ?? "—"}
                  {r.entity_id && (
                    <span className="block max-w-40 truncate font-mono text-gray-400" title={r.entity_id}>
                      {r.entity_id}
                    </span>
                  )}
                </Td>
                <Td className="max-w-32">
                  <span className="block truncate font-mono text-xs text-gray-400" title={r.admin_id}>
                    {r.admin_id}
                  </span>
                </Td>
                <Td className="max-w-md">
                  {r.meta && Object.keys(r.meta).length > 0 ? (
                    <pre className="max-h-32 overflow-auto rounded-md bg-gray-50 p-2">
                      <code className="text-[11px] leading-4 text-gray-600">
                        {JSON.stringify(r.meta, null, 2)}
                      </code>
                    </pre>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <div className="mt-4">
        <Pagination page={page} pageCount={pageCount} basePath="/admin/audit" />
      </div>
    </div>
  );
}
