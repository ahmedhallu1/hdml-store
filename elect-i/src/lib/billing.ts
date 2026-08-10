import "server-only";
import { supabaseService } from "@/lib/supabase/server";

/**
 * Saved payment cards for an account.
 *
 * Stored in eig.settings under a per-account key so no schema migration is
 * required. Only non-sensitive card metadata is ever kept (brand, last four,
 * expiry, holder) — never a full PAN or CVV, which a real processor tokenises
 * and we would never hold.
 */
export interface SavedCard {
  id: string;
  brand: "visa" | "mastercard" | "amex";
  last4: string;
  exp_month: number;
  exp_year: number;
  holder: string;
  is_default: boolean;
  added_at: string;
}

function key(accountId: string): string {
  return `billing_cards_${accountId}`;
}

export async function getCards(accountId: string): Promise<SavedCard[]> {
  const service = supabaseService();
  const { data } = await service
    .from("settings")
    .select("value")
    .eq("key", key(accountId))
    .maybeSingle();
  const cards = (data?.value as { cards?: SavedCard[] } | null)?.cards;
  return Array.isArray(cards) ? cards : [];
}

export async function getDefaultCard(accountId: string): Promise<SavedCard | null> {
  const cards = await getCards(accountId);
  return cards.find((c) => c.is_default) ?? cards[0] ?? null;
}

async function saveCards(accountId: string, cards: SavedCard[]): Promise<void> {
  const service = supabaseService();
  await service
    .from("settings")
    .upsert({ key: key(accountId), value: { cards } }, { onConflict: "key" });
}

/** Brand inferred from the leading digit, the way a real gateway would. */
function brandFromNumber(digits: string): SavedCard["brand"] {
  if (digits.startsWith("4")) return "visa";
  if (digits.startsWith("3")) return "amex";
  return "mastercard";
}

export async function addCard(
  accountId: string,
  input: { number: string; exp_month: number; exp_year: number; holder: string },
): Promise<SavedCard> {
  const digits = input.number.replace(/\D/g, "");
  const cards = await getCards(accountId);
  const card: SavedCard = {
    id: `card_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    brand: brandFromNumber(digits),
    last4: digits.slice(-4),
    exp_month: input.exp_month,
    exp_year: input.exp_year,
    holder: input.holder.trim().toUpperCase(),
    is_default: cards.length === 0,
    added_at: new Date().toISOString(),
  };
  await saveCards(accountId, [...cards, card]);
  return card;
}

export async function setDefaultCard(accountId: string, cardId: string): Promise<void> {
  const cards = await getCards(accountId);
  await saveCards(
    accountId,
    cards.map((c) => ({ ...c, is_default: c.id === cardId })),
  );
}

export async function removeCard(accountId: string, cardId: string): Promise<void> {
  const cards = await getCards(accountId).then((cs) => cs.filter((c) => c.id !== cardId));
  // Keep a default if any cards remain.
  if (cards.length && !cards.some((c) => c.is_default)) cards[0].is_default = true;
  await saveCards(accountId, cards);
}

export function maskedCard(card: SavedCard): string {
  return `•••• •••• •••• ${card.last4}`;
}
