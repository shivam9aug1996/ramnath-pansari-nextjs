


import { createClient } from "redis";

let redis;

if (!global.redisClient) {
  global.redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  global.redisClient.connect().catch(console.error);
}

redis = global.redisClient;
console.log("redis", redis);

export default redis;
