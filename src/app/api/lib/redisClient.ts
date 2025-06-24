import { createClient, RedisClientType } from "redis";

class RedisClient {
  private static instance: RedisClientType | null = null;

  private constructor() {}

  public static async getInstance(): Promise<RedisClientType> {
    if (!RedisClient.instance) {
      const client = createClient({
        url: process.env.REDIS_URL,
      });

      client.on("error", (err) => console.error("Redis Client Error", err));

      await client.connect();
      RedisClient.instance = client;
    }

    return RedisClient.instance;
  }
}

export default RedisClient;
