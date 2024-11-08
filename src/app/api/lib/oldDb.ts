import { isTokenVerified } from "@/json";
import { MongoClient } from "mongodb";
import { dbUrl } from "./keys";
import AsyncLock from "async-lock";
import { NextResponse } from "next/server";

let cachedClient;
let db;
let cachedSession;
const uri = dbUrl;

const lock = new AsyncLock();

export const connectDB = async (req) => {
  console.log("`kjhtrer567890`-", req?.url, req?.method);
  try {
    // let isToken;
    // if (req) {
    //   isToken = await isTokenVerified(req);
    //   console.log("8765redfghjkl", isToken);
    //   if (!isToken) {
    //     return "401";
    //   }
    // }
    console.log("123456789 connectDB starting");

    const client = await lock.acquire("connection", async () => {
      if (!cachedClient) {
        cachedClient = await connectCluster();
      }
      return cachedClient;
    });

    console.log("123456789 client id", client.topology.s.id);
    const res = await connectDatabase(client);
    console.log("123456789 connectDB started");
    return res;
  } catch (error) {
    console.log("123456789 error in connectDB");
    // throw error;
  }
};

const connectCluster = async () => {
  if (cachedClient) {
    console.log("123456789 client already connected");
    return cachedClient;
  }

  const client = new MongoClient(uri, {
    // useNewUrlParser: false,
    // useUnifiedTopology: true,
  });

  try {
    console.log("123456789 client connecting");
    await client.connect();
    db = null;
    console.log("123456789 client connected");
    cachedClient = client;
    return client;
  } catch (error) {
    console.log("123456789 error in connectCluster");
    // throw error;
  }
};

const connectDatabase = async (client) => {
  try {
    if (db) {
      return db;
    } else {
      if (client?.db) {
        console.log("123456789 db connecting");
        db = await client.db("basic-crud");
        // await db.collection("products").createIndex({ name: "text" });
        console.log("123456789 db connected");
        return db;
      } else {
        console.log("123456789 error in connectDatabase");
        // throw new Error("MongoDB client not connected.");
      }
    }
  } catch (error) {
    console.log(error);
    // throw error;
  }
};

export const getClient = async () => {
  return cachedClient;
};

export const startSession = async () => {
  try {
    if (cachedSession) {
      return cachedSession;
    } else {
      if (cachedClient) {
        cachedSession = cachedClient.startSession();
        return cachedSession;
      } else {
        // throw new Error("MongoDB client not connected.");
      }
    }
  } catch (error) {
    console.error(error);
    // throw error;
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
      //  throw error;
    }
  } catch (error) {
    console.log("123456789 error startSession", error);
    //throw error;
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
    //throw error;
  }
};
