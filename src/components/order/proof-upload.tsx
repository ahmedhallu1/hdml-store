"use client";

/**
 * Payment-proof (transfer screenshot) uploader. The image is downscaled in
 * the browser (canvas, max 1600px, JPEG q0.85) so the upload stays under the
 * server's 4 MB cap even for full-resolution screenshots.
 *
 * Uploading a proof does NOT confirm payment — copy everywhere reflects that
 * verification is manual.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TurnstileWidget, type TurnstileHandle } from "@/components/turnstile-widget";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.85;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

type Phase = "idle" | "processing" | "uploading" | "done";

/** Downscale to MAX_DIM on the longest side and re-encode as JPEG. */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    // White backdrop: transparent PNG areas turn white instead of black in JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("canvas encode failed");
    return blob;
  } finally {
    bitmap.close();
  }
}

export function ProofUpload({
  orderId,
  token,
  receiptUrl,
}: {
  orderId: string;
  token: string;
  /** Preliminary receipt download link shown after a successful upload. */
  receiptUrl: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  const busy = phase === "processing" || phase === "uploading";

  function fail(message: string) {
    setError(message);
    setPhase("idle");
    setTurnstileToken("");
    turnstileRef.current?.reset();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || phase === "done") return;
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a screenshot of your transfer first.");
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setError("Please upload a JPG, PNG or WebP image.");
      return;
    }

    setPhase("processing");
    let upload: Blob = file;
    let uploadName = file.name;
    try {
      upload = await downscale(file);
      uploadName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    } catch {
      // Downscale failed (odd format/huge image) — try the original as-is.
      upload = file;
    }
    if (upload.size > MAX_UPLOAD_BYTES) {
      fail("The image is too large even after compression. Please crop it and try again.");
      return;
    }

    setPhase("uploading");
    try {
      const body = new FormData();
      body.append("file", upload, uploadName);
      body.append("token", token);
      body.append("turnstileToken", turnstileToken);

      const res = await fetch(`/api/orders/${orderId}/proof`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        emailSent?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        fail(json.error ?? "Upload failed. Please try again.");
        return;
      }
      setEmailSent(json.emailSent ?? null);
      setPhase("done");
      // Refresh the server-rendered page so status + proof state update.
      router.refresh();
    } catch {
      fail("Upload failed — check your connection and try again.");
    }
  }

  if (phase === "done") {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        <p className="font-medium">Screenshot uploaded — pending manual verification.</p>
        <p className="mt-1">
          We&rsquo;ll review your transfer and confirm the payment. Uploading a proof does not
          confirm payment by itself.
          {emailSent === true && " A preliminary receipt was emailed to you."}
        </p>
        <a
          href={receiptUrl}
          className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-900 underline underline-offset-2 hover:text-emerald-700"
        >
          Download preliminary receipt (PDF)
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor={`proof-file-${orderId}`} className="block text-sm font-medium text-gray-700">
          Transfer screenshot <span className="text-red-500">*</span>
        </label>
        <input
          ref={fileInputRef}
          id={`proof-file-${orderId}`}
          type="file"
          accept={ACCEPTED.join(",")}
          required
          disabled={busy}
          onChange={(e) => {
            setError(null);
            setFileName(e.target.files?.[0]?.name ?? null);
          }}
          className="mt-1.5 block w-full cursor-pointer rounded-lg border border-gray-300 bg-white text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-100"
        />
        <p className="mt-1 text-xs text-gray-500">
          JPG, PNG or WebP. Large images are compressed in your browser before upload.
        </p>
      </div>

      <TurnstileWidget ref={turnstileRef} onToken={(t) => setTurnstileToken(t ?? "")} />

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
        >
          {error}
        </p>
      )}

      {busy && (
        <div className="space-y-1.5" role="status" aria-live="polite">
          <p className="text-xs font-medium text-gray-600">
            {phase === "processing" ? "Compressing image…" : "Uploading…"}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full bg-brand-600 transition-all duration-700 ${
                phase === "processing" ? "w-1/3" : "w-4/5"
              }`}
            />
          </div>
        </div>
      )}

      <Button type="submit" disabled={busy || !fileName || !turnstileToken}>
        {busy && <Spinner className="size-4 border-white/40 border-t-white" />}
        Upload payment proof
      </Button>
      <p className="text-xs text-gray-500">
        Uploading a screenshot does <strong>not</strong> confirm your payment — our team verifies
        every transfer manually.
      </p>
    </form>
  );
}
