import { dbUrl } from "./keys";
import AsyncLock from "async-lock";

import client from "./mongodb";

const uri = dbUrl;

const lock = new AsyncLock();

export const connectDB = async (req) => {
  try {
    const mongoClient = await client.connect();
    const db = await mongoClient.db("basic-crud");
    return db;
  } catch (error) {
    console.log("error");
  }
};

export const getClient = async () => {
  return client;
};

export const startSession = async () => {
  try {
    let cachedSession = client.startSession();
    return cachedSession;
  } catch (error) {
    console.error("uytfdfghjkl", error);
  }
};

export const startTransaction = async (client) => {
  try {
    const session = await client.startSession();
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

export const abortTransaction = async (session) => {
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

export const commitTransaction = async (session) => {
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
