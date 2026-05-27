import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface PdfJobData {
  assignmentId: string;
}

export const pdfQueue = new Queue<PdfJobData>("pdf-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

console.log("📄 PDF queue initialized");