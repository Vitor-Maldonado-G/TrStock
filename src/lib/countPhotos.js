import { supabase } from "./supabaseClient";

const PHOTO_BUCKET = "fotos-contagem";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function signedPhotoUrl(path) {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  return error ? null : data?.signedUrl ?? null;
}

export async function attachSignedPhotoUrls(counts = []) {
  return Promise.all(
    counts.map(async (count) => ({
      ...count,
      photoPreviewUrl: await signedPhotoUrl(count.photo_path),
    })),
  );
}
