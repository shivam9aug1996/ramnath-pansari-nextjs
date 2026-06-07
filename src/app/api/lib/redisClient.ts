import { createClient } from "redis";
type RedisInstance = ReturnType<typeof createClient>;
class RedisClient {
  private static instance: RedisInstance | null = null;
  private constructor() {}
  public static async getInstance(): Promise<RedisInstance> {
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
    await client.flushAll();
  }
  public static async getKeys(pattern = "*"): Promise<string[]> {
    const client = await RedisClient.getInstance();
    const keys = await client.keys(pattern);
    return keys;
  }
}
export default RedisClient;
