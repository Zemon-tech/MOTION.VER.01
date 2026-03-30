import mongoose from "mongoose";

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  mongoose.set("strictQuery", true);
  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
}
