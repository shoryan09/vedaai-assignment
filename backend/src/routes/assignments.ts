import { Router, Request, Response } from "express";
import { redisConnection } from "../config/redis";
import { z } from "zod";
import Assignment from "../models/Assignment";
import { generationQueue } from "../queues/generationQueue";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
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

export default router;