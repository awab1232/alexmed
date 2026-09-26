// 💳 Billing vocabulary shared by server and UI (no server imports): plan
// shape, features, metered resources, structured error codes, and the
// display-only local-currency equivalent. Limits and prices themselves live
// in the `plans` table (lib/billing/plans.ts) — never hard-coded here.

export const PLAN_IDS = ["free", "pro", "ultimate"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const DEFAULT_PLAN_ID: PlanId = "free";

export const FEATURES = [
  "ASSISTANT",
  "BOOK_UPLOAD",
  "QUESTION_UPLOAD",
  "CARDS",
  "QUIZ",
  "SUMMARY",
  "MIND_MAP",
  "EXAM_FOCUS",
  "CHAT_HISTORY",
  "PRIORITY_PROCESSING",
  "LARGE_FILES",
] as const;
export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABELS_AR: Record<Feature, string> = {
  ASSISTANT: "مساعد Niro (AI Assistant)",
  BOOK_UPLOAD: "رفع الملفات والكتب",
  QUESTION_UPLOAD: "رفع ملفات الأسئلة",
  CARDS: "Cards",
  QUIZ: "Quiz",
  SUMMARY: "Summary",
  MIND_MAP: "Mind Map",
  EXAM_FOCUS: "Exam Focus",
  CHAT_HISTORY: "حفظ سجل المحادثات",
  PRIORITY_PROCESSING: "Priority Processing",
  LARGE_FILES: "ملفات كبيرة الحجم",
};

// Metered resources (lib/billing/usage.ts).
export const RESOURCES = [
  "ASSISTANT_MESSAGE",
  "QUESTION_FILE",
  "BOOK_FILE",
] as const;
export type Resource = (typeof RESOURCES)[number];

export type PlanConfig = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number | null;
  currency: string;
  assistantDailyLimit: number;
  assistantTokenDailyLimit: number | null;
  questionsDailyLimit: number;
  questionsMonthlyLimit: number | null;
  booksDailyLimit: number;
  booksMonthlyLimit: number | null;
  maxFileSizeMb: number;
  processingConcurrency: number;
  features: Record<string, boolean>;
  highlighted: boolean;
  active: boolean;
  sortOrder: number;
};

export function planHasFeature(plan: PlanConfig, feature: Feature): boolean {
  return plan.features[feature] === true;
}

export function maxFileSizeBytes(plan: Pick<PlanConfig, "maxFileSizeMb">) {
  return plan.maxFileSizeMb * 1024 * 1024;
}

// Structured errors the API returns; the UI maps them to Arabic copy.
export const BILLING_ERROR_CODES = [
  "PLAN_LIMIT_REACHED",
  "MONTHLY_LIMIT_REACHED",
  "FILE_SIZE_LIMIT",
  "FEATURE_NOT_AVAILABLE",
  "SUBSCRIPTION_EXPIRED",
  "PAYMENT_REQUEST_PENDING",
] as const;
export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[number];

export type BillingErrorDetails = {
  code: BillingErrorCode;
  resource?: Resource;
  feature?: Feature;
  planId: string;
  planName: string;
  limit?: number;
  used?: number;
  maxFileSizeMb?: number;
  actualFileSizeMb?: number;
  // Next plan up that would lift this limit, for the "upgrade" CTA.
  upgradePlanId?: string;
  upgradePlanName?: string;
  upgradeValue?: number;
};

