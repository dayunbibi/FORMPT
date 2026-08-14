import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EN } from "./en";

export type Lang = "ko" | "en";

const STORAGE_KEY = "formfit.lang";

export const LOCALES: Record<Lang, string> = { ko: "ko-KR", en: "en-CA" };

/** 모듈 스코프 현재 언어 — 훅을 쓸 수 없는 유틸(날짜/상태 라벨 포맷)에서 사용한다. */
let currentLang: Lang = "ko";

export function getLang(): Lang {
  return currentLang;
}

export function getLocale(): string {
  return LOCALES[currentLang];
}

function interpolate(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, key) =>
    key in vars ? String(vars[key as keyof typeof vars]) : m,
  );
}

/** 훅 없이 쓰는 번역 함수. 키는 한국어 원문. */
export function tr(ko: string, vars?: Record<string, string | number>) {
  const text = currentLang === "en" ? (EN[ko] ?? ko) : ko;
  return interpolate(text, vars);
}

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  locale: string;
  t: (ko: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  // 저장된 언어 복원 (SSR 불일치를 피하기 위해 마운트 후 적용)
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ko" || saved === "en") {
      currentLang = saved;
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    currentLang = next;
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    }
  }, []);

  currentLang = lang;

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "ko" ? "en" : "ko"),
      locale: LOCALES[lang],
      t: (ko, vars) => interpolate(lang === "en" ? (EN[ko] ?? ko) : ko, vars),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // 프로바이더 밖(예: 에러 화면)에서도 안전하게 동작한다.
  return {
    lang: currentLang,
    setLang: (next) => {
      currentLang = next;
    },
    toggle: () => {},
    locale: LOCALES[currentLang],
    t: tr,
  };
}
