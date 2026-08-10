/**
 * Account tiers and their privileges.
 *
 * Three levels: a free Buyer, and two paid merchant tiers. Everything the
 * app gates on lives in this one table so pricing pages, dashboards, the
 * API middleware and the order engine can never disagree about what a tier
 * is allowed to do.
 */

export const TIERS = ["buyer", "merchant", "elite"] as const;
export type Tier = (typeof TIERS)[number];

export interface TierPrivileges {
  /** Wholesale discount off list, in basis points (1500 = 15%). */
  discountBps: number;
  /** Quote requests per calendar month; null = unlimited. */
  rfqPerMonth: number | null;
  /** Prepaid on-behalf orders per calendar month; null = unlimited. */
  onBehalfOrdersPerMonth: number | null;
  /** May create prepaid claim links at all. */
  canOrderOnBehalf: boolean;
  /** May hold a prepaid wallet balance. */
  hasWallet: boolean;
  /** Net-terms credit line (cents). 0 = prepay only. */
  creditLimitCents: number;
  /** API access level. */
  apiAccess: "none" | "read" | "full";
  /** Outbound webhooks for order lifecycle events. */
  webhooks: boolean;
  /** Additional users on the same account; null = unlimited. */
  seats: number | null;
  /** Merchant logo shown on the buyer's claim page. */
  coBrandedClaimPage: boolean;
  /** Per-product MOQ handling. */
  moqPolicy: "full" | "reduced" | "waived";
  sampleOrders: boolean;
  consolidatedShipping: boolean;
  prioritySourcing: boolean;
  accountManager: "none" | "shared" | "dedicated";
  analytics: "basic" | "full" | "full_export";
  featuredPlacement: boolean;
}

export const TIER_PRIVILEGES: Record<Tier, TierPrivileges> = {
  buyer: {
    discountBps: 0,
    rfqPerMonth: 3,
    onBehalfOrdersPerMonth: 0,
    canOrderOnBehalf: false,
    hasWallet: false,
    creditLimitCents: 0,
    apiAccess: "none",
    webhooks: false,
    seats: 1,
    coBrandedClaimPage: false,
    moqPolicy: "full",
    sampleOrders: false,
    consolidatedShipping: false,
    prioritySourcing: false,
    accountManager: "none",
    analytics: "basic",
    featuredPlacement: false,
  },
  merchant: {
    discountBps: 800,
    rfqPerMonth: null,
    onBehalfOrdersPerMonth: 20,
    canOrderOnBehalf: true,
    hasWallet: true,
    creditLimitCents: 0,
    apiAccess: "read",
    webhooks: false,
    seats: 3,
    coBrandedClaimPage: false,
    moqPolicy: "reduced",
    sampleOrders: true,
    consolidatedShipping: true,
    prioritySourcing: false,
    accountManager: "shared",
    analytics: "full",
    featuredPlacement: false,
  },
  elite: {
    discountBps: 1500,
    rfqPerMonth: null,
    onBehalfOrdersPerMonth: null,
    canOrderOnBehalf: true,
    hasWallet: true,
    creditLimitCents: 2_500_000, // $25,000 net terms
    apiAccess: "full",
    webhooks: true,
    seats: null,
    coBrandedClaimPage: true,
    moqPolicy: "waived",
    sampleOrders: true,
    consolidatedShipping: true,
    prioritySourcing: true,
    accountManager: "dedicated",
    analytics: "full_export",
    featuredPlacement: true,
  },
};

/** Subscription pricing, in USD cents. */
export const TIER_PRICING: Record<Tier, { monthlyCents: number; annualCents: number }> = {
  buyer: { monthlyCents: 0, annualCents: 0 },
  merchant: { monthlyCents: 4_900, annualCents: 49_000 }, // $49/mo, $490/yr (2 months free)
  elite: { monthlyCents: 19_900, annualCents: 199_000 }, // $199/mo, $1,990/yr
};

export function privilegesFor(tier: Tier): TierPrivileges {
  return TIER_PRIVILEGES[tier];
}

export function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value);
}

/** Rank for comparisons: elite outranks merchant outranks buyer. */
export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier);
}

export function atLeast(tier: Tier, minimum: Tier): boolean {
  return tierRank(tier) >= tierRank(minimum);
}

/**
 * The unit price a given tier pays. Never call this with a client-supplied
 * tier — always resolve the tier from the authenticated account server-side.
 */
export function tierUnitPriceCents(listCents: number, tier: Tier): number {
  const { discountBps } = TIER_PRIVILEGES[tier];
  if (discountBps === 0) return listCents;
  // Local import avoids a cycle: money.ts has no dependency on tiers.ts.
  const discounted = Math.round((listCents * (10_000 - discountBps)) / 10_000);
  return Math.max(0, discounted);
}

/** Effective MOQ after the tier's MOQ policy. */
export function effectiveMoq(baseMoq: number, tier: Tier): number {
  switch (TIER_PRIVILEGES[tier].moqPolicy) {
    case "waived":
      return 1;
    case "reduced":
      return Math.max(1, Math.ceil(baseMoq / 2));
    default:
      return Math.max(1, baseMoq);
  }
}

/** Minimum order value in USD cents, by tier. */
export const MIN_ORDER_CENTS: Record<Tier, number> = {
  buyer: 2_500, // ~EGP 1,000 equivalent, matching HDML's floor
  merchant: 2_500,
  elite: 0,
};
