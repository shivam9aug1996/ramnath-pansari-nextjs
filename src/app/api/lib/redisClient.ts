// lib/redisClient.js
import { createClient } from "redis";

const client = createClient({
  password: "EbiwLsq1KpdtlbAF6gzyM2u3bRZ3hgI1",
  socket: {
    host: "redis-19172.c264.ap-south-1-1.ec2.redns.redis-cloud.com",
    port: 19172,
  },
});

client.on("error", (err) => console.log("Redis Client Error", err));

// (async () => {
//   await client.connect();
// })();

export default client;
