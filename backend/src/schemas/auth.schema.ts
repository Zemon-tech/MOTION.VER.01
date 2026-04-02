import { z } from 'zod'

export const signupSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address')
    .max(254, 'Email address is too long'),

  password: z
    .string({ required_error: 'Password is required' })
    .min(8,   'Password must be at least 8 characters')
    .max(128, 'Password must be no more than 128 characters'),

  name: z
    .string()
    .min(1,  'Name cannot be empty')
    .max(80, 'Name must be no more than 80 characters')
    .optional(),
})

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address'),

  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
})

export const refreshSchema = z.object({
  // refresh token comes from httpOnly cookie, not body — schema is a no-op placeholder
  // kept here so the validate middleware pattern is consistent if ever needed
})
