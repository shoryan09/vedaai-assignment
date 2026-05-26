import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface GenerationJobData {
  assignmentId: string;
  title: string;
  questionTypes: { type: string; count: number; marks: number }[];
  additionalInstructions?: string;
  fileContent?: string;
}

export const generationQueue = new Queue<GenerationJobData>("question-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

console.log("📋 Generation queue initialized");