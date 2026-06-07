"use server";

import clientPromise from "./api/lib/mongodb";

export async function testDatabaseConnection() {
  let isConnected = false;
  try {
    const mongoClient = await clientPromise;

    await mongoClient.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
    return !isConnected;
  } catch (e) {
    console.error(e);
    return isConnected;
  }
}
