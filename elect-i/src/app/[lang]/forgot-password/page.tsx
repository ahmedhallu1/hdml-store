import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({ params }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <AuthShell title={dict.auth.forgotTitle} lead={dict.auth.forgotLead}>
      <ForgotPasswordForm
        lang={lang}
        dict={{
          ...dict.auth,
          forgotPassword: dict.account.forgotPassword,
          optional: dict.common.optional,
        }}
      />
    </AuthShell>
  );
}
