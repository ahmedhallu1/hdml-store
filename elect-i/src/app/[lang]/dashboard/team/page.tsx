import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { TeamManager, type Seat } from "@/components/dashboard/team-manager";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: PageProps<"/[lang]/dashboard/team">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { account, privileges } = await requireTier(lang, "merchant");

  const service = supabaseService();
  const { data: rows } = await service
    .from("account_seats")
    .select("id, role, user_id")
    .eq("account_id", account.user_id)
    .order("created_at", { ascending: true });

  // Resolve seat emails from the account rows (account_seats stores only ids).
  const userIds = (rows ?? []).map((r) => r.user_id as string);
  const emailById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: accounts } = await service
      .from("accounts")
      .select("user_id, email")
      .in("user_id", userIds);
    for (const a of accounts ?? []) emailById.set(a.user_id as string, a.email as string);
  }

  const seats: Seat[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    email: emailById.get(r.user_id as string) ?? "—",
    role: r.role as string,
  }));

  const capLabel =
    privileges.seats === null
      ? dict.dashboard.seatsUnlimited
      : dict.dashboard.seatsUsed
          .replace("{used}", String(seats.length + 1))
          .replace("{limit}", String(privileges.seats));

  return (
    <div className="flex flex-col gap-6">
      <Reveal className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-400">{dict.dashboard.teamLead}</p>
        <span className="text-xs font-semibold text-ink-500">{capLabel}</span>
      </Reveal>
      <Reveal delay={60}>
        <TeamManager
          lang={lang}
          seats={seats}
          dict={{
            seatEmail: dict.dashboard.seatEmail,
            seatEmailHint: dict.dashboard.seatEmailHint,
            seatRole: dict.dashboard.seatRole,
            roleMember: dict.dashboard.roleMember,
            roleManager: dict.dashboard.roleManager,
            addSeat: dict.dashboard.addSeat,
            addingSeat: dict.dashboard.addingSeat,
            noSeats: dict.dashboard.noSeats,
            removeSeat: dict.dashboard.removeSeat,
            seatAdded: dict.dashboard.seatAdded,
          }}
        />
      </Reveal>
    </div>
  );
}
