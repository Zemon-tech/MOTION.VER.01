import { Schema, model, type InferSchemaType } from 'mongoose'

const pageSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, default: 'Untitled', maxlength: 256 },
    slug: { type: String, required: true, unique: true, index: true },
    content: { type: Schema.Types.Mixed, required: true },
    isPublic: { type: Boolean, default: false, index: true },
    shareToken: { type: String, index: true },
    linkEditEnabled: { type: Boolean, default: false },
    linkExpiresAt: { type: Date, default: null },
    sharedWith: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    collaborators: [
      new Schema(
        {
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
        },
        { _id: false }
      ),
    ],
    favoritedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    tags: [{ type: String }],
    icon: { type: String },
    coverImageUrl: { type: String },
    coverPosition: { type: Number, default: 50 },
    // Hierarchy
    parentId: { type: Schema.Types.ObjectId, ref: 'Page', default: null, index: true },
    ancestors: [{ type: Schema.Types.ObjectId, ref: 'Page', index: true }],
    locked: { type: Boolean, default: false, index: true },
    lockPasswordHash: { type: String, default: undefined },
  },
  { timestamps: true }
)

pageSchema.index({ title: 'text' })

export type PageDocument = InferSchemaType<typeof pageSchema> & { _id: Schema.Types.ObjectId }

export const Page = model('Page', pageSchema)


