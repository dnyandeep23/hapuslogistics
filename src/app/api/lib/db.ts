import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const globalCache = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached = globalCache.mongooseCache ?? { conn: null, promise: null };
globalCache.mongooseCache = cached;

export async function dbConnect(): Promise<typeof mongoose> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return mongoose;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(databaseUrl, {
      serverSelectionTimeoutMS: 10000,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
