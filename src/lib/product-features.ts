// Product features shape + normalizer (Phase H #6).
//
// Features are stored as an ORDERED array of { title, description } in
// Product.features (Json) — the same ordered-array-in-Json pattern as
// specifications (E.4). Array element order is the display order.
//
// normalizeFeatures is tolerant: it accepts the array shape and coerces each
// entry's fields to strings, so stray/legacy data never breaks a render.
// Anything else (null, object, etc.) yields an empty list. description may be
// an empty string.

export type ProductFeature = { title: string; description: string };

function isFeature(value: unknown): value is ProductFeature {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    "description" in value
  );
}

export function normalizeFeatures(features: unknown): ProductFeature[] {
  if (!Array.isArray(features)) return [];
  return features.filter(isFeature).map((feature) => ({
    title: String(feature.title),
    description: String(feature.description),
  }));
}
