import { Worker } from "bullmq";
import dotenv from "dotenv";
import { redisConnection } from "../config/redis";
import { connectDB } from "../config/db";
import Assignment from "../models/Assignment";
import { generateQuestionPaper } from "../services/llm";
import { GenerationJobData } from "../queues/generationQueue";
import { io } from "../index";

dotenv.config();

const startWorker = async () => {
  await connectDB();
  console.log("👷 Worker booting...");

  const worker = new Worker<GenerationJobData>(
    "question-generation",
    async (job) => {
      const { assignmentId, ...input } = job.data;
      console.log(`▶️  Processing job ${job.id} for assignment ${assignmentId}`);

      try {
        await Assignment.findByIdAndUpdate(assignmentId, { status: "processing" });
        io.to(`job:${job.id}`).emit("job:progress", { status: "processing", progress: 20 });

        const paper = await generateQuestionPaper(input);

        io.to(`job:${job.id}`).emit("job:progress", { status: "processing", progress: 80 });

        await Assignment.findByIdAndUpdate(assignmentId, {
          status: "completed",
          generatedPaper: paper,
        });

        io.to(`job:${job.id}`).emit("job:complete", { assignmentId, paper });
        console.log(`✅ Completed job ${job.id}`);

        return { assignmentId, paper };
      } catch (err: any) {
        console.error(`❌ Job ${job.id} failed:`, err.message);
        await Assignment.findByIdAndUpdate(assignmentId, { status: "failed" });
        io.to(`job:${job.id}`).emit("job:failed", { error: err.message });
        throw err;
      }
    },
    { connection: redisConnection, concurrency: 2 }
  );

  worker.on("ready", () => console.log("✅ Worker ready, listening for jobs"));
  worker.on("error", (err) => console.error("Worker error:", err));
};

startWorker();