import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-xl border border-white/12 bg-obsidian-800/70 px-4 py-3 text-[15px] text-ink-100 placeholder:text-ink-600 transition-colors duration-200 hover:border-white/20 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/30 disabled:opacity-50";

function Shell({
  id,
  label,
  hint,
  error,
  required,
  optionalLabel,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Labels are always visible — placeholders alone fail once a field is filled. */}
      <label htmlFor={id} className="text-sm font-semibold text-ink-300">
        {label}
        {!required && optionalLabel ? (
          <span className="ml-1.5 font-normal text-ink-600">({optionalLabel})</span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-ink-500">
          {hint}
        </p>
      ) : null}
      {/* Errors sit next to the field they belong to, not in a summary at the top. */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-danger-400">
          <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5.75" stroke="currentColor" strokeWidth="1.3" />
            <path d="M7 4.2v3.4M7 9.6v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  ...props
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
}) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={props.required} optionalLabel={optionalLabel}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, error && "border-danger-500/60", className)}
        {...props}
      />
    </Shell>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  ...props
}: ComponentProps<"textarea"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
}) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={props.required} optionalLabel={optionalLabel}>
      <textarea
        id={id}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, "resize-y", error && "border-danger-500/60", className)}
        {...props}
      />
    </Shell>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  children,
  ...props
}: ComponentProps<"select"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
}) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={props.required} optionalLabel={optionalLabel}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, "cursor-pointer appearance-none bg-no-repeat pr-10", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='m4 6 4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 0.9rem center",
          backgroundSize: "1rem",
        }}
        {...props}
      >
        {children}
      </select>
    </Shell>
  );
}
