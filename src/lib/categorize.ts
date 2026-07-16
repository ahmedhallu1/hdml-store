/**
 * Deterministic keyword-based category & brand inference for imported products.
 * No AI APIs: plain ordered regex rules (first match wins). Anything that does
 * not match lands in "other" and is flagged for review by the importer's rules.
 */

export interface CategoryRule {
  slug: string;
  pattern: RegExp;
}

/** Ordered: more specific rules first. Slugs must exist in 0004_seed.sql. */
export const CATEGORY_RULES: CategoryRule[] = [
  { slug: "earbuds-headphones", pattern: /earbud|headphone|earphone|airpods?\b|headset|freepods|ear tips/i },
  { slug: "speakers-audio", pattern: /speaker|soundbar|karaoke|microphone|\bmic\b|amplifier|audio interface|turntable|\bdj\b/i },
  { slug: "chargers-power", pattern: /charger|power ?bank|charging|\bups\b|power strip|power supply|inverter|استبليزر/i },
  { slug: "cables-adapters", pattern: /cable|\bhdmi\b|\bdongle\b|converter|electronic_cable|\botg\b|splitter|extension/i },
  { slug: "cases-protection", pattern: /\bcase\b|\bcover\b|screen protector|tempered glass|lens protector|phone_case|shatterproof|shockproof/i },
  { slug: "phone-accessories", pattern: /phone (holder|stand|grip|mount)|selfie|stylus|\bsim\b|phone strap|popsocket|sticky grip|car (mount|holder)|gimbal.*phone/i },
  { slug: "storage-memory", pattern: /\bssd\b|\bhdd\b|hard (disk|drive)|flash drive|memory card|micro ?sd\b|datatraveler|usb (2\.0|3\.[012])|card reader|\bnvme\b|\bram\b|\bdimm\b|pendrive/i },
  { slug: "networking", pattern: /router|wi-?fi|access point|range extender|modem|ethernet|\bmesh\b|network switch|\bpoe\b/i },
  { slug: "computer-peripherals", pattern: /\bmouse\b|keyboard|mouse ?pad|webcam|laptop stand|docking|\bhub\b|monitor|printer|scanner|toner|\bink\b|cooling pad|presenter/i },
  { slug: "laptops-bags", pattern: /backpack|laptop (bag|sleeve|case)|messenger bag|shoulder bag/i },
  { slug: "wearables", pattern: /smart ?watch|watch (band|strap|case|protector)|fitness (band|tracker)|amazfit|\bwearable/i },
  { slug: "cameras-photography", pattern: /camera|tripod|gimbal|\blens\b|ring light|softbox|pavotube|photography|\bgopro\b|action cam|drone|studio light/i },
  { slug: "gaming", pattern: /gaming|game ?pad|controller|joystick|playstation|\bps[45]\b|xbox|nintendo|console/i },
  { slug: "tv-video", pattern: /\btv\b|projector|streaming|chromecast|receiver|set.?top|شاشة/i },
  { slug: "batteries", pattern: /batter(y|ies)|\baa\b|\baaa\b|rechargeable|18650/i },
  { slug: "smart-home", pattern: /smart (home|plug|bulb|lamp|camera)|alexa|echo dot|air ?tag|tracker\b|\bgps\b/i },
  { slug: "tablets-ereaders", pattern: /tablet|\bipad\b|kindle|e-?reader|galaxy tab/i },
  { slug: "smartphones", pattern: /smartphone|\biphone \d|\bgalaxy [sanm]\d|\bredmi\b|\brealme [c\d]|\binfinix\b|\boppo [af]\d|\bvivo [xy]|\bhonor [x\d]|\bnokia \d|\bxiaomi \d/i },
  { slug: "computers", pattern: /\blaptop\b|\bnotebook\b|desktop|\bpc\b|optiplex|thinkpad|ideapad|macbook|all.?in.?one|mini pc/i },
];

export const FALLBACK_CATEGORY = "other";

