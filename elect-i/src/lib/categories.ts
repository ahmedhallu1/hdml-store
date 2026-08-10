import type { IconName } from "@/components/ui/icon";
import type { Locale } from "@/i18n/config";

/**
 * The eight top-level groups from the company overview. Kept in code as well
 * as in eig.categories so marketing pages render correctly before the catalog
 * is seeded, and so the bento layout weights are version-controlled.
 */
export interface CategoryGroup {
  slug: string;
  key: string;
  nameEn: string;
  nameZh: string;
  icon: IconName;
  blurbEn: string;
  blurbZh: string;
  /** Sample leaf categories shown on the group card. */
  samplesEn: string[];
  samplesZh: string[];
  /** Bento span: 2 = wide tile. */
  span: 1 | 2;
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    slug: "electronics",
    key: "electronics",
    nameEn: "Electronics",
    nameZh: "电子产品",
    icon: "cpu",
    blurbEn: "Smartphones, laptops, components, audio, cameras, networking and smart-home devices.",
    blurbZh: "智能手机、笔记本电脑、元器件、音频、相机、网络设备与智能家居。",
    samplesEn: ["Smartphones", "Laptops", "Components", "Networking", "Wearables", "Refurbished"],
    samplesZh: ["智能手机", "笔记本电脑", "元器件", "网络设备", "可穿戴设备", "翻新设备"],
    span: 2,
  },
  {
    slug: "electrical-industrial",
    key: "industrial",
    nameEn: "Electrical & Industrial",
    nameZh: "电气与工业",
    icon: "factory",
    blurbEn: "Machinery, automation, power tools, solar, lighting, motors and test equipment.",
    blurbZh: "机械设备、自动化、电动工具、太阳能、照明、电机与测试设备。",
    samplesEn: ["Machinery", "Automation", "Power tools", "Solar"],
    samplesZh: ["机械设备", "自动化", "电动工具", "太阳能"],
    span: 1,
  },
  {
    slug: "home-lifestyle",
    key: "home",
    nameEn: "Home & Lifestyle",
    nameZh: "家居生活",
    icon: "home",
    blurbEn: "Appliances, kitchen equipment, furniture, décor and personal care.",
    blurbZh: "家电、厨房设备、家具、装饰与个人护理。",
    samplesEn: ["Appliances", "Kitchen", "Furniture", "Décor"],
    samplesZh: ["家电", "厨房", "家具", "装饰"],
    span: 1,
  },
  {
    slug: "fashion-accessories",
    key: "fashion",
    nameEn: "Fashion & Accessories",
    nameZh: "服装配饰",
    icon: "shirt",
    blurbEn: "Clothing, footwear, bags, watches, jewellery, workwear and uniforms.",
    blurbZh: "服装、鞋履、箱包、手表、首饰、工装与制服。",
    samplesEn: ["Clothing", "Footwear", "Bags", "Watches"],
    samplesZh: ["服装", "鞋履", "箱包", "手表"],
    span: 1,
  },
  {
    slug: "office-commercial",
    key: "office",
    nameEn: "Office & Commercial",
    nameZh: "办公商用",
    icon: "briefcase",
    blurbEn: "Office electronics, stationery, printing, POS, packaging and retail displays.",
    blurbZh: "办公电子、文具、印刷耗材、POS 设备、包装与零售陈列。",
    samplesEn: ["Office electronics", "Printing", "POS", "Packaging"],
    samplesZh: ["办公电子", "印刷耗材", "POS 设备", "包装"],
    span: 1,
  },
  {
    slug: "automotive",
    key: "automotive",
    nameEn: "Automotive",
    nameZh: "汽车用品",
    icon: "car",
    blurbEn: "Car electronics, accessories, replacement parts and diagnostic equipment.",
    blurbZh: "汽车电子、汽车配件、更换零部件与诊断设备。",
    samplesEn: ["Car electronics", "Accessories", "Parts", "Diagnostics"],
    samplesZh: ["汽车电子", "配件", "零部件", "诊断设备"],
    span: 1,
  },
  {
    slug: "other-wholesale",
    key: "other",
    nameEn: "Other Wholesale",
    nameZh: "其他批发",
    icon: "package",
    blurbEn: "Toys, beauty, pet supplies, outdoor, promotional goods and hospitality supplies.",
    blurbZh: "玩具、美妆、宠物用品、户外装备、促销礼品与酒店餐饮用品。",
    samplesEn: ["Toys", "Beauty", "Pet supplies", "Outdoor"],
    samplesZh: ["玩具", "美妆", "宠物用品", "户外用品"],
    span: 1,
  },
  {
    slug: "medical-lab",
    key: "medical",
    nameEn: "Medical & Laboratory",
    nameZh: "医疗实验室",
    icon: "flask",
    blurbEn: "Medical and laboratory equipment, subject to applicable regulations.",
    blurbZh: "医疗与实验室设备，须遵守适用法规。",
    samplesEn: ["Lab equipment", "Diagnostics", "Consumables"],
    samplesZh: ["实验室设备", "诊断设备", "耗材"],
    span: 1,
  },
];

export function groupName(group: CategoryGroup, lang: Locale): string {
  return lang === "zh" ? group.nameZh : group.nameEn;
}

export function groupBlurb(group: CategoryGroup, lang: Locale): string {
  return lang === "zh" ? group.blurbZh : group.blurbEn;
}

export function groupSamples(group: CategoryGroup, lang: Locale): string[] {
  return lang === "zh" ? group.samplesZh : group.samplesEn;
}
