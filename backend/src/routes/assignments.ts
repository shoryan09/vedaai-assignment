import { Router, Request, Response } from "express";
import { redisConnection } from "../config/redis";
import { z } from "zod";
import Assignment from "../models/Assignment";
import { generationQueue } from "../queues/generationQueue";
import { pdfQueue } from "../queues/pdfQueue";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  className: z.string().optional(),
  dueDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  questionTypes: z
    .array(
      z.object({
        type: z.string().min(1),
        count: z.number().int().positive(),
        marks: z.number().int().positive(),
      })
    )
    .min(1, "At least one question type required"),
  additionalInstructions: z.string().optional(),
  fileContent: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
  }

  try {
    const assignment = await Assignment.create({
      ...parsed.data,
      dueDate: new Date(parsed.data.dueDate),
      status: "pending",
    });

    const job = await generationQueue.add("generate", {
      assignmentId: assignment._id.toString(),
      title: assignment.title,
      questionTypes: assignment.questionTypes,
      additionalInstructions: assignment.additionalInstructions,
      fileContent: assignment.fileContent,
    });

    assignment.jobId = job.id;
    await assignment.save();

    await redisConnection.del("assignments:list");

    return res.status(202).json({
      assignmentId: assignment._id,
      jobId: job.id,
      status: "pending",
    });
  } catch (err: any) {
    console.error("Create assignment failed:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const cacheKey = "assignments:list";
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const assignments = await Assignment.find().sort({ createdAt: -1 }).limit(50);
    await redisConnection.setex(cacheKey, 60, JSON.stringify(assignments));
    return res.json(assignments);
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    return res.json(assignment);
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await Assignment.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "Not found" });

    await redisConnection.del("assignments:list");

    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/:id/regenerate", async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Not found" });

    assignment.status = "pending";
    assignment.generatedPaper = undefined;
    assignment.pdfStatus = "none";
    assignment.pdfBuffer = undefined;
    assignment.pdfGeneratedAt = undefined;
    assignment.pdfJobId = undefined;
    await assignment.save();

    const job = await generationQueue.add("generate", {
      assignmentId: assignment._id.toString(),
      title: assignment.title,
      questionTypes: assignment.questionTypes,
      additionalInstructions: assignment.additionalInstructions,
      fileContent: assignment.fileContent,
    });

    assignment.jobId = job.id;
    await assignment.save();

    await redisConnection.del("assignments:list");

    return res.status(202).json({
      assignmentId: assignment._id,
      jobId: job.id,
      status: "pending",
    });
  } catch (err: any) {
    console.error("Regenerate failed:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/:id/pdf", async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    if (assignment.status !== "completed" || !assignment.generatedPaper) {
      return res.status(400).json({ error: "Paper not yet generated" });
    }

    if (assignment.pdfStatus === "completed" && assignment.pdfBuffer) {
      return res.json({
        status: "completed",
        downloadUrl: `/api/assignments/${assignment._id}/pdf`,
        cached: true,
      });
    }

    assignment.pdfStatus = "pending";
    await assignment.save();

    const job = await pdfQueue.add("render", { assignmentId: assignment._id.toString() });
    assignment.pdfJobId = job.id;
    await assignment.save();

    return res.status(202).json({
      status: "pending",
      pdfJobId: job.id,
    });
  } catch (err) {
    console.error("PDF enqueue failed:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/:id/pdf", async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    if (assignment.pdfStatus !== "completed" || !assignment.pdfBuffer) {
      return res.status(404).json({ error: "PDF not ready" });
    }

    const filename = `${assignment.title.replace(/\s+/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(assignment.pdfBuffer);
  } catch (err) {
    console.error("PDF download failed:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;