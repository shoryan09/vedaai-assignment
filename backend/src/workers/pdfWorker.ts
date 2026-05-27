import { Worker } from "bullmq";
import dotenv from "dotenv";
import { redisConnection } from "../config/redis";
import Assignment from "../models/Assignment";
import { renderPaperToBuffer } from "../services/pdfRenderer";
import { PdfJobData } from "../queues/pdfQueue";
import { io } from "../index";

dotenv.config();

export const startPdfWorker = () => {
  const worker = new Worker<PdfJobData>(
    "pdf-generation",
    async (job) => {
      const { assignmentId } = job.data;
      console.log(`📄 Processing PDF job ${job.id} for assignment ${assignmentId}`);

      try {
        await Assignment.findByIdAndUpdate(assignmentId, { pdfStatus: "processing" });
        io.to(`pdf:${job.id}`).emit("pdf:progress", { status: "processing" });

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) throw new Error("Assignment not found");
        if (!assignment.generatedPaper) throw new Error("Paper not yet generated");

        const buffer = await renderPaperToBuffer(assignment);

        await Assignment.findByIdAndUpdate(assignmentId, {
          pdfStatus: "completed",
          pdfBuffer: buffer,
          pdfGeneratedAt: new Date(),
        });

        io.to(`pdf:${job.id}`).emit("pdf:complete", {
          assignmentId,
          downloadUrl: `/api/assignments/${assignmentId}/pdf`,
        });

        console.log(`✅ PDF job ${job.id} complete (${buffer.length} bytes)`);
        return { assignmentId, size: buffer.length };
      } catch (err: any) {
        console.error(`❌ PDF job ${job.id} failed:`, err.message);
        await Assignment.findByIdAndUpdate(assignmentId, { pdfStatus: "failed" });
        io.to(`pdf:${job.id}`).emit("pdf:failed", { error: err.message });
        throw err;
      }
    },
    { connection: redisConnection, concurrency: 2 }
  );

  worker.on("ready", () => console.log("✅ PDF worker ready"));
  worker.on("error", (err) => console.error("PDF worker error:", err));
};