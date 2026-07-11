// Server-only Cloudinary helpers (Phase D.2, security-sensitive per ADR-010:
// we store only the URL, the image lives in Cloudinary).
//
// Signed direct upload: the browser uploads the file straight to Cloudinary
// (keeping big files off our server / under Vercel's 4.5MB body limit), but
// it can only do so with a signature WE generate server-side using the API
// secret. The secret never leaves the server — the client receives only the
// short-lived signature + the params it must echo back.
//
// `import "server-only"` makes the build fail if this module is ever pulled
// into a client bundle, so the API secret can't leak that way.
import "server-only";

import { v2 as cloudinary } from "cloudinary";

// Uploads are scoped to a fixed allowlist of folders. The signature commits to
// the folder, and isOwnCloudinaryUrl() checks for it — so a client can't upload
// elsewhere on our cloud, and can't hand us back a URL from another folder/host.
// The folder is chosen server-side by each sign endpoint (never by the client),
// and the UploadFolder type prevents signing an arbitrary path.
export const PAYMENT_PROOFS_FOLDER = "payment-proofs";
export const PRODUCT_IMAGES_FOLDER = "products";

export type UploadFolder =
  | typeof PAYMENT_PROOFS_FOLDER
  | typeof PRODUCT_IMAGES_FOLDER;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  // Fail loud at module load rather than producing bad signatures at runtime.
  throw new Error(
    "Cloudinary env not configured (CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET).",
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export type UploadSignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

/**
 * Generate a signature the browser uses to upload one file directly to
 * Cloudinary, scoped to `folder`. The signed params (folder + timestamp) are
 * exactly what the client must send with the upload — Cloudinary recomputes the
 * signature from them and rejects the upload if anything was tampered with. The
 * API secret is used only here, server-side, and is never returned. The folder
 * is always chosen by the (guarded) sign endpoint, never by the client.
 */
export function generateUploadSignature(folder: UploadFolder): UploadSignature {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    folder,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret!);

  return {
    signature,
    timestamp,
    apiKey: apiKey!,
    cloudName: cloudName!,
    folder,
  };
}

/**
 * True only if `url` is a Cloudinary secure URL on OUR cloud AND under the
 * given `folder`. A client returns the uploaded URL to us; we must not store an
 * arbitrary URL it could send instead (e.g. an off-cloud image, or a different
 * folder). Parsed with the URL API so string tricks can't slip past.
 */
export function isOwnCloudinaryUrl(url: string, folder: UploadFolder): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "res.cloudinary.com") return false;
  // Path is /<cloudName>/image/upload/.../<folder>/<file>
  if (!parsed.pathname.startsWith(`/${cloudName}/`)) return false;
  if (!parsed.pathname.includes(`/${folder}/`)) return false;

  return true;
}
