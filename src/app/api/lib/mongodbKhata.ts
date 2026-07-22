import { MongoClient, MongoClientOptions } from "mongodb";
import { dbUrlKhata } from "./keys";

if (!dbUrlKhata) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = dbUrlKhata;

const options: MongoClientOptions = {
  appName: "ramnath-pansari-khata",
  maxPoolSize: 1,
  minPoolSize: 0,
  maxIdleTimeMS: 10_000,
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 10_000,
};

declare global {
  var _mongoClientKhataPromise: Promise<MongoClient> | undefined;
}

export function getKhataClientPromise(): Promise<MongoClient> {
  if (!global._mongoClientKhataPromise) {
    const client = new MongoClient(uri, options);
    const promise = client.connect();

    promise.catch(() => {
      if (global._mongoClientKhataPromise === promise) {
        global._mongoClientKhataPromise = undefined;
      }
    });

    global._mongoClientKhataPromise = promise;
  }

  return global._mongoClientKhataPromise;
}

export default getKhataClientPromise;
