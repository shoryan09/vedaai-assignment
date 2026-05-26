import Groq from "groq-sdk";
import { z } from "zod";

const QuestionSchema = z.object({
  text: z.string(),
  difficulty: z.enum(["easy", "moderate", "hard"]),
  marks: z.number(),
});

const SectionSchema = z.object({
  title: z.string(),
  instruction: z.string(),
  questions: z.array(QuestionSchema),
});

const PaperSchema = z.object({
  sections: z.array(SectionSchema),
  answerKey: z.string().optional(),
  totalQuestions: z.number(),
  totalMarks: z.number(),
});

export type GeneratedPaper = z.infer<typeof PaperSchema>;

interface GenerateInput {
  title: string;
  questionTypes: { type: string; count: number; marks: number }[];
  additionalInstructions?: string;
  fileContent?: string;
}

const buildPrompt = (input: GenerateInput): string => {
  const typesBreakdown = input.questionTypes
    .map((q) => `- ${q.count} × ${q.type} (${q.marks} marks each)`)
    .join("\n");

  const totalQuestions = input.questionTypes.reduce((sum, q) => sum + q.count, 0);
  const totalMarks = input.questionTypes.reduce((sum, q) => sum + q.count * q.marks, 0);

  return `You are an expert academic assessment creator. Generate a structured question paper.

ASSIGNMENT TITLE: ${input.title}

QUESTION REQUIREMENTS:
${typesBreakdown}

TOTAL: ${totalQuestions} questions, ${totalMarks} marks

${input.additionalInstructions ? `ADDITIONAL INSTRUCTIONS:\n${input.additionalInstructions}\n` : ""}
${input.fileContent ? `REFERENCE MATERIAL:\n${input.fileContent.substring(0, 4000)}\n` : ""}

Group questions into sections (Section A, Section B, etc — one section per question type).
For each question, assign difficulty: "easy", "moderate", or "hard". Distribute difficulty reasonably.

Respond ONLY with valid JSON matching this exact schema:

{
  "sections": [
    {
      "title": "Section A",
      "instruction": "Attempt all questions",
      "questions": [
        { "text": "...", "difficulty": "easy", "marks": 2 }
      ]
    }
  ],
  "answerKey": "1. Answer one.\\n2. Answer two.\\n...",
  "totalQuestions": ${totalQuestions},
  "totalMarks": ${totalMarks}
}`;
};

export const generateQuestionPaper = async (input: GenerateInput): Promise<GeneratedPaper> => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY as string });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are a JSON-only assistant. Respond with valid JSON matching the requested schema. No markdown, no code fences, no extra text.",
      },
      { role: "user", content: buildPrompt(input) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`LLM returned invalid JSON: ${text.substring(0, 200)}`);
  }

  const validated = PaperSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(validated.error.issues)}`);
  }

  return validated.data;
};