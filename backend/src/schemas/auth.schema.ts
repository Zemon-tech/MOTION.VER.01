import { z } from 'zod'

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})


