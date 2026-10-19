// Supabase Storage adapter for durable ticket attachments.
// Uses the server-side service role key; never expose it to browser code.
import { ENV } from "./_core/env";

function getStorageConfig() {
  const supabaseUrl = ENV.supabaseUrl.replace(/\/+$/, "");
  const serviceRoleKey = ENV.supabaseServiceRoleKey;
  const bucket = ENV.supabaseStorageBucket;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Storage config missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!bucket) throw new Error("Storage config missing: set SUPABASE_STORAGE_BUCKET");
  return { supabaseUrl, serviceRoleKey, bucket };
}

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "");
  if (!key || key.split("/").some(part => part === "." || part === "..")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot <= relKey.lastIndexOf("/")) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function storageHeaders(serviceRoleKey: string): Record<string, string> {
  return { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };
}

function objectPath(bucket: string, key: string): string {
  return `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${objectPath(bucket, key)}`, {
    method: "POST",
    headers: { ...storageHeaders(serviceRoleKey), "Content-Type": contentType, "x-upsert": "false" },
    body: typeof data === "string" ? data : new Uint8Array(data),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Supabase Storage upload failed (${response.status}): ${message.slice(0, 500)}`);
  }
  return { key, url: `supabase-storage://${bucket}/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { bucket } = getStorageConfig();
  const key = normalizeKey(relKey);
  return { key, url: `supabase-storage://${bucket}/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const key = normalizeKey(relKey);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${objectPath(bucket, key)}`, {
    method: "POST",
    headers: { ...storageHeaders(serviceRoleKey), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Supabase Storage signed URL failed (${response.status}): ${message.slice(0, 500)}`);
  }
  const result = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = result.signedURL ?? result.signedUrl;
  if (!signedPath) throw new Error("Supabase Storage did not return a signed URL");
  return new URL(signedPath, supabaseUrl).toString();
}
