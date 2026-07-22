import { MongoClient, MongoClientOptions } from "mongodb";
import { dbUrl } from "./keys";

if (!dbUrl) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = dbUrl;

// Serverless-friendly pool: reuse across warm invocations, avoid large idle pools.
const options: MongoClientOptions = {
  appName: "ramnath-pansari",
  maxPoolSize: 1,
  minPoolSize: 0,
  maxIdleTimeMS: 10_000,
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 10_000,
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Lazily connect and cache the promise on `global` so warm serverless
 * invocations reuse the client. On failure, clear the cache so the next
 * request can reconnect instead of reusing a rejected promise.
 */
export function getClientPromise(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    const promise = client.connect();

    // Mark rejection handled (avoids process crash) and allow retry next time.
    promise.catch(() => {
      if (global._mongoClientPromise === promise) {
        global._mongoClientPromise = undefined;
      }
    });

    global._mongoClientPromise = promise;
  }

  return global._mongoClientPromise;
}

export default getClientPromise;
