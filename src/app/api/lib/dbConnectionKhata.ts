import type { Db, MongoClient, ClientSession } from "mongodb";
import getKhataClientPromise from "./mongodbKhata";
import { log, logError } from "./logger";
const DB_NAME = "basic-crud";
let cachedDb: Db | null = null;
export const connectDB = async (_req?: unknown): Promise<Db> => {
  if (cachedDb) {
    log("cachedDb khata", cachedDb);
    return cachedDb;
  }
  try {
    const client = await getKhataClientPromise();
    cachedDb = client.db(DB_NAME);
    return cachedDb;
  } catch (error) {
    cachedDb = null;
    logError("connectDB khata failed", error);
    throw error;
  }
};
export const getClient = async (): Promise<MongoClient> => {
  return getKhataClientPromise();
};
export const startSession = async () => {
  try {
    const client = await getClient();
    return client.startSession();
  } catch (error) {
    logError("startSession khata failed", error);
    throw error;
  }
};
export const startTransaction = async (client: MongoClient) => {
  try {
    const session = client.startSession();
    log("session started");
    try {
      await session.startTransaction();
      log("transaction started");
      return session;
    } catch (error) {
      logError("startTransaction khata failed", error);
      throw error;
    }
  } catch (error) {
    logError("startSession khata failed", error);
    throw error;
  }
};
export const abortTransaction = async (session: ClientSession) => {
  try {
    await session.abortTransaction();
    log("transaction aborted");
    try {
      await session?.endSession();
      log("session closed");
    } catch (error) {
      logError("endSession khata failed", error);
    }
  } catch (error) {
    logError("abortTransaction khata failed", error);
  }
};
export const commitTransaction = async (session: ClientSession) => {
  try {
    await session.commitTransaction();
    log("transaction committed");
    try {
      await session?.endSession();
      log("session closed");
    } catch (error) {
      logError("endSession khata failed", error);
    }
  } catch (error) {
    logError("commitTransaction khata failed", error);
  }
};
