import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Set a new password" };

export default async function UpdatePasswordPage({
  params,
}: PageProps<"/[lang]/account/update-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  await requireUser(lang, `/${lang}/account/update-password`);

  return (
    <AuthShell title={dict.auth.updatePasswordTitle} lead={dict.auth.updatePasswordLead}>
      <UpdatePasswordForm
        lang={lang}
        dict={{
          ...dict.auth,
          forgotPassword: dict.account.forgotPassword,
          optional: dict.common.optional,
        }}
        accountHref={`/${lang}/account`}
        accountLabel={dict.account.title}
      />
    </AuthShell>
  );
}
