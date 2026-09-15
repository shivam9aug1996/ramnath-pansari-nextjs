import { createClient } from "redis";
import { logError } from "./logger";

type RedisInstance = ReturnType<typeof createClient>;

const RETRY_AFTER_MS = 30_000;

class RedisClient {
  private static instance: RedisInstance | null = null;
  private static connectPromise: Promise<RedisInstance> | null = null;
  private static unavailableUntil = 0;
  private static hasLoggedError = false;

  private constructor() {}

  public static async getInstance(): Promise<RedisInstance> {
    if (RedisClient.instance?.isOpen) {
      return RedisClient.instance;
    }

    RedisClient.instance = null;

    if (Date.now() < RedisClient.unavailableUntil) {
      throw new Error("Redis is unavailable");
    }

    if (!RedisClient.connectPromise) {
      RedisClient.connectPromise = RedisClient.connect().finally(() => {
        RedisClient.connectPromise = null;
      });
    }

    return RedisClient.connectPromise;
  }

  private static async connect(): Promise<RedisInstance> {
    const url = process.env.REDIS_URL;
    if (!url) {
      RedisClient.markUnavailable("REDIS_URL is not set");
      throw new Error("REDIS_URL is not set");
    }

    const client = createClient({
      url,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy: false,
      },
    });

    client.on("error", (err) => {
      if (RedisClient.hasLoggedError) return;
      RedisClient.hasLoggedError = true;
      logError("Redis Client Error", err);
    });

    try {
      await client.connect();
      RedisClient.instance = client;
      RedisClient.hasLoggedError = false;
      RedisClient.unavailableUntil = 0;
      return client;
    } catch (error) {
      RedisClient.markUnavailable("Redis connect failed");
      try {
        await client.disconnect();
      } catch {
        // ignore cleanup errors
      }
      throw error;
    }
  }

  private static markUnavailable(message: string) {
    RedisClient.unavailableUntil = Date.now() + RETRY_AFTER_MS;
    if (!RedisClient.hasLoggedError) {
      RedisClient.hasLoggedError = true;
      logError(`[redis] ${message}; retrying after 30s`);
    }
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
