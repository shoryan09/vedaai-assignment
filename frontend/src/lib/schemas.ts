import { z } from "zod";

export const questionTypeSchema = z.object({
  type: z.string().min(1, "Type is required"),
  count: z.number().int().positive("Must be at least 1"),
  marks: z.number().int().positive("Must be at least 1"),
});

export const createAssignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  className: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  questionTypes: z.array(questionTypeSchema).min(1, "Add at least one question type"),
  additionalInstructions: z.string().optional(),
  fileContent: z.string().optional(),
});

export type CreateAssignmentFormData = z.infer<typeof createAssignmentSchema>;

export const QUESTION_TYPES = [
  "Multiple Choice Questions",
  "Short Questions",
  "Long Questions",
  "Diagram/Graph Based Questions",
  "Numerical Problems",
  "True or False",
  "Fill in the Blanks",
] as const;