import { cn } from "@/lib/utils";
import { useMemberPhotoUrl } from "@/lib/memberPhoto";

const sizes = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-20 text-xl",
} as const;

/** 사진이 없으면 이름 첫 글자를 보여주는 정사각형 프로필 */
export function MemberAvatar({
  name,
  photoPath,
  size = "md",
  dimmed,
  className,
}: {
  name: string;
  photoPath?: string | null | undefined;
  size?: keyof typeof sizes;
  dimmed?: boolean | undefined;
  className?: string | undefined;
}) {
  const photo = useMemberPhotoUrl(photoPath);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border-strong bg-secondary font-extrabold text-muted-foreground",
        sizes[size],
        dimmed && "opacity-50 grayscale",
        className,
      )}
      aria-hidden={false}
    >
      {photo.data ? (
        <img src={photo.data} alt={`${name} 회원 사진`} className="size-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
