import { Worker } from "bullmq";
import dotenv from "dotenv";
import { redisConnection } from "../config/redis";
import { connectDB } from "../config/db";
import Assignment from "../models/Assignment";
import { generateQuestionPaper } from "../services/llm";
import { GenerationJobData } from "../queues/generationQueue";
import { io } from "../index";

dotenv.config();

const emitStage = (jobId: string | undefined, stage: string, progress: number) => {
  if (!jobId) return;
  io.to(`job:${jobId}`).emit("job:progress", { status: "processing", stage, progress });
};

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
        emitStage(job.id, "Building structured prompt...", 15);

        // Tiny delay so frontend sees the stage transition smoothly
        await new Promise((r) => setTimeout(r, 200));
        emitStage(job.id, "Calling AI model...", 35);

        const paper = await generateQuestionPaper(input);

        emitStage(job.id, "Parsing & validating response...", 75);
        await new Promise((r) => setTimeout(r, 150));

        emitStage(job.id, "Saving to database...", 90);

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