"use client";

import { useTransition } from "react";
import { logout } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => logout())}
    >
      {pending && <Spinner className="size-3.5" />}
      Sign out
    </Button>
  );
}
