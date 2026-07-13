// Client-side helper for uploading a payment-proof screenshot (Phase D.2).
// Runs in the browser: it fetches a signature from our server, then POSTs the
// file DIRECTLY to Cloudinary — the file never passes through our server (keeps
// us under Vercel's 4.5MB body limit and off our compute). Server-side we still
// re-validate the returned URL (isOwnCloudinaryUrl) before storing it, so this
// client validation is UX, not the security boundary.

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

// Product media may also be video (Phase H #7). Videos are heavier, so a larger
// cap. resource_type=video uploads hit Cloudinary's /video/upload endpoint.
export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

type SignatureBundle = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

/**
 * Upload one file to Cloudinary via a signature from `signEndpoint`, using the
 * given `resourceType` ("image" or "video" — they hit different Cloudinary
 * endpoints). Resolves to the stored secure URL. Throws an Error with a
 * friendly, user-facing message on any failure. Caller does the type/size
 * validation; the server re-validates the returned URL's folder before storing
 * it, so those client checks are UX, not the security boundary.
 */
async function uploadToCloudinary(
  file: File,
  signEndpoint: string,
  resourceType: "image" | "video",
): Promise<{ url: string }> {
  // Ask our server for a signature scoped to the target folder.
  const signRes = await fetch(signEndpoint, { method: "POST" });
  if (!signRes.ok) {
    throw new Error("Couldn't start the upload. Please try again.");
  }
  const { signature, timestamp, apiKey, cloudName, folder } =
    (await signRes.json()) as SignatureBundle;

  // Upload straight to Cloudinary. The signed params (folder, timestamp) must
  // be echoed exactly or Cloudinary rejects the signature. The signature is the
  // same for image/video; only the delivery endpoint differs by resource type.
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: form },
  );
  if (!uploadRes.ok) {
    throw new Error("The upload failed. Please try again.");
  }

  const data = (await uploadRes.json()) as { secure_url?: string };
  if (!data.secure_url) {
    throw new Error("The upload didn't complete. Please try again.");
  }

  return { url: data.secure_url };
}

/** Upload a customer payment-proof screenshot (payment-proofs folder, image). */
export function uploadPaymentProof(file: File): Promise<{ url: string }> {
  // Client-side guards (friendly errors; the server re-checks the URL).
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as never)) {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is larger than 5MB. Please choose a smaller one.");
  }
  return uploadToCloudinary(file, "/api/v1/uploads/payment-proof/sign", "image");
}

/**
 * Upload one product media file (products folder, staff-only endpoint). Detects
 * image vs video by mime type, validates against the matching type/size limits,
 * hits the correct Cloudinary endpoint, and returns the stored URL plus the
 * media `type` (matching the ProductMediaType enum) for the caller to persist.
 */
export async function uploadProductMedia(
  file: File,
): Promise<{ url: string; type: "IMAGE" | "VIDEO" }> {
  const signEndpoint = "/api/v1/uploads/product-image/sign";

  if (ACCEPTED_IMAGE_TYPES.includes(file.type as never)) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("That image is larger than 5MB. Please choose a smaller one.");
    }
    const { url } = await uploadToCloudinary(file, signEndpoint, "image");
    return { url, type: "IMAGE" };
  }

  if (ACCEPTED_VIDEO_TYPES.includes(file.type as never)) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error("That video is larger than 50MB. Please choose a smaller one.");
    }
    const { url } = await uploadToCloudinary(file, signEndpoint, "video");
    return { url, type: "VIDEO" };
  }

  throw new Error("Please choose a JPG, PNG, WebP image or an MP4, WebM, MOV video.");
}
