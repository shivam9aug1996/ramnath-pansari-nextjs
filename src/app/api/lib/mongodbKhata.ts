import { MongoClient, MongoClientOptions } from "mongodb";
import { dbUrlKhata } from "./keys";
if (!dbUrlKhata) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}
const uri = dbUrlKhata;
const options: MongoClientOptions = {
  appName: "ramnath-pansari-khata",
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
};
declare global {
  var _mongoClientKhataPromise: Promise<MongoClient> | undefined;
}
let clientKhataPromise: Promise<MongoClient>;
if (!global._mongoClientKhataPromise) {
  const client = new MongoClient(uri, options);
  global._mongoClientKhataPromise = client.connect();
}
clientKhataPromise = global._mongoClientKhataPromise;
export default clientKhataPromise;
