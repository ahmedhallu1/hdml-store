import type { Metadata } from "next";
import { RecoveryForm } from "@/components/auth/recovery-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false },
};

/**
 * Public landing page for password-recovery email links. The recovery session
 * arrives in the URL fragment, so all handling is client-side (RecoveryForm).
 * This route is intentionally NOT under /account, so the middleware auth gate
 * does not bounce the hash-bearing URL to /login before the client can read it.
 */
export default function RecoveryPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rise-in rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900">Set a new password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose a new password for your account.
        </p>
        <div className="mt-6">
          <RecoveryForm />
        </div>
      </div>
    </div>
  );
}
