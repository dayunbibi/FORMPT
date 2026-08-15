import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PHOTO_BUCKET = "member-photos";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePhoto(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "JPG, PNG, WEBP 파일만 올릴 수 있어요.";
  if (file.size > PHOTO_MAX_BYTES) return "사진 용량은 5MB 이하만 가능해요.";
  return null;
}

function extOf(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

/**
 * 회원 사진 업로드 → Storage 경로만 profiles.photo_path 에 저장한다.
 * 교체 시 기존 파일은 업로드 성공 후 정리한다.
 */
export async function uploadMemberPhoto(memberId: string, file: File, previousPath?: string | null) {
  const invalid = validatePhoto(file);
  if (invalid) throw new Error(invalid);

  const path = `${memberId}/${Date.now()}.${extOf(file)}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ photo_path: path })
    .eq("id", memberId);
  if (profileError) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw profileError;
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);
  }
  return path;
}

export async function removeMemberPhoto(memberId: string, path: string | null) {
  const { error } = await supabase.from("profiles").update({ photo_path: null }).eq("id", memberId);
  if (error) throw error;
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/** 비공개 버킷이므로 서명 URL로만 사진을 노출한다. */
export function useMemberPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["member-photo", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path!, 60 * 30);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    staleTime: 20 * 60 * 1000,
  });
}
