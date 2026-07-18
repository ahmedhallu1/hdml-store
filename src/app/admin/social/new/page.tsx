import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSocialConfig } from "@/lib/social/store";
import { PageHeader } from "@/components/admin/ui";
import { PostForm } from "@/components/admin/social/post-form";

export const metadata = { title: "New social post" };

export default async function NewSocialPostPage() {
  await requireAdmin();
  const config = await getSocialConfig();

  return (
    <div className="rise-in">
      <PageHeader
        title="New social post"
        description="Write it once — we tailor the caption for each platform. It's queued for the next weekly slot and emailed to you to approve before it goes live."
        actions={
          <Link
            href="/admin/social"
            className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Back to queue
          </Link>
        }
      />

      <PostForm defaultHashtags={config.defaultHashtags} platforms={config.platforms} />
    </div>
  );
}
