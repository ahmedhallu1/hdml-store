"use client";

/**
 * Cloudflare Turnstile (explicit render). Drop inside any <form>: the current
 * token is exposed as a hidden input named "turnstileToken" and, optionally,
 * through the `onToken` callback (null on expiry/error). Pass a ref to get a
 * `reset()` handle for after failed submissions.
 *
 * Uses the official always-pass TEST site key until a real key is configured.
 */

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Load the Turnstile script exactly once (async), shared across widgets. */
function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      const script = existing ?? document.createElement("script");
      const fail = () => {
        scriptPromise = null; // allow a later retry
        reject(new Error("Turnstile script failed to load"));
      };
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", fail, { once: true });
      if (!existing) {
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      } else if (window.turnstile) {
        resolve();
      }
    });
  }
  return scriptPromise;
}

export interface TurnstileHandle {
  /** Reset the widget (new challenge, clears the current token). */
  reset: () => void;
}

export function TurnstileWidget({
  onToken,
  ref,
  className,
}: {
  /** Called with the fresh token, or null when it expires / errors. */
  onToken?: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setToken("");
      onTokenRef.current?.(null);
      if (widgetIdRef.current !== null) {
        try {
          window.turnstile?.reset(widgetIdRef.current);
        } catch {
          // widget already gone — ignore
        }
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current !== null) return; // already rendered (strict mode)
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (t: string) => {
            setToken(t);
            setFailed(false);
            onTokenRef.current?.(t);
          },
          "expired-callback": () => {
            setToken("");
            onTokenRef.current?.(null);
            // Ask for a fresh challenge so the form can still be submitted.
            if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current);
          },
          "error-callback": () => {
            setToken("");
            onTokenRef.current?.(null);
            if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null) {
        try {
          window.turnstile?.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  return (
    <div className={className}>
      <div ref={containerRef} aria-label="Human verification" />
      <input type="hidden" name="turnstileToken" value={token} />
      {failed && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          Verification could not load. Check your connection and refresh the page.
        </p>
      )}
    </div>
  );
}
