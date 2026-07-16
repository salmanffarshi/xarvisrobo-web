// Client-safe Cloudinary delivery-URL transforms (Phase H #7). Pure string ops
// on an already-public delivery URL — no API secret, so this is safe in the
// browser bundle (unlike src/lib/cloudinary.ts which is server-only).
//
// A Cloudinary URL looks like:
//   https://res.cloudinary.com/<cloud>/image/upload/v123/products/file.jpg
// Inserting a transformation right after "/upload/" asks Cloudinary's CDN to
// deliver an optimized derivative (auto format/quality, resized) instead of the
// full-res original — so we never ship originals to the client (ADR-010).

/** Insert a transformation segment after "/upload/". Returns the url unchanged
 * if it isn't a recognizable Cloudinary upload URL. */
function withTransform(url: string, transform: string): string {
  return url.includes("/upload/")
    ? url.replace("/upload/", `/upload/${transform}/`)
    : url;
}

/** Optimized image for the main preview: auto format + quality, capped width. */
export function galleryMainUrl(url: string): string {
  return withTransform(url, "f_auto,q_auto,w_1000");
}

/** Small square optimized thumbnail. */
export function galleryThumbUrl(url: string): string {
  return withTransform(url, "f_auto,q_auto,w_300,h_300,c_fill");
}

/** A still frame from a Cloudinary video, delivered as an image — used as the
 * video's poster and its thumbnail. `so_0` = first second. */
export function videoPosterUrl(url: string): string {
  const framed = withTransform(url, "so_0,f_auto,q_auto,w_600,h_600,c_fill");
  return framed.replace(/\.(mp4|webm|mov)$/i, ".jpg");
}

/** A 1200×630 social-preview (Open Graph / Twitter) derivative of a product
 * image — the standard OG card ratio, centre-cropped with smart gravity. */
export function ogImageUrl(url: string): string {
  return withTransform(url, "f_auto,q_auto,w_1200,h_630,c_fill,g_auto");
}
