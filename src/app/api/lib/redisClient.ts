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

  public static async flushAll(): Promise<void> {
    const client = await RedisClient.getInstance();
    await client.flushAll(); // Removes all keys from all databases
  }

  public static async getKeys(pattern = "*"): Promise<string[]> {
    const client = await RedisClient.getInstance();
    const keys = await client.keys(pattern); // WARNING: keys * is expensive in production
    return keys;
  }
}

export default RedisClient;
