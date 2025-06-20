import { createClient, RedisClientType } from "redis";
import { redisPassword } from "./keys";

const redisConfig = {
  username: "default",
  password: redisPassword,
  socket: {
    host: "redis-12651.c9.us-east-1-2.ec2.redns.redis-cloud.com",
    port: 12651,
  },
};

let redisClient: RedisClientType;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable to preserve the client
  // across module reloads caused by HMR (Hot Module Replacement).
  let globalWithRedis = global as typeof globalThis & {
    _redisClient?: RedisClientType;
  };

  if (!globalWithRedis._redisClient) {
    globalWithRedis._redisClient = createClient(redisConfig);
    globalWithRedis._redisClient.connect().catch((err) => {
      console.error("Redis connection error (dev):", err);
    });
  }
  redisClient = globalWithRedis._redisClient;
} else {
  // In production, avoid using global variables.
  redisClient = createClient(redisConfig);
  redisClient.connect().catch((err) => {
    console.error("Redis connection error (prod):", err);
  });
}

// Handle Redis client errors globally
redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

export default redisClient;
