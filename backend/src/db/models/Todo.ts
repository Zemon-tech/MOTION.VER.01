import mongoose, { Schema, Document } from 'mongoose'

export interface ITodo extends Document {
  userId: mongoose.Types.ObjectId
  title: string
  completed: boolean
  date: Date // The date this todo belongs to (YYYY-MM-DD or full date)
  createdAt: Date
  updatedAt: Date
}

const TodoSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    date: { type: Date, required: true },
  },
  { timestamps: true }
)

// Add index for fast querying by user and date
TodoSchema.index({ userId: 1, date: 1 })

export const Todo = mongoose.model<ITodo>('Todo', TodoSchema)
