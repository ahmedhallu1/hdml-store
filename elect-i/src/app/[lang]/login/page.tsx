import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";
import { AuthShell, AuthSwitch } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);

  const nextPath = safeNextPath(Array.isArray(sp.next) ? sp.next[0] : sp.next);

  // Already signed in — bounce rather than showing a form that cannot help.
  if (await getUser()) redirect(nextPath ?? `/${lang}/account`);

  return (
    <AuthShell
      title={dict.account.signInTitle}
      lead={dict.account.signInLead}
      aside={{
        title: dict.auth.benefitsTitle,
        items: [dict.auth.benefit1, dict.auth.benefit2, dict.auth.benefit3],
        note: dict.auth.merchantNote,
      }}
      footer={
        <AuthSwitch
          prompt={dict.account.noAccount}
          href={`/${lang}/register${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          label={dict.nav.register}
        />
      }
    >
      <SignInForm
        lang={lang}
        nextPath={nextPath}
        dict={{
          ...dict.auth,
          forgotPassword: dict.account.forgotPassword,
          optional: dict.common.optional,
        }}
      />
    </AuthShell>
  );
}
