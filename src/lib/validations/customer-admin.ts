// Zod validation for admin customer management (Phase E.4 Part C). System
// boundary — admin input validated here before the service writes it.

import { z } from "zod";

export const addNoteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Note can't be empty")
    .max(2000, "Note must be 2000 characters or fewer"),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type SetActiveInput = z.infer<typeof setActiveSchema>;
