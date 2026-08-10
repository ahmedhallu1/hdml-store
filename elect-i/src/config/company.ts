/**
 * Single source of truth for ELECT-I Global's public identity.
 *
 * IMPORTANT — read before editing:
 * Every field here is rendered to real buyers who make payment decisions
 * based on it. Nothing in this file may be invented. Fields that are not yet
 * true are left empty, and the UI hides the corresponding block entirely
 * (see `hasLegalEntity`, `hasOffice`, `hasCredentials`). Fill them in only
 * from real registration documents.
 *
 * The company overview PDF this brand came from explicitly labelled its
 * leadership, registration numbers, incorporation details and founding year
 * as fictional placeholders. Those are deliberately NOT reproduced here.
 */

export interface LegalEntity {
  /** Registered company name exactly as it appears on the certificate. */
  registeredName: string;
  entityType: string;
  jurisdiction: string;
  /** Company/commercial registration number. */
  registrationNumber: string;
  taxNumber: string;
}

export interface Office {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export const company = {
  /** Trading name — safe to display everywhere. */
  name: "ELECT-I Global",
  domain: "elect-i-global.com",
  slogan: "Source Smarter. Trade Globally.",
  oneLine: "Global B2B wholesale sourcing for electronics and general merchandise.",
  shortDescription:
    "ELECT-I Global is a B2B wholesale platform for electronics and general merchandise, connecting business buyers with manufacturers, suppliers and distributors through sourcing, inspection, payment and logistics services.",

  /**
   * ELECT-I Global is the platform and the seller of record — buyers contract
   * directly with ELECT-I Global, and this single string is surfaced on the
   * Terms/About/claim pages, order emails and the home page so the counterparty
   * is always named consistently. No third party is a counterparty on orders.
   */
  operator: {
    name: "ELECT-I Global",
    country: "",
    disclosure:
      "ELECT-I Global is the platform and the seller of record for every order placed here — your single counterparty from quotation through to delivery, and the name that appears on your order documents.",
  },

  /** Empty until a real entity is registered. UI hides the legal block. */
  legalEntity: {
    registeredName: "",
    entityType: "",
    jurisdiction: "",
    registrationNumber: "",
    taxNumber: "",
  } satisfies LegalEntity,

  /** Empty until a real, verifiable address exists. */
  office: {
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
  } satisfies Office,

  /**
   * Real, monitored contact routes only.
   *
   * These five addresses are provisioned in Cloudflare Email Routing and
   * forward to a monitored inbox; contact@ is also the authenticated Brevo
   * sender for all transactional mail. Do NOT add an address here before it
   * actually routes — an advertised mailbox that silently drops a buyer's
   * message is worse than not advertising one.
   */
  contact: {
    mailboxesLive: true,
    email: "contact@elect-i-global.com",
    // No phone line is published: contact is email-only for now. Do not add a
    // personal number here.
    departments: [
      { key: "general", address: "contact@elect-i-global.com" },
      { key: "sales", address: "orders@elect-i-global.com" },
      { key: "support", address: "support@elect-i-global.com" },
      { key: "billing", address: "billing@elect-i-global.com" },
    ],
  },

  businessHours: {
    weekdays: "Sunday – Thursday, 09:00 – 18:00",
    saturday: "Saturday, 09:00 – 13:00",
    timezone: "Africa/Cairo (UTC+2)",
  },

  /**
   * Claims we can actually stand behind today. Anything implying third-party
   * factory audits, a founding year, or government-verified credentials is
   * omitted until those processes genuinely exist.
   */
  capabilities: {
    inspectionsOffered: false,
    factoryAuditsOffered: false,
    escrowOffered: false,
    supplierVerificationOffered: false,
  },
} as const;

export const hasLegalEntity = Boolean(company.legalEntity.registeredName);
export const hasOffice = Boolean(company.office.line1 && company.office.city);
export const hasCredentials = hasLegalEntity && Boolean(company.legalEntity.registrationNumber);

/** Trade terms and payment rails the platform can quote against. */
export const tradeTerms = ["EXW", "FOB", "CIF", "CFR", "DDP", "DAP", "FCA"] as const;

export const shippingMethods = [
  "express_courier",
  "air_freight",
  "sea_freight",
  "rail_freight",
  "road_freight",
  "door_to_door",
  "port_to_port",
  "consolidated_cargo",
  "fcl",
  "lcl",
] as const;
