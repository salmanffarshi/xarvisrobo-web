// Zod validation for admin product management (Phase E.4 Part B). System
// boundary — admin input validated here before the service writes it. Money is
// a decimal string on the wire (ADR-005 convention: "2999.00"); the slug is
// derived from the name server-side (not accepted from the client).

import { z } from "zod";

/** A non-negative money amount as a 2dp-or-less decimal string, e.g. "2999.00". */
const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount, e.g. 2999.00");

/** One ordered spec row. Order is preserved (array), fixing the B.2 issue. */
const specSchema = z.object({
  label: z.string().trim().min(1, "Label required").max(60),
  value: z.string().trim().min(1, "Value required").max(300),
});

/** One ordered feature highlight (Phase H #6). Title required; description
 * optional (may be empty). Order = array order. */
const featureSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(80),
  description: z.string().trim().max(300),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  sku: z.string().trim().min(2, "SKU must be at least 2 characters").max(40),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().trim().min(1, "Description is required"),
  categoryId: z.string().cuid("Select a category"),
  basePrice: moneyString,
  stockQuantity: z.number().int().min(0, "Cannot be negative"),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  specifications: z.array(specSchema).optional(),
  features: z.array(featureSchema).max(12, "Up to 12 features").optional(),
  metaTitle: z.string().trim().max(120).optional(),
  metaDescription: z.string().trim().max(300).optional(),
});

// All fields optional on update; the service only touches what is provided.
export const updateProductSchema = createProductSchema.partial();

/** Add-image payload. */
export const addImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().trim().max(200).optional(),
});

/** Image update: set primary and/or a new sort order. */
export const updateImageSchema = z.object({
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AddImageInput = z.infer<typeof addImageSchema>;
export type UpdateImageInput = z.infer<typeof updateImageSchema>;
