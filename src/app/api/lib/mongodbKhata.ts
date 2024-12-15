import { MongoClient } from "mongodb";
import { dbUrlKhata } from "./keys";

if (!dbUrlKhata) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = dbUrlKhata;
const options = { appName: "devrel.template.nextjs" };

let client1: MongoClient;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo1 = global as typeof globalThis & {
    _mongoClient1?: MongoClient;
  };

  if (!globalWithMongo1._mongoClient1) {
    globalWithMongo1._mongoClient1 = new MongoClient(uri, options);
  }
  client1 = globalWithMongo1._mongoClient1;
} else {
  // In production mode, it's best to not use a global variable.
  client1 = new MongoClient(uri, options);
}

// Export a module-scoped MongoClient. By doing this in a
// separate module, the client can be shared across functions.

export default client1;
