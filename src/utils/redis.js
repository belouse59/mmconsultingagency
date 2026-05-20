/**
 * utils/redis.js
 */
"use strict";

const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.UPSTASH_REDIS_URL,
});

redisClient.on("error", (err) => {
  console.error("[redis]", err);
});

let connected = false;

async function connectRedis() {
  if (connected) return redisClient;

  await redisClient.connect();
  connected = true;

  console.log("[redis] connected");

  return redisClient;
}

module.exports = {
  redisClient,
  connectRedis,
};