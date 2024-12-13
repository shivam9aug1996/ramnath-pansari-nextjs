// lib/redisClient.js
import { createClient } from "redis";

// const client = createClient({
//   password: "EbiwLsq1KpdtlbAF6gzyM2u3bRZ3hgI1",
//   socket: {
//     host: "redis-19172.c264.ap-south-1-1.ec2.redns.redis-cloud.com",
//     port: 19172,
//   },
// });
const client = createClient({
  username: "default",
  password: "KnYi2Gx6q4DEVS9z5oiWyndB0arypx3U",
  socket: {
    host: "redis-14603.c261.us-east-1-4.ec2.redns.redis-cloud.com",
    port: 14603,
  },
});

client.on("error", (err) => console.log("Redis Client Error", err));

// (async () => {
//   await client.connect();
// })();

export default client;
