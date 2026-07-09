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

// Every payment proof lands in this one folder. The signature commits to it,
// and isOwnCloudinaryUrl() checks for it — so a client can't upload elsewhere
// on our cloud, and can't hand us back a URL from some other folder/host.
export const PAYMENT_PROOFS_FOLDER = "payment-proofs";

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
 * Cloudinary. The signed params (folder + timestamp) are exactly what the
 * client must send with the upload — Cloudinary recomputes the signature from
 * them and rejects the upload if anything was tampered with. The API secret
 * is used only here, server-side, and is never returned.
 */
export function generateUploadSignature(): UploadSignature {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    folder: PAYMENT_PROOFS_FOLDER,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret!);

  return {
    signature,
    timestamp,
    apiKey: apiKey!,
    cloudName: cloudName!,
    folder: PAYMENT_PROOFS_FOLDER,
  };
}

/**
 * True only if `url` is a Cloudinary secure URL on OUR cloud AND under the
 * payment-proofs folder. A client returns the uploaded URL to us; we must not
 * store an arbitrary URL it could send instead (e.g. an off-cloud image, or a
 * different folder). Parsed with the URL API so string tricks can't slip past.
 */
export function isOwnCloudinaryUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "res.cloudinary.com") return false;
  // Path is /<cloudName>/image/upload/.../payment-proofs/<file>
  if (!parsed.pathname.startsWith(`/${cloudName}/`)) return false;
  if (!parsed.pathname.includes(`/${PAYMENT_PROOFS_FOLDER}/`)) return false;

  return true;
}
