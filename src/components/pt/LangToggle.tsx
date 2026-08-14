import { Languages } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "EN" },
];

/** 한국어 / 영어 전환 토글 */
export function LangToggle({ className }: { className?: string | undefined }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("언어 선택")}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-2xl border-2 border-border-strong bg-card p-1",
        className,
      )}
    >
      <Languages className="ml-1 size-3.5 text-muted-foreground" aria-hidden />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={cn(
            "rounded-xl px-2 py-1 text-[11px] font-bold transition-colors",
            lang === o.value ? "bg-ink text-lime" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
