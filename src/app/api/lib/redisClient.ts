// // lib/redisClient.js
// import { createClient } from "redis";

// const client = createClient({
//   username: "default",
//   password: "KnYi2Gx6q4DEVS9z5oiWyndB0arypx3U",
//   socket: {
//     host: "redis-14603.c261.us-east-1-4.ec2.redns.redis-cloud.com",
//     port: 14603,
//   },
// });

// client.on("error", (err) => console.log("Redis Client Error", err));

// export default client;

import { createClient, RedisClientType } from "redis";

const redisConfig = {
  username: "default",
  password: "KnYi2Gx6q4DEVS9z5oiWyndB0arypx3U",
  socket: {
    host: "redis-14603.c261.us-east-1-4.ec2.redns.redis-cloud.com",
    port: 14603,
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
