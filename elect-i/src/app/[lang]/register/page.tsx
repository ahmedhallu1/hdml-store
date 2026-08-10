import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";
import { AuthShell, AuthSwitch } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ params, searchParams }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);

  const nextPath = safeNextPath(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  if (await getUser()) redirect(nextPath ?? `/${lang}/account`);

  // The terms sentence carries two inline links, so it is assembled here
  // rather than shipped as raw HTML from the dictionary.
  const [before, rest] = dict.auth.termsNote.split("{terms}");
  const [middle, after] = (rest ?? "").split("{privacy}");
  const linkClass = "text-accent-300 transition-colors hover:text-accent-200";

  return (
    <AuthShell
      title={dict.account.registerTitle}
      lead={dict.account.registerLead}
      aside={{
        title: dict.auth.benefitsTitle,
        items: [dict.auth.benefit1, dict.auth.benefit2, dict.auth.benefit3],
        note: dict.auth.merchantNote,
      }}
      footer={
        <AuthSwitch
          prompt={dict.account.hasAccount}
          href={`/${lang}/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          label={dict.nav.signIn}
        />
      }
    >
      <RegisterForm
        lang={lang}
        nextPath={nextPath}
        dict={{
          ...dict.auth,
          forgotPassword: dict.account.forgotPassword,
          optional: dict.common.optional,
        }}
        terms={
          <>
            {before}
            <Link href={`/${lang}/terms`} className={linkClass}>
              {dict.footer.terms}
            </Link>
            {middle}
            <Link href={`/${lang}/privacy`} className={linkClass}>
              {dict.footer.privacy}
            </Link>
            {after}
          </>
        }
      />
    </AuthShell>
  );
}
