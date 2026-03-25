import { z } from 'zod'

const tiptapDocSchema = z.object({
  type: z.literal('doc'),
}).passthrough()

export const createPageSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  content: tiptapDocSchema.optional(),
})

export const createSubpageSchema = z.object({
  title: z.string().min(1).max(256).optional(),
})

export const updatePageSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  content: tiptapDocSchema.optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  coverPosition: z.number().min(0).max(100).optional(),
  icon: z.string().nullable().optional(),
})

export const updatePrivacySchema = z.object({
  isPublic: z.boolean(),
  linkEditEnabled: z.boolean().optional(),
  linkExpiresAt: z.string().datetime().nullable().optional(),
  rotateToken: z.boolean().optional(),
})

export const shareSchema = z.object({
  userId: z.string(),
  action: z.enum(['add', 'remove']),
})

export const updateLockSchema = z.object({
  locked: z.boolean(),
  password: z.string().min(4).max(128).optional(),
})

export const verifyLockSchema = z.object({
  password: z.string().min(1),
})


