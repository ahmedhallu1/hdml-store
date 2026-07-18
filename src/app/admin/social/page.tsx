import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSocialConfig, listSocialPosts } from "@/lib/social/store";
import { metaConfigured } from "@/lib/social/meta";
import { formatSlot, nextSlotAfter } from "@/lib/social/slot";
import { PageHeader } from "@/components/admin/ui";
import { QueueTable } from "@/components/admin/social/queue-table";

export const metadata = { title: "Social auto-poster" };

export default async function AdminSocialPage() {
  await requireAdmin();

  const [config, posts] = await Promise.all([getSocialConfig(), listSocialPosts()]);
  const configured = metaConfigured();
  const armed = config.enabled && configured;
  const nextSlot = formatSlot(
    nextSlotAfter(new Date(), config.weeklySlot, config.timezone).toISOString(),
    config.timezone,
  );

  return (
    <div className="rise-in">
      <PageHeader
        title="Social auto-poster"
        description="Queue one post a week — it's tailored per platform, emailed to you to approve, then published to Facebook & Instagram."
        actions={
          <>
            <Link
              href="/admin/social/new"
              className="inline-flex h-9 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              New post
            </Link>
            <Link
              href="/admin/social/settings"
              className="inline-flex h-9 items-center rounded-lg border border-brand-200 px-4 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-50"
            >
              Settings
            </Link>
          </>
        }
      />

      {armed ? (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-semibold">Armed</span> — next slot {nextSlot}
        </div>
      ) : (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Not live yet</span> — connect Meta (see{" "}
          <span className="font-mono">docs/SOCIAL-SETUP.md</span>) and switch it on in{" "}
          <Link href="/admin/social/settings" className="font-medium underline">
            Settings
          </Link>
          .
        </div>
      )}

      <QueueTable posts={posts} config={config} />
    </div>
  );
}
