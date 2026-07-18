"use client";

/**
 * Social auto-poster settings: schedule + defaults + arm switch, a read-only
 * connected-accounts panel, and a Test-connection button. Two independent
 * useActionState forms (save config / test connection).
 */

import { useActionState } from "react";
import { DAY_NAMES, type SocialConfig } from "@/lib/social/types";
import { saveSocialConfigAction, testConnectionAction } from "@/server/actions/admin/social";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const fieldClass =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-[15px] text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsForm({
  config,
  metaConfigured,
}: {
  config: SocialConfig;
  metaConfigured: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(saveSocialConfigAction, null);
  const [testState, testAction, testing] = useActionState(testConnectionAction, null);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Connected accounts (read-only) */}
      <Section
        title="Connected accounts"
        description="Set through the Meta connect step — see docs/SOCIAL-SETUP.md."
      >
        {!metaConfigured && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            META_ACCESS_TOKEN is not set — the poster can't publish yet. Follow{" "}
            <span className="font-mono">docs/SOCIAL-SETUP.md</span>.
          </div>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Facebook Page ID
            </dt>
            <dd className="mt-0.5 text-sm">
              {config.fbPageId ? (
                <span className="font-mono text-gray-800">{config.fbPageId}</span>
              ) : (
                <span className="text-gray-400">Not connected — see docs/SOCIAL-SETUP.md</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Instagram user ID
            </dt>
            <dd className="mt-0.5 text-sm">
              {config.igUserId ? (
                <span className="font-mono text-gray-800">{config.igUserId}</span>
              ) : (
                <span className="text-gray-400">Not connected — see docs/SOCIAL-SETUP.md</span>
              )}
            </dd>
          </div>
        </dl>

        <form action={testAction} className="mt-4">
          <Button type="submit" variant="outline" size="sm" disabled={testing}>
            {testing && <Spinner className="size-3.5" />}
            Test connection
          </Button>
        </form>
        {testState?.message && (
          <p
            role={testState.ok ? "status" : "alert"}
            className={`mt-2 text-xs ${testState.ok ? "text-emerald-700" : "text-red-600"}`}
          >
            {testState.message}
          </p>
        )}
      </Section>

      {/* Schedule & defaults */}
      <form action={saveAction}>
        <Section
          title="Schedule & defaults"
          description="One post publishes per week at this slot (Cairo time)."
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="dayOfWeek" className="block text-sm font-medium text-gray-700">
                  Day of week
                </label>
                <select
                  id="dayOfWeek"
                  name="dayOfWeek"
                  defaultValue={String(config.weeklySlot.dayOfWeek)}
                  className={fieldClass}
                >
                  {DAY_NAMES.map((day, i) => (
                    <option key={day} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="hour" className="block text-sm font-medium text-gray-700">
                  Hour (0–23)
                </label>
                <input
                  id="hour"
                  name="hour"
                  type="number"
                  min={0}
                  max={23}
                  required
                  defaultValue={config.weeklySlot.hour}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="minute" className="block text-sm font-medium text-gray-700">
                  Minute (0–59)
                </label>
                <input
                  id="minute"
                  name="minute"
                  type="number"
                  min={0}
                  max={59}
                  required
                  defaultValue={config.weeklySlot.minute}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                <input value="Africa/Cairo" readOnly className={`${fieldClass} bg-gray-50 text-gray-500`} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reviewLeadHours" className="block text-sm font-medium text-gray-700">
                  Review lead time (hours)
                </label>
                <input
                  id="reviewLeadHours"
                  name="reviewLeadHours"
                  type="number"
                  min={0}
                  max={168}
                  required
                  defaultValue={config.reviewLeadHours}
                  className={fieldClass}
                />
                <p className="text-xs text-gray-500">
                  How long before the slot you get the approval email.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="defaultHashtags" className="block text-sm font-medium text-gray-700">
                Default hashtags
              </label>
              <input
                id="defaultHashtags"
                name="defaultHashtags"
                maxLength={500}
                defaultValue={config.defaultHashtags}
                placeholder="#HDML #wholesale #electronics #Egypt"
                className={fieldClass}
              />
              <p className="text-xs text-gray-500">Prefilled into every new post (still editable).</p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-700">Default platforms</legend>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="facebook"
                  defaultChecked={config.platforms.facebook}
                  className="size-4 accent-brand-700"
                />
                Facebook
              </label>
              <label className="ml-6 inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="instagram"
                  defaultChecked={config.platforms.instagram}
                  className="size-4 accent-brand-700"
                />
                Instagram
              </label>
            </fieldset>

            <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={config.enabled}
                className="mt-0.5 size-4 accent-brand-700"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">Arm the auto-poster</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  When on (and Meta is connected), approved posts publish automatically at their
                  slot.
                </span>
              </span>
            </label>

            <div>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner className="size-4 border-white/40 border-t-white" />}
                Save settings
              </Button>
              {saveState?.message && (
                <p
                  role={saveState.ok ? "status" : "alert"}
                  className={`mt-2 text-xs ${saveState.ok ? "text-emerald-700" : "text-red-600"}`}
                >
                  {saveState.message}
                </p>
              )}
              {saveState?.errors && (
                <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                  {Object.entries(saveState.errors).map(([field, msg]) => (
                    <li key={field}>{field === "_form" ? msg : `${field}: ${msg}`}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>
      </form>
    </div>
  );
}
