"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Glyph } from "./glyph";

/** Shape every marketing server action returns. */
export interface FormState {
  ok: boolean;
  /** Reference/receipt returned on success, if the action produces one. */
  reference?: string;
  /** Top-level message: an error explanation, or a success confirmation. */
  message?: string;
  /** Per-field messages keyed by input name. */
  fieldErrors?: Record<string, string>;
}

export const EMPTY_FORM_STATE: FormState = { ok: false };

export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Disables a fieldset while its parent form is submitting. */
export function PendingFieldset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className={cn("contents", className)}>
      {children}
    </fieldset>
  );
}

export function FormAlert({
  tone,
  title,
  children,
}: {
  tone: "success" | "error";
  title: string;
  children?: ReactNode;
}) {
  const success = tone === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        success
          ? "border-settled-500/30 bg-settled-500/10"
          : "border-danger-500/40 bg-danger-500/10",
      )}
    >
      <span className={success ? "text-settled-400" : "text-danger-400"}>
        <Glyph name={success ? "check" : "alert"} className="size-5" />
      </span>
      <div>
        <p className={cn("font-semibold", success ? "text-settled-400" : "text-danger-400")}>
          {title}
        </p>
        {children ? (
          <div className="mt-1 text-sm leading-relaxed text-ink-300">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
