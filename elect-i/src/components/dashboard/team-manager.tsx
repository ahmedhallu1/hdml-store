"use client";

import { useActionState } from "react";
import { addSeatAction, removeSeatAction, type TeamState } from "@/server/actions/team";
import type { Locale } from "@/i18n/config";
import { TextField, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export interface Seat {
  id: string;
  email: string;
  role: string;
}

export function TeamManager({
  lang,
  seats,
  dict,
}: {
  lang: Locale;
  seats: Seat[];
  dict: {
    seatEmail: string;
    seatEmailHint: string;
    seatRole: string;
    roleMember: string;
    roleManager: string;
    addSeat: string;
    addingSeat: string;
    noSeats: string;
    removeSeat: string;
    seatAdded: string;
  };
}) {
  const [state, action, pending] = useActionState<TeamState, FormData>(
    addSeatAction.bind(null, lang),
    {},
  );
  const errors = state.errors ?? {};

  return (
    <section className="panel p-6" aria-labelledby="team-heading">
      <form action={action} className="flex flex-col gap-4">
        {errors._form ? (
          <p role="alert" className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
            {errors._form}
          </p>
        ) : null}
        {state.ok ? (
          <p className="flex items-center gap-2 rounded-lg border border-settled-500/30 bg-settled-500/10 px-3 py-2 text-sm text-settled-400">
            <Icon name="check" className="size-4" />
            {dict.seatAdded}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <TextField
            id="seatEmail"
            name="email"
            type="email"
            label={dict.seatEmail}
            hint={dict.seatEmailHint}
            error={errors.email}
            required
          />
          <SelectField id="seatRole" name="role" label={dict.seatRole} defaultValue="member">
            <option value="member">{dict.roleMember}</option>
            <option value="manager">{dict.roleManager}</option>
          </SelectField>
          <Button type="submit" disabled={pending}>
            {pending ? dict.addingSeat : dict.addSeat}
          </Button>
        </div>
      </form>

      <ul className="mt-6 divide-y divide-white/5">
        {seats.length === 0 ? (
          <li className="py-6 text-center text-sm text-ink-500">{dict.noSeats}</li>
        ) : (
          seats.map((seat) => (
            <li key={seat.id} className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <p className="text-sm text-ink-100">{seat.email}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {seat.role === "manager" ? dict.roleManager : dict.roleMember}
                </p>
              </div>
              <form action={removeSeatAction.bind(null, lang)}>
                <input type="hidden" name="id" value={seat.id} />
                <button
                  type="submit"
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-white/12 px-3 text-xs font-semibold text-ink-400 transition-colors hover:border-danger-500/40 hover:text-danger-400"
                >
                  {dict.removeSeat}
                </button>
              </form>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
