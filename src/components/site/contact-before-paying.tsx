import { cn } from "@/lib/cn";

/**
 * Red pre-payment warning.
 *
 * Not every order can be fulfilled at the moment, so the customer must talk to
 * the owner BEFORE transferring any money — a transfer for an order we cannot
 * serve just means a refund for both sides. Shown wherever a payment method is
 * picked or shown.
 */
export function ContactBeforePaying({
  telegram,
  className,
}: {
  telegram: string | null;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-800",
        className,
      )}
    >
      <p className="flex items-start gap-2 font-semibold text-red-700">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 size-5 shrink-0"
          aria-hidden
        >
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <span>Do not transfer before contacting us.</span>
      </p>
      <p className="mt-2">
        We are temporarily <strong>not accepting every order</strong>. Message us first to confirm
        that your order can be fulfilled — if you pay for an order we cannot serve, you will have to
        wait for a refund.
      </p>
      {telegram ? (
        <a
          href={telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
            <path d="M21.9 4.3 18.6 20a1.2 1.2 0 0 1-1.9.7l-4.7-3.5-2.3 2.2a.8.8 0 0 1-1.3-.4l-.9-3.9 8.6-7.8c.3-.3-.1-.5-.5-.2L5.2 13.3l-3.7-1.2c-.8-.3-.8-1.4.1-1.7l19-7.3c.7-.3 1.4.2 1.3 1.2Z" />
          </svg>
          Contact us on Telegram before paying
        </a>
      ) : (
        <p className="mt-3 font-medium">
          Please reach out on our contact page before making any transfer.
        </p>
      )}
    </div>
  );
}
