import { ObjectId } from "mongodb";
import { connectDB } from "./app/api/lib/dbconnection";

async function setCache(cacheId: string, data: unknown) {
  const db = await connectDB();
  const createdAt = new Date();

  try {
    const cacheData = await db.collection("cache").findOne({ cacheId });

    if (cacheData) {
      const updatedResult = await db
        .collection("cache")
        .updateOne({ _id: cacheData?._id }, { $set: { data } });
      return {
        message: "Cache updated successfully",
        data: updatedResult,
      };
    }

    const result = await db.collection("cache").insertOne({ cacheId, data });
    return {
      message: "Cache created successfully",
      data: {
        _id: new ObjectId(result?.insertedId),
        cacheId,
        data,
        createdAt,
      },
    };
  } catch {
    throw new Error("Something went wrong");
  }
}

async function getCache(cacheId: string) {
  const db = await connectDB();

  try {
    const cacheData = await db.collection("cache").findOne({ cacheId });
    if (!cacheData) return null;
    return { data: cacheData };
  } catch {
    throw new Error("Something went wrong");
  }
}

async function deleteCache(cacheId: string) {
  const db = await connectDB();

  try {
    const cacheData = await db.collection("cache").findOne({ cacheId });
    if (cacheData) {
      await db.collection("cache").deleteOne({ cacheId });
    }
    return { message: "Deleted successfully" };
  } catch {
    throw new Error("Something went wrong");
  }
}

export { setCache, getCache, deleteCache };
