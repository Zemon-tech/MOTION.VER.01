import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(128, "Password must be at most 128 characters long.")
  .regex(/[a-z]/, "Password must include at least one lowercase letter.")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
  .regex(/\d/, "Password must include at least one digit.")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must include at least one special character.",
  );

export const signupSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required.").max(128),
});
