import { ObjectId } from "mongodb";
import { connectDB } from "./app/api/lib/dbconnection";

async function setCache(cacheId, data) {
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
    } else {
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
    }
  } catch (error) {
    throw new Error("Something went wrong");
  }
}

async function getCache(cacheId) {
  const db = await connectDB();

  try {
    const cacheData = await db.collection("cache").findOne({ cacheId });

    if (!cacheData) {
      return null;
    }

    return { data: cacheData };
  } catch (error) {
    throw new Error("Something went wrong");
  }
}

async function deleteCache(cacheId) {
  const db = await connectDB();

  try {
    const cacheData = await db.collection("cache").findOne({ cacheId });

    if (cacheData) {
      const deleteCustomerResult = await db
        .collection("cache")
        .deleteOne({ cacheId });
    }

    return { message: "Deleted successfully" };
  } catch (error) {
    throw new Error("Something went wrong");
  }
}

export { setCache, getCache, deleteCache };
