import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your HDML wholesale account to order in bulk across Egypt.",
};

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function RegisterPage(props: Props) {
  const { next } = await props.searchParams;
  const safeNext = typeof next === "string" && /^\/(?!\/)/.test(next) ? next : "/";

  const user = await getUser();
  if (user) redirect(safeNext);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rise-in rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">
          One quick step — then you can place wholesale orders and track them online.
        </p>
        <div className="mt-6">
          <RegisterForm next={safeNext} />
        </div>
      </div>
    </div>
  );
}
