// Custom next/image loader — wired globally via next.config.ts `images.loaderFile`.
//
// It emits Cloudinary delivery transforms (f_auto,q_auto,w_<width>) so the
// srcset next/image generates points straight at Cloudinary-optimized
// derivatives (auto format → WebP/AVIF, auto quality, resized to the exact
// width the device needs). next/image handles the srcset + lazy-loading +
// sizing; Cloudinary does the actual optimization.
//
// Why a custom loader instead of the default one: the default Next loader would
// route these URLs through Vercel's METERED image optimizer to re-optimize what
// Cloudinary already optimizes (ADR-010) — billed and redundant. This loader
// bypasses that entirely; Vercel's optimizer is never touched.
//
// `quality` is intentionally delegated to Cloudinary's `q_auto` (smart,
// per-image quality — the same convention as src/lib/cloudinary-url.ts) rather
// than a fixed number, so the numeric quality next/image passes is ignored.
//
// Non-Cloudinary or unrecognized URLs (e.g. a future local/static asset) pass
// through unchanged, so this is safe as the app-wide loader.

type CloudinaryLoaderArgs = {
  src: string;
  width: number;
  quality?: number;
};

export default function cloudinaryLoader({
  src,
  width,
}: CloudinaryLoaderArgs): string {
  const transform = `f_auto,q_auto,w_${width}`;
  return src.includes("/upload/")
    ? src.replace("/upload/", `/upload/${transform}/`)
    : src;
}
