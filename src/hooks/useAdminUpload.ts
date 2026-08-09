import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { compressImage, fileExtension } from "@/lib/image";
import { newId } from "@/lib/utils";

type Bucket = "product-images" | "product-videos";

/**
 * Uploads to Supabase Storage, always compressing images first — whatever lands
 * in the bucket is exactly what every shopper downloads.
 *
 * Returns `null` on failure so every call site is forced to branch; the caller
 * shows the toast.
 */
export function useAdminUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File, bucket: Bucket = "product-images", prefix = ""): Promise<string | null> => {
      setUploading(true);
      try {
        const payload = bucket === "product-images" ? await compressImage(file) : file;
        const path = `${prefix}${newId()}.${fileExtension(payload)}`;

        const { error } = await supabase.storage.from(bucket).upload(path, payload, {
          // Paths carry a UUID, so the object is immutable. Supabase's default
          // is one hour.
          cacheControl: "31536000",
          upsert: false,
          contentType: payload.type || undefined,
        });

        if (error) return null;

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      } catch {
        return null;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  return { upload, uploading };
}