export function inferCategory(name: string): { slug: string; inferred: boolean } {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return { slug: rule.slug, inferred: true };
  }
  return { slug: FALLBACK_CATEGORY, inferred: true };
}

/**
 * Known brands. Matched case-insensitively at word boundaries; the longest
 * match wins so "Anker Soundcore" beats "Anker".
 */
export const KNOWN_BRANDS: string[] = [
  "Anker", "Soundcore", "Oraimo", "JBL", "Belkin", "Kingston", "Canon", "Epson",
  "TP-Link", "Tenda", "D-Link", "Mikrotik", "Netgear", "Xiaomi", "Redmi",
  "Samsung", "Apple", "Baseus", "Ugreen", "Lenovo", "HP", "Dell", "Asus",
  "Acer", "MSI", "Logitech", "SanDisk", "Western Digital", "WD", "Sony",
  "Huawei", "Realme", "Oppo", "Vivo", "Infinix", "Tecno", "Honor", "Nokia",
  "Amazfit", "Energizer", "Camelion", "Duracell", "Bixolon", "IK Multimedia",
  "Nanlite", "ESR", "Aspor", "Joyroom", "Awei", "Hoco", "Remax", "Recci",
  "Yesido", "Vidvie", "Ldnio", "Vention", "Orico", "Genius", "A4Tech",
  "Redragon", "Havit", "Fantech", "Aula", "Rapoo", "Green Lion", "Powerology",
  "Porodo", "Momax", "Spigen", "Nillkin", "OtterBox", "Edifier", "Tronsmart",
  "Beats", "Bose", "Marshall", "Harman Kardon", "Wiwu", "Devia", "Celebrat",
  "Yison", "Moxom", "Earldom", "Konfulon", "Toshiba", "Seagate", "Adata",
  "Lexar", "PNY", "Transcend", "Crucial", "Netac", "Xtrike Me", "Meetion",
  "Marvo", "Onikuma", "Zoook", "Promate", "Riversong", "Borofone", "Kakusiga",
  "Golf", "Jellico", "Denmen", "XO", "Proda", "Pisen", "Romoss", "Oukitel",
  "Blackview", "Typecase", "Nintendo", "Microsoft", "Razer", "SteelSeries",
  "HyperX", "Corsair", "Philips", "LG", "Sharp", "Tornado", "Fresh", "Unionaire",
  "Brother", "Ricoh", "Kyocera", "Zebra", "Godox", "Boya", "Rode", "Saramonic",
  "DJI", "GoPro", "Insta360", "Wewatch", "Airklc", "Camelion", "Force",
];

interface BrandMatcher {
  name: string;
  pattern: RegExp;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BRAND_MATCHERS: BrandMatcher[] = [...new Set(KNOWN_BRANDS)]
  .sort((a, b) => b.length - a.length)
  .map((name) => ({
    name,
    pattern: new RegExp(`(?<![a-z0-9])${escapeRegExp(name).replace(/[- ]/g, "[- ]?")}(?![a-z0-9])`, "i"),
  }));

export function inferBrand(name: string): { brand: string | null; inferred: boolean } {
  for (const m of BRAND_MATCHERS) {
    if (m.pattern.test(name)) return { brand: m.name, inferred: true };
  }
  return { brand: null, inferred: false };
}

/** Heuristics for records that need a human look before going live. */
export function reviewFlags(name: string): string[] {
  const flags: string[] = [];
  if (/_/.test(name)) flags.push("generic_name");
  if (name.trim().length < 12) flags.push("very_short_name");
  // Mojibake: mangled Arabic shows up as dense Latin-1 supplement noise
  // (¡–ÿ covers §, ³, ¹, ©, Ù … while a threshold of 3 spares the odd
  // legitimate accented character).
  const weird = (name.match(/[¡-ÿŒ-˜]/g) ?? []).length;
  if (weird >= 3) flags.push("corrupted_text");
  if (/[؀-ۿ]/.test(name)) flags.push("arabic_text");
  return flags;
}
