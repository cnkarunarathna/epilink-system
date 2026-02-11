/**
 * Form validation utilities using Zod
 */

import { z } from "zod";

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Evidence upload validation schema
 */
export const evidenceSchema = z.object({
  notes: z
    .string()
    .max(1000, "Notes must be less than 1000 characters")
    .optional(),
});

export type EvidenceFormData = z.infer<typeof evidenceSchema>;

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success;
};
