// URL slug helpers (Phase E.4 Part B). Product and Category slugs are derived
// from the name and must be unique. `slugify` is the pure transform; the
// services use `uniqueSlug` to resolve collisions by appending -2, -3, …

/** "Xarvis D1 (Pro)" → "xarvis-d1-pro". Empty input → "item". */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "item";
}

/**
 * A unique slug derived from `name`. `exists` reports whether a candidate is
 * already taken (the caller queries the right table, excluding the row being
 * updated). Tries the bare slug first, then -2, -3, … until one is free.
 */
export async function uniqueSlug(
  name: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}
