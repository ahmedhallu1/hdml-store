import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSocialConfig } from "@/lib/social/store";
import { metaConfigured } from "@/lib/social/meta";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/social/settings-form";

export const metadata = { title: "Social settings" };

export default async function SocialSettingsPage() {
  await requireAdmin();
  const config = await getSocialConfig();

  return (
    <div className="rise-in">
      <PageHeader
        title="Social settings"
        description="Choose the weekly publish slot, the review lead time and default hashtags — and arm or pause the auto-poster."
        actions={
          <Link
            href="/admin/social"
            className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Back to queue
          </Link>
        }
      />

      <SettingsForm config={config} metaConfigured={metaConfigured()} />
    </div>
  );
}