export function formatPrice(cents: number, currency = "USD"): string {
  const amount = cents / 100;
  return currency === "USD"
    ? `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
    : `${amount} ${currency}`;
}

// ── Local-currency equivalent (display only — payment is in USD) ────────
export type LocalCurrency = {
  code: string;
  symbolAr: string;
  decimals: number;
};

export const LOCAL_CURRENCIES: Record<string, LocalCurrency> = {
  JOD: { code: "JOD", symbolAr: "د.أ", decimals: 2 },
  SAR: { code: "SAR", symbolAr: "ر.س", decimals: 0 },
  AED: { code: "AED", symbolAr: "د.إ", decimals: 0 },
  KWD: { code: "KWD", symbolAr: "د.ك", decimals: 2 },
  QAR: { code: "QAR", symbolAr: "ر.ق", decimals: 0 },
  BHD: { code: "BHD", symbolAr: "د.ب", decimals: 2 },
  OMR: { code: "OMR", symbolAr: "ر.ع", decimals: 2 },
  ILS: { code: "ILS", symbolAr: "₪", decimals: 0 },
  LBP: { code: "LBP", symbolAr: "ل.ل", decimals: 0 },
  SYP: { code: "SYP", symbolAr: "ل.س", decimals: 0 },
  IQD: { code: "IQD", symbolAr: "د.ع", decimals: 0 },
  EGP: { code: "EGP", symbolAr: "ج.م", decimals: 0 },
};

export const COUNTRY_CURRENCY: Record<string, string> = {
  JO: "JOD",
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  QA: "QAR",
  BH: "BHD",
  OM: "OMR",
  PS: "ILS",
  LB: "LBP",
  SY: "SYP",
  IQ: "IQD",
  EG: "EGP",
};

const TIMEZONE_COUNTRY: Record<string, string> = {
  "Asia/Amman": "JO",
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Kuwait": "KW",
  "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH",
  "Asia/Muscat": "OM",
  "Asia/Gaza": "PS",
  "Asia/Hebron": "PS",
  "Asia/Beirut": "LB",
  "Asia/Damascus": "SY",
  "Asia/Baghdad": "IQ",
  "Africa/Cairo": "EG",
};

const DIAL_COUNTRY: Record<string, string> = {
  "962": "JO",
  "966": "SA",
  "971": "AE",
  "965": "KW",
  "974": "QA",
  "973": "BH",
  "968": "OM",
  "970": "PS",
  "961": "LB",
  "963": "SY",
  "964": "IQ",
  "20": "EG",
};

// Best guess of the student's country: their verified phone number first,
// else the device's timezone. Only used to pick a display currency.
export function guessCountry(input: {
  phone?: string | null;
  timeZone?: string | null;
}): string | null {
  if (input.phone?.startsWith("+")) {
    const digits = input.phone.slice(1);
    const dial = Object.keys(DIAL_COUNTRY).find(d => digits.startsWith(d));
    if (dial) return DIAL_COUNTRY[dial];
  }
  return (input.timeZone && TIMEZONE_COUNTRY[input.timeZone]) || null;
}

// "≈ 7.09 د.أ" for $10 in Jordan; null when there's no rate for the country
// (then only the USD price is shown).
export function localEquivalent(
  usdCents: number,
  country: string | null,
  rates: Record<string, number>
): string | null {
  if (!country || usdCents <= 0) return null;
  const code = COUNTRY_CURRENCY[country];
  const currency = code ? LOCAL_CURRENCIES[code] : undefined;
  const rate = code ? rates[code] : undefined;
  if (!currency || !rate || rate <= 0) return null;
  const value = (usdCents / 100) * rate;
  const formatted = value.toLocaleString("en-US", {
    maximumFractionDigits: currency.decimals,
    minimumFractionDigits: currency.decimals,
  });
  return `≈ ${formatted} ${currency.symbolAr}`;
}

export type BillingSettings = {
  paymentInstructions: string;
  supportContact: { label: string; url: string };
  paymentMethods: string[];
  currencyRates: Record<string, number>;
};

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  paymentInstructions:
    "الدفع حاليًا يتم يدويًا. تواصل مع فريق NiroLearn لتحصل على طريقة الدفع المناسبة لبلدك.",
  supportContact: { label: "تواصل مع الدعم", url: "" },
  paymentMethods: ["تحويل بنكي", "محفظة إلكترونية", "أخرى"],
  currencyRates: {},
};

export const SUBSCRIPTION_STATUS_AR: Record<string, string> = {
  active: "فعّالة",
  expired: "منتهية",
  cancelled: "ملغاة",
  pending: "بانتظار التفعيل",
  paused: "موقوفة مؤقتًا",
};

export const PAYMENT_STATUS_AR: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  cancelled: "ملغى",
};
