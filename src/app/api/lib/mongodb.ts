import { MongoClient, MongoClientOptions } from "mongodb";
import { dbUrl } from "./keys";

if (!dbUrl) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = dbUrl;

const options: MongoClientOptions = {
  appName: "ramnath-pansari",
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 30_000,
  serverSelectionTimeoutMS: 5_000,
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise;

export default clientPromise;
