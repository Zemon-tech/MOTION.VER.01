import { z } from 'zod'

// Tiptap document root — must have type: "doc", everything else is passthrough
const tiptapDocSchema = z
  .object({ type: z.literal('doc', { errorMap: () => ({ message: 'Content must be a valid document' }) }) })
  .passthrough()

export const createPageSchema = z.object({
  title: z
    .string()
    .min(1,   'Title cannot be empty')
    .max(256, 'Title must be no more than 256 characters')
    .optional(),

  content: tiptapDocSchema.optional(),
})

export const createSubpageSchema = z.object({
  title: z
    .string()
    .min(1,   'Title cannot be empty')
    .max(256, 'Title must be no more than 256 characters')
    .optional(),
})

export const updatePageSchema = z.object({
  title: z
    .string()
    .min(1,   'Title cannot be empty')
    .max(256, 'Title must be no more than 256 characters')
    .optional(),

  content: tiptapDocSchema.optional(),

  coverImageUrl: z
    .string()
    .url('Cover image must be a valid URL')
    .nullable()
    .optional(),

  coverPosition: z
    .number()
    .min(0,   'Cover position must be between 0 and 100')
    .max(100, 'Cover position must be between 0 and 100')
    .optional(),

  icon: z.string().nullable().optional(),
})

export const updatePrivacySchema = z.object({
  isPublic: z.boolean({ required_error: 'isPublic is required', invalid_type_error: 'isPublic must be true or false' }),

  linkEditEnabled: z
    .boolean({ invalid_type_error: 'linkEditEnabled must be true or false' })
    .optional(),

  linkExpiresAt: z
    .string()
    .datetime({ message: 'linkExpiresAt must be a valid ISO 8601 date-time' })
    .nullable()
    .optional(),

  rotateToken: z
    .boolean({ invalid_type_error: 'rotateToken must be true or false' })
    .optional(),
})

export const shareSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .min(1, 'userId cannot be empty'),

  action: z.enum(['add', 'remove'], {
    errorMap: () => ({ message: "action must be 'add' or 'remove'" }),
  }),
})

export const updateLockSchema = z.object({
  locked: z.boolean({ required_error: 'locked is required', invalid_type_error: 'locked must be true or false' }),

  password: z
    .string()
    .min(4,   'Lock password must be at least 4 characters')
    .max(128, 'Lock password must be no more than 128 characters')
    .optional(),
})

export const verifyLockSchema = z.object({
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
})
