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

type SignatureBundle = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

/**
 * Validate + upload one image file to Cloudinary via a signature from
 * `signEndpoint`. Resolves to the stored secure URL. Throws an Error with a
 * friendly, user-facing message on any failure (bad type/size, signature fetch,
 * or Cloudinary rejection). The server re-validates the returned URL's folder
 * before storing it, so these client checks are UX, not the security boundary.
 */
async function uploadImage(
  file: File,
  signEndpoint: string,
): Promise<{ url: string }> {
  // 1. Client-side guards (friendly errors; the server re-checks the URL).
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as never)) {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is larger than 5MB. Please choose a smaller one.");
  }

  // 2. Ask our server for a signature scoped to the target folder.
  const signRes = await fetch(signEndpoint, { method: "POST" });
  if (!signRes.ok) {
    throw new Error("Couldn't start the upload. Please try again.");
  }
  const { signature, timestamp, apiKey, cloudName, folder } =
    (await signRes.json()) as SignatureBundle;

  // 3. Upload straight to Cloudinary. The signed params (folder, timestamp)
  //    must be echoed exactly or Cloudinary rejects the signature.
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  if (!uploadRes.ok) {
    throw new Error("The image upload failed. Please try again.");
  }

  const data = (await uploadRes.json()) as { secure_url?: string };
  if (!data.secure_url) {
    throw new Error("The image upload didn't complete. Please try again.");
  }

  return { url: data.secure_url };
}

/** Upload a customer payment-proof screenshot (payment-proofs folder). */
export function uploadPaymentProof(file: File): Promise<{ url: string }> {
  return uploadImage(file, "/api/v1/uploads/payment-proof/sign");
}

/** Upload a product image (products folder, staff-only endpoint). */
export function uploadProductImage(file: File): Promise<{ url: string }> {
  return uploadImage(file, "/api/v1/uploads/product-image/sign");
}
