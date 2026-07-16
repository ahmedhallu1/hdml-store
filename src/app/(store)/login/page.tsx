import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your HDML wholesale account.",
};

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage(props: Props) {
  const { next, error } = await props.searchParams;
  const safeNext = typeof next === "string" && /^\/(?!\/)/.test(next) ? next : "/";

  const user = await getUser();
  if (user) redirect(safeNext);

  const notice =
    error === "recovery"
      ? "That password reset link is invalid or has expired. Please request a new one below."
      : undefined;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rise-in rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back — sign in to order and track your shipments.
        </p>
        <div className="mt-6">
          <LoginForm next={safeNext} notice={notice} />
        </div>
      </div>
    </div>
  );
}
