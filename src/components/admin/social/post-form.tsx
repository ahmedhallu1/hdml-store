"use client";

/**
 * New-post composer. Uploads the image to /api/admin/social/upload (public
 * social-media bucket), stores the returned path in a hidden field, and shows a
 * live per-platform caption preview (facebookCaption/instagramCaption are pure,
 * so they're safe to run in the browser). Submits via createSocialPostAction.
 */

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createSocialPostAction } from "@/server/actions/admin/social";
import { facebookCaption, instagramCaption } from "@/lib/social/tailor";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const MAX_CAPTION = 2000;

interface UploadResponse {
  path?: string;
  error?: string;
}

function PreviewCard({
  title,
  caption,
  imageUrl,
}: {
  title: string;
  caption: string;
  imageUrl: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="max-h-72 w-full bg-gray-50 object-contain" />
      ) : (
        <div className="flex h-40 items-center justify-center bg-gray-50 text-xs text-gray-400">
          Upload an image to preview
        </div>
      )}
      <p className="whitespace-pre-wrap px-3 py-3 text-sm text-gray-800">
        {caption || <span className="text-gray-400">Your caption will appear here…</span>}
      </p>
    </div>
  );
}

export function PostForm({
  defaultHashtags,
  platforms,
}: {
  defaultHashtags: string;
  platforms: { facebook: boolean; instagram: boolean };
}) {
  const [state, formAction, pending] = useActionState(createSocialPostAction, null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [coreCaption, setCoreCaption] = useState("");
  const [hashtags, setHashtags] = useState(defaultHashtags);
  const [link, setLink] = useState("");
  const [fb, setFb] = useState(platforms.facebook);
  const [ig, setIg] = useState(platforms.instagram);

  const [imagePath, setImagePath] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);
    setImagePath("");
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/social/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as UploadResponse;
      if (!res.ok || !json.path) throw new Error(json.error ?? `Upload failed (${res.status})`);
      setImagePath(json.path);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const tailorInput = { coreCaption, hashtags, link };
  const succeeded = state?.ok === true;
  const canSubmit =
    Boolean(imagePath) && !uploading && coreCaption.trim().length > 0 && (fb || ig) && !pending;

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-2">
      {/* Left: composer */}
      <div className="space-y-5">
        {/* Image */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-gray-700">
            Image <span className="text-red-500">*</span>
          </span>
          <div className="flex items-center gap-3">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-[10px] text-gray-400">no image</span>
              )}
            </div>
            <div className="space-y-1">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-brand-200 px-3 text-sm font-medium text-brand-800 hover:bg-brand-50">
                {uploading ? <Spinner className="mr-1.5 size-3.5" /> : null}
                {imagePath ? "Replace image" : "Upload image"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="text-xs text-gray-500">
                {imagePath ? (
                  <span className="text-emerald-700">Uploaded ✓</span>
                ) : (
                  "JPEG, PNG or WebP, up to 4 MB."
                )}
              </p>
            </div>
          </div>
          {uploadError && (
            <p role="alert" className="text-xs text-red-600">
              {uploadError}
            </p>
          )}
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <label htmlFor="coreCaption" className="block text-sm font-medium text-gray-700">
            Caption <span className="text-red-500">*</span>
          </label>
          <textarea
            id="coreCaption"
            name="coreCaption"
            required
            maxLength={MAX_CAPTION}
            value={coreCaption}
            onChange={(e) => setCoreCaption(e.target.value)}
            placeholder="What do you want to say?"
            className="min-h-32 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <p className="text-right text-xs text-gray-400">
            {coreCaption.length}/{MAX_CAPTION}
          </p>
        </div>

        {/* Hashtags */}
        <div className="space-y-1.5">
          <label htmlFor="hashtags" className="block text-sm font-medium text-gray-700">
            Hashtags
          </label>
          <input
            id="hashtags"
            name="hashtags"
            maxLength={500}
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#HDML #wholesale"
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {/* Link */}
        <div className="space-y-1.5">
          <label htmlFor="link" className="block text-sm font-medium text-gray-700">
            Link (optional)
          </label>
          <input
            id="link"
            name="link"
            type="url"
            maxLength={500}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://hdml.example/product"
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <p className="text-xs text-gray-500">
            Shown as a link on Facebook; Instagram captions get a “Link in bio” note instead.
          </p>
        </div>

        {/* Platforms */}
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-gray-700">Publish to</legend>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="platforms"
                value="facebook"
                checked={fb}
                onChange={(e) => setFb(e.target.checked)}
                className="size-4 accent-brand-700"
              />
              Facebook
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="platforms"
                value="instagram"
                checked={ig}
                onChange={(e) => setIg(e.target.checked)}
                className="size-4 accent-brand-700"
              />
              Instagram
            </label>
          </div>
          {!fb && !ig && (
            <p className="text-xs text-red-600">Pick at least one platform.</p>
          )}
        </fieldset>

        <input type="hidden" name="imagePath" value={imagePath} />

        <div>
          <Button type="submit" disabled={!canSubmit}>
            {pending && <Spinner className="size-4 border-white/40 border-t-white" />}
            Queue post
          </Button>
          <p className="mt-2 text-xs text-gray-500">
            Goes into the queue for the next weekly slot; you get an email to approve it before it
            publishes.
          </p>
        </div>

        {succeeded ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p>{state?.message}</p>
            <Link href="/admin/social" className="mt-1 inline-block font-medium underline">
              View the queue
            </Link>
          </div>
        ) : (
          state?.message && (
            <p role="alert" className="text-sm text-red-600">
              {state.message}
            </p>
          )
        )}
        {state?.errors && !succeeded && (
          <ul className="space-y-0.5 text-xs text-red-600">
            {Object.entries(state.errors).map(([field, msg]) => (
              <li key={field}>{field === "_form" ? msg : `${field}: ${msg}`}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Right: live preview */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-700">Live preview</p>
        {fb && <PreviewCard title="Facebook" caption={facebookCaption(tailorInput)} imageUrl={previewUrl} />}
        {ig && (
          <PreviewCard title="Instagram" caption={instagramCaption(tailorInput)} imageUrl={previewUrl} />
        )}
        {!fb && !ig && (
          <p className="text-xs text-gray-400">Select a platform to preview its caption.</p>
        )}
      </div>
    </form>
  );
}
