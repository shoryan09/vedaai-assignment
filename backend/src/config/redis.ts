import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

console.log("🔍 REDIS_URL from env:", process.env.REDIS_URL ? `${process.env.REDIS_URL.substring(0, 30)}...` : "UNDEFINED");

export const redisConnection = new IORedis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on("connect", () => console.log("✅ Redis connected"));
redisConnection.on("error", (err) => console.error("❌ Redis error:", err.message));