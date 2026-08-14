import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3">
          {title && <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({
  children,
  className,
  dark,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-card",
        dark ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 다크 카드 안 라임 숫자 통계 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card dark className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-foreground/60">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="num-lime text-4xl">{value}</span>
        {unit && <span className="text-sm font-semibold text-ink-foreground/70">{unit}</span>}
      </span>
      {hint && <span className="text-xs text-ink-foreground/60">{hint}</span>}
    </Card>
  );
}

export type Tone = "lime" | "ink" | "muted" | "warn" | "danger";

/** 상태 배지: 채워진 pill 형태 (버튼과 명확히 구분) */
export function StatusPill({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    lime: "bg-lime text-lime-foreground",
    ink: "bg-ink text-ink-foreground",
    muted: "bg-secondary text-muted-foreground",
    warn: "bg-warn text-warn-foreground",
    danger: "bg-destructive text-destructive-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border-strong bg-card/60 px-6 py-10 text-center">
      <p className="text-base font-extrabold">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-6 w-40" />
          <Skeleton className="mt-2 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold text-muted-foreground">
      {children}
    </label>
  );
}
