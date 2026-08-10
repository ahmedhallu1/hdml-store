"use client";

import { useTransition } from "react";
import { signOutAction } from "@/server/actions/auth";
import type { Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";

export function SignOutButton({ lang, label }: { lang: Locale; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction(lang))}
    >
      {label}
    </Button>
  );
}
