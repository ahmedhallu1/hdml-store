"use client";

/**
 * Generic client wrapper for FormData-style admin server actions
 * ((prev, formData) => ActionResult). Renders children (fields — may be
 * server-rendered), a submit button, optional confirm prompt, and inline
 * success/error feedback from the action result.
 */

import { useActionState, useEffect, useRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/server/actions/admin/action-result";

export function ActionForm({
  action,
  children,
  className,
  submitLabel,
  submitVariant = "primary",
  submitSize = "sm",
  submitClassName,
  confirmMessage,
  resetOnSuccess = false,
  hideMessage = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  className?: string;
  submitLabel: string;
  submitVariant?: ButtonProps["variant"];
  submitSize?: ButtonProps["size"];
  submitClassName?: string;
  /** window.confirm text shown before submitting (irreversible actions). */
  confirmMessage?: string;
  /** Clear the form fields after a successful run (add-forms). */
  resetOnSuccess?: boolean;
  /** Suppress the inline message (parent renders its own feedback). */
  hideMessage?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastState = useRef<ActionState>(null);

  useEffect(() => {
    if (resetOnSuccess && state && state !== lastState.current && state.ok) {
      formRef.current?.reset();
    }
    lastState.current = state;
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={
        confirmMessage
          ? (e) => {
              if (!window.confirm(confirmMessage)) e.preventDefault();
            }
          : undefined
      }
    >
      {children}
      <Button
        type="submit"
        variant={submitVariant}
        size={submitSize}
        disabled={pending}
        className={submitClassName}
      >
        {pending && <Spinner className="size-3.5 border-white/40 border-t-white" />}
        {submitLabel}
      </Button>
      {!hideMessage && state?.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "mt-2 w-full text-xs",
            state.ok ? "text-emerald-700" : "text-red-600",
          )}
        >
          {state.message}
        </p>
      )}
      {!hideMessage && state?.errors && (
        <ul className="mt-1 w-full space-y-0.5 text-xs text-red-600">
          {Object.entries(state.errors).map(([field, msg]) => (
            <li key={field}>
              {field === "_form" ? "" : `${field}: `}
              {msg}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
