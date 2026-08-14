import { getLocale } from "@/lib/i18n";

export type CurrencyCode = "KRW" | "CAD";

export const CURRENCIES: CurrencyCode[] = ["KRW", "CAD"];

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  KRW: "₩",
  CAD: "CA$",
};

export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  KRW: "원 (KRW)",
  CAD: "캐나다달러 (CAD)",
};

/** 통화 기호/단위에 맞춘 금액 포맷. 환율 변환은 하지 않고 기록된 통화 그대로 표시한다. */
export function formatMoney(amount: number | null | undefined, currency: CurrencyCode) {
  if (amount === null || amount === undefined) return "-";
  const digits = currency === "KRW" ? 0 : 2;
  const value = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${CURRENCY_SYMBOL[currency]}${value}`;
}

export function isCurrency(value: unknown): value is CurrencyCode {
  return value === "KRW" || value === "CAD";
}

export function asCurrency(value: unknown, fallback: CurrencyCode = "KRW"): CurrencyCode {
  return isCurrency(value) ? value : fallback;
}
