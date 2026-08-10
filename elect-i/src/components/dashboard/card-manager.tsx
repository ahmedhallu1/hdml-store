"use client";

import { useActionState, useEffect, useState } from "react";
import {
  addCardAction,
  removeCardAction,
  setDefaultCardAction,
  updateCardAction,
  type DashboardState,
} from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/config";
import type { SavedCard } from "@/lib/billing";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

/** VISA-style mark drawn inline (no emoji, no external asset). */
function CardMark({ brand }: { brand: SavedCard["brand"] }) {
  const label = brand === "visa" ? "VISA" : brand === "amex" ? "AMEX" : "MC";
  return (
    <span className="inline-flex h-7 w-11 items-center justify-center rounded-md bg-gradient-to-br from-[#1a1f71] to-[#2b3fa0] text-[11px] font-black italic tracking-tight text-white">
      {label}
    </span>
  );
}

export interface CardManagerDict {
  cardsTitle: string;
  addCard: string;
  cardHolder: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  saveCard: string;
  saving: string;
  cardAdded: string;
  default: string;
  makeDefault: string;
  remove: string;
  edit: string;
  cancel: string;
  saveChanges: string;
  cardUpdated: string;
  noCards: string;
  expires: string;
  addedOn: string;
}

/**
 * One saved card, which flips in place into an edit form.
 *
 * Only the holder and expiry are editable — the stored record holds nothing
 * else that could change without the card itself changing.
 */
function CardRow({ lang, card, dict }: { lang: Locale; card: SavedCard; dict: CardManagerDict }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<DashboardState, FormData>(
    updateCardAction.bind(null, lang),
    {},
  );
  const errors = state.errors ?? {};

  // Close the editor once the save has gone through.
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  const expiry = `${String(card.exp_month).padStart(2, "0")} / ${String(card.exp_year).slice(-2)}`;

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CardMark brand={card.brand} />
          <div>
            <p className="font-mono text-sm text-ink-100">•••• •••• •••• {card.last4}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {card.holder} ·{" "}
              {dict.expires
                .replace("{mm}", String(card.exp_month).padStart(2, "0"))
                .replace("{yy}", String(card.exp_year).slice(-2))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {card.is_default ? (
            <Badge tone="accent">{dict.default}</Badge>
          ) : (
            <form action={setDefaultCardAction.bind(null, lang)}>
              <input type="hidden" name="id" value={card.id} />
              <button
                type="submit"
                className="cursor-pointer rounded-lg border border-white/12 px-3 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:border-accent-400/40 hover:text-accent-200"
              >
                {dict.makeDefault}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            className="cursor-pointer rounded-lg border border-white/12 px-3 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:border-accent-400/40 hover:text-accent-200"
          >
            {editing ? dict.cancel : dict.edit}
          </button>
          <form action={removeCardAction.bind(null, lang)}>
            <input type="hidden" name="id" value={card.id} />
            <button
              type="submit"
              aria-label={dict.remove}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/12 text-ink-500 transition-colors hover:border-danger-500/40 hover:text-danger-400"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
                <path d="M5 10h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {editing ? (
        <form action={action} className="mt-4 grid gap-4 border-t border-white/8 pt-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={card.id} />
          <TextField
            id={`holder-${card.id}`}
            name="holder"
            label={dict.cardHolder}
            autoComplete="cc-name"
            defaultValue={card.holder}
            error={errors.holder}
            required
          />
          <TextField
            id={`exp-${card.id}`}
            name="exp"
            label={dict.cardExpiry}
            inputMode="numeric"
            autoComplete="cc-exp"
            defaultValue={expiry}
            error={errors.exp}
            required
          />
          <Button type="submit" disabled={pending} className="self-start sm:col-span-2">
            {pending ? dict.saving : dict.saveChanges}
          </Button>
        </form>
      ) : null}
    </li>
  );
}

export function CardManager({
  lang,
  cards,
  dict,
}: {
  lang: Locale;
  cards: SavedCard[];
  dict: CardManagerDict;
}) {
  const [state, action, pending] = useActionState<DashboardState, FormData>(
    addCardAction.bind(null, lang),
    {},
  );
  const errors = state.errors ?? {};

  return (
    <section className="panel p-6" aria-labelledby="cards-heading">
      <h2 id="cards-heading" className="font-bold text-ink-50">
        {dict.cardsTitle}
      </h2>

      <ul className="mt-4 flex flex-col gap-3">
        {cards.length === 0 ? (
          <li className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center text-sm text-ink-500">
            {dict.noCards}
          </li>
        ) : (
          cards.map((card) => <CardRow key={card.id} lang={lang} card={card} dict={dict} />)
        )}
      </ul>

      <form action={action} className="mt-5 flex flex-col gap-4 border-t border-white/8 pt-5">
        <p className="text-sm font-semibold text-ink-300">{dict.addCard}</p>
        {state.ok ? (
          <p className="flex items-center gap-2 rounded-lg border border-settled-500/30 bg-settled-500/10 px-3 py-2 text-sm text-settled-400">
            <Icon name="check" className="size-4" />
            {dict.cardAdded}
          </p>
        ) : null}
        <TextField
          id="holder"
          name="holder"
          label={dict.cardHolder}
          autoComplete="cc-name"
          placeholder="AHMED T HALLUL"
          error={errors.holder}
          required
        />
        <TextField
          id="number"
          name="number"
          label={dict.cardNumber}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4111 1111 1111 4261"
          error={errors.number}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            id="exp"
            name="exp"
            label={dict.cardExpiry}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="08 / 28"
            error={errors.exp}
            required
          />
          <TextField
            id="cvc"
            name="cvc"
            label={dict.cardCvc}
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="•••"
          />
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? dict.saving : dict.saveCard}
        </Button>
      </form>
    </section>
  );
}
