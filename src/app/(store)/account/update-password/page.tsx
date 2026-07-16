import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false },
};

/**
 * Destination of the password-recovery email link: /auth/confirm exchanges
 * the emailed code for a session and forwards here, so requireUser passes
 * with the recovery session. Updating the password uses that session.
 */
export default async function UpdatePasswordPage() {
  await requireUser("/account/update-password");

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rise-in rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900">Set a new password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose a new password for your account. You&rsquo;ll stay signed in afterwards.
        </p>
        <div className="mt-6">
          <ChangePasswordForm submitLabel="Save new password" />
        </div>
        <p className="mt-6 text-sm text-gray-500">
          All set?{" "}
          <Link href="/account" className="font-medium text-brand-700 hover:text-brand-600">
            Go to my account
          </Link>
        </p>
      </div>
    </div>
  );
}
