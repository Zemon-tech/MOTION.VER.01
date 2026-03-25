import { Schema, model, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    avatarUrl: { type: String },
    settings: {
      theme: { type: String, enum: ['light', 'dark'], required: false },
    },
    recentVisited: [
      new Schema(
        {
          slug: { type: String, required: true },
          ts: { type: Date, required: true },
        },
        { _id: false }
      ),
    ],
    sharedLinks: [
      new Schema(
        {
          pageId: { type: Schema.Types.ObjectId, ref: 'Page', required: true },
          slug: { type: String, required: true },
          token: { type: String, required: true },
          title: { type: String, required: true },
          ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          ownerName: { type: String },
          addedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
    ],
    sharedBlocked: [
      new Schema(
        {
          pageId: { type: Schema.Types.ObjectId, ref: 'Page', required: true },
          token: { type: String },
          blockedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
    ],
  },
  { timestamps: true }
)

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId }

export const User = model('User', userSchema)


