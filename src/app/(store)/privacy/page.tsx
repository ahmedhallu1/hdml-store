import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How HDML collects, uses and protects your data when you shop with us.",
};

const h2 = "mt-8 text-xl font-semibold text-gray-900";
const p = "mt-2 leading-relaxed text-gray-700";

export default async function PrivacyPage() {
  const { contact, branding } = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Privacy policy</h1>
      <p className="mt-3 leading-relaxed text-gray-600">
        {branding.store_name} is a small wholesale business — we collect only what we need to
        process your orders, and we do not sell your data to anyone.
      </p>

      <h2 className={h2}>What we collect</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-6 text-gray-700">
        <li>
          <strong>Account details</strong>: your name, email and phone number, plus an optional
          company name and tax ID for invoices. We do <strong>not</strong> collect your delivery
          address — that is handled off-site (see “Shipping &amp; delivery” below).
        </li>
        <li>
          <strong>Order details</strong>: the items you order and any notes you add.
        </li>
        <li>
          <strong>Payment proof</strong>: the transfer screenshot you upload so we can verify your
          Instapay or wallet payment. We never see or store your banking credentials — the transfer
          happens entirely inside your own banking or wallet app.
        </li>
      </ul>

      <h2 className={h2}>How we use it</h2>
      <p className={p}>
        Your data is used to process your orders, verify payments, send order emails (confirmations
        and receipts), and contact you when something about your order needs attention. We do not
        send marketing emails you did not ask for, and we do not use third-party advertising
        trackers.
      </p>

      <h2 className={h2}>Where it is stored</h2>
      <p className={p}>
        Data is stored with Supabase (our database and file-storage provider) with access controls
        on every table. Payment proofs and receipts live in private storage buckets — they are
        never publicly accessible and are served only through short-lived signed links after an
        ownership check.
      </p>

      <h2 className={h2}>Shipping &amp; delivery</h2>
      <p className={p}>
        We do <strong>not</strong> collect or store your delivery address. After your payment is
        confirmed, we send you a link to complete your order and enter your shipping details on a
        separate platform, and a courier service handles delivery from there — you provide those
        details to them, not to us.
      </p>

      <h2 className={h2}>Who we share it with</h2>
      <p className={p}>
        We use a transactional email provider to send your order emails, and store your data with
        our database provider (above). We do not sell, rent or trade your personal data.
      </p>

      <h2 className={h2}>Cookies</h2>
      <p className={p}>
        We use only functional cookies: a session cookie that keeps you signed in. Your cart is
        stored locally in your own browser. There are no advertising or cross-site tracking
        cookies.
      </p>

      <h2 className={h2}>Your rights</h2>
      <p className={p}>
        You can update your profile from your account page at any time. To request a copy of your
        data or to have your account and history deleted, email us at{" "}
        <a href={`mailto:${contact.email}`} className="font-medium text-brand-700 hover:text-brand-600">
          {contact.email}
        </a>
        . We keep order records only as long as needed for accounting and warranty purposes.
      </p>

      <p className="mt-8 text-sm text-gray-500">
        If we change this policy we will update this page. Last updated: July 2026.
      </p>
    </div>
  );
}
