// Product specifications shape + normalizer (Phase E.4 Part B).
//
// Specs are stored as an ORDERED array of { label, value } in Product.specifications
// (Json). jsonb preserves array element order, which fixes the B.2 issue where an
// object's key order was not preserved by Postgres.
//
// normalizeSpecs is tolerant: it accepts the array shape, and — defensively —
// converts a legacy object ({ "Voice AI": "…", … }) into the array shape, so
// stray old data never breaks a render. Anything else yields an empty list.

export type ProductSpec = { label: string; value: string };

function isSpec(value: unknown): value is ProductSpec {
  return (
    typeof value === "object" &&
    value !== null &&
    "label" in value &&
    "value" in value
  );
}

export function normalizeSpecs(specifications: unknown): ProductSpec[] {
  if (Array.isArray(specifications)) {
    return specifications
      .filter(isSpec)
      .map((spec) => ({ label: String(spec.label), value: String(spec.value) }));
  }
  // Legacy object shape → array, preserving whatever order Postgres returns.
  if (typeof specifications === "object" && specifications !== null) {
    return Object.entries(specifications).map(([label, value]) => ({
      label,
      value: String(value),
    }));
  }
  return [];
}
