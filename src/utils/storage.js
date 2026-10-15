import { supabase } from "./supabase.js";

const BUCKET_NAME = "inventory-assets";

/**
 * Upload an image or document to Supabase Storage
 * @param {File|Blob} file 
 * @param {string} [folder="products"]
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function uploadInventoryAsset(file, folder = "products") {
  const fileExt = file.name ? file.name.split(".").pop() : "png";
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: publicData.publicUrl,
  };
}

/**
 * Get public URL for any asset path in inventory-assets bucket
 */
export function getAssetPublicUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data?.publicUrl || "";
}

/**
 * List files stored in the bucket
 */
export async function listInventoryAssets(folder = "products") {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folder, {
    limit: 50,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    return { error: error.message, files: [] };
  }
  return { files: data || [], error: null };
}

/**
 * Check if the inventory-assets storage bucket is available
 */
export async function checkStorageHealth() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      return { status: "error", message: error.message, buckets: [] };
    }
    const hasBucket = buckets.some((b) => b.name === BUCKET_NAME);
    return {
      status: "online",
      hasBucket,
      bucketName: BUCKET_NAME,
      buckets: buckets.map((b) => b.name),
    };
  } catch (err) {
    return { status: "error", message: err.message, buckets: [] };
  }
}
