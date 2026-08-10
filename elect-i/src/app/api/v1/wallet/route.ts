import { authenticate, authErrorResponse, apiError, hasScope } from "../_lib/authenticate";
import { supabaseService } from "@/lib/supabase/server";
import { centsToDecimalString, toCents } from "@/lib/money";
import { privilegesFor } from "@/lib/tiers";

/** GET /api/v1/wallet — balance, credit headroom and recent ledger entries. */
export async function GET(request: Request) {
  const auth = await authenticate(request, "");
  if (!auth.ok) return authErrorResponse(auth.reason);
  const { caller } = auth;

  if (!hasScope(caller, "wallet:read")) {
    return apiError("forbidden", "This key cannot read the wallet", 403);
  }

  const service = supabaseService();
  const { data: account } = await service
    .from("accounts")
    .select("wallet_balance, credit_limit, credit_used")
    .eq("user_id", caller.accountId)
    .single();

  if (!account) return apiError("not_found", "Account not found", 404);

  const { data: ledger } = await service
    .from("wallet_transactions")
    .select("kind, amount, balance_after, order_id, note, created_at")
    .eq("account_id", caller.accountId)
    .order("created_at", { ascending: false })
    .limit(20);

  const limitCents = toCents(String(account.credit_limit));
  const usedCents = toCents(String(account.credit_used));

  return Response.json({
    currency: "USD",
    balance: account.wallet_balance,
    credit_limit: account.credit_limit,
    credit_used: account.credit_used,
    credit_available: centsToDecimalString(Math.max(0, limitCents - usedCents)),
    tier: caller.tier,
    on_behalf_orders_per_month: privilegesFor(caller.tier).onBehalfOrdersPerMonth,
    recent_transactions: (ledger ?? []).map((t) => ({
      kind: t.kind,
      amount: t.amount,
      balance_after: t.balance_after,
      order_id: t.order_id,
      note: t.note,
      created_at: t.created_at,
    })),
  });
}
