import type { Db, MongoClient, ClientSession } from "mongodb";
import type { NextRequest } from "next/server";
import { MongoClient as MongoClientClass } from "mongodb";
import { dbUrl } from "./keys";
import AsyncLock from "async-lock";
let cachedClient: MongoClient | undefined;
let db: Db | undefined;
let cachedSession: ClientSession | undefined;
const uri = dbUrl;
const lock = new AsyncLock();
export const connectDB = async (
  _req?: NextRequest,
): Promise<Db | undefined> => {
  console.log("`kjhtrer567890`-", _req?.url, _req?.method);
  try {
    console.log("123456789 connectDB starting");
    const client = await lock.acquire("connection", async () => {
      if (!cachedClient) {
        cachedClient = await connectCluster();
      }
      return cachedClient;
    });
    console.log(
      "123456789 client id",
      (
        client as MongoClient & {
          topology?: {
            s?: {
              id?: unknown;
            };
          };
        }
      ).topology?.s?.id,
    );
    const res = client ? await connectDatabase(client) : undefined;
    console.log("123456789 connectDB started");
    return res;
  } catch (error) {
    console.log("123456789 error in connectDB");
  }
};
const connectCluster = async (): Promise<MongoClient | undefined> => {
  if (cachedClient) {
    console.log("123456789 client already connected");
    return cachedClient;
  }
  const client = new MongoClientClass(uri);
  try {
    console.log("123456789 client connecting");
    await client.connect();
    db = undefined;
    console.log("123456789 client connected");
    cachedClient = client;
    return client;
  } catch (error) {
    console.log("123456789 error in connectCluster");
  }
};
const connectDatabase = async (
  client: MongoClient,
): Promise<Db | undefined> => {
  try {
    if (db) {
      return db;
    } else {
      if (client?.db) {
        console.log("123456789 db connecting");
        db = client.db("basic-crud");
        console.log("123456789 db connected");
        return db;
      } else {
        console.log("123456789 error in connectDatabase");
      }
    }
  } catch (error) {
    console.log(error);
  }
};
export const getClient = async (): Promise<MongoClient | undefined> => {
  return cachedClient;
};
export const startSession = async (): Promise<ClientSession | undefined> => {
  try {
    if (cachedSession) {
      return cachedSession;
    } else {
      if (cachedClient) {
        cachedSession = cachedClient.startSession();
        return cachedSession;
      }
    }
  } catch (error) {
    console.error(error);
  }
};
export const startTransaction = async (
  client: MongoClient,
): Promise<ClientSession | undefined> => {
  try {
    const session = client.startSession();
    console.log("123456789 session started");
    try {
      await session?.startTransaction();
      console.log("123456789 transaction started");
      return session;
    } catch (error) {
      console.log("123456789 error startTransaction", error);
    }
  } catch (error) {
    console.log("123456789 error startSession", error);
  }
};
export const abortTransaction = async (
  session: ClientSession,
): Promise<void> => {
  try {
    await session.abortTransaction();
    console.log("123456789 transaction aborted");
    try {
      await session?.endSession();
      console.log("123456789 session closed");
    } catch (error) {
      console.log("123456789 error endSession", error);
    }
  } catch (error) {
    console.log("123456789 error abortTransaction", error);
  }
};
export const commitTransaction = async (
  session: ClientSession,
): Promise<void> => {
  try {
    await session.commitTransaction();
    console.log("123456789 transaction committed");
    try {
      await session?.endSession();
      console.log("123456789 session closed");
    } catch (error) {
      console.log("123456789 error endSession", error);
    }
  } catch (error) {
    console.log("123456789 error commitTransaction", error);
  }
};
