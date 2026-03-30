import { Schema, model } from 'mongoose'

const googleEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  googleId: { type: String, required: true, unique: true },
  summary: String,
  description: String,
  start: Date,
  end: Date,
  htmlLink: String,
  status: String,
}, { timestamps: true })

const googleMessageSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  googleId: { type: String, required: true, unique: true },
  threadId: String,
  snippet: String,
  subject: String,
  from: String,
  date: Date,
}, { timestamps: true })

export const GoogleEvent = model('GoogleEvent', googleEventSchema)
export const GoogleMessage = model('GoogleMessage', googleMessageSchema)
