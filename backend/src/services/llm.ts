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

const TYPE_GUIDANCE: Record<string, string> = {
  "Multiple Choice Questions":
    "Each question MUST have 4 options (A, B, C, D), each on a NEW LINE inside the question text. Format strictly as: 'Question text here?\\nA) option1\\nB) option2\\nC) option3\\nD) option4'. Each option on its own line, no inline lists. Test recall and quick understanding.",
  "Short Questions":
    "Each question expects a 2-3 sentence written answer. Ask for definitions, explanations, brief comparisons, or single concept applications.",
  "Long Questions":
    "Each question expects a detailed multi-paragraph answer. Ask students to analyze, evaluate, derive, or describe a process in depth.",
  "Diagram/Graph Based Questions":
    "Each question MUST explicitly instruct the student to draw, sketch, label, or interpret a diagram, chart, or graph. Use phrases like 'Draw a labeled diagram of...', 'Sketch the graph showing...', 'Label the parts of...', 'Interpret the following graph (described below)...'. The question must clearly require visual output.",
  "Numerical Problems":
    "Each question MUST involve specific numerical values, units, and require calculation. Provide concrete numbers in the question text (e.g., 'A current of 2A flows through a 5Ω resistor for 10 seconds. Calculate the heat produced.'). The student must compute a numerical answer.",
  "True or False":
    "Each question MUST be a single declarative statement that the student marks as TRUE or FALSE. No options, no calculations — just a clear factual claim.",
  "Fill in the Blanks":
    "Each question MUST be a sentence with one or more blanks (use ______ to indicate the blank). The student fills in the missing word(s) or value.",
};

const buildPrompt = (input: GenerateInput): string => {
  const typesBreakdown = input.questionTypes
    .map((q) => {
      const guidance = TYPE_GUIDANCE[q.type] || `Standard questions of type "${q.type}".`;
      return `Section for "${q.type}" — ${q.count} questions, ${q.marks} marks each.\n  Format requirements: ${guidance}`;
    })
    .join("\n\n");

  const totalQuestions = input.questionTypes.reduce((sum, q) => sum + q.count, 0);
  const totalMarks = input.questionTypes.reduce((sum, q) => sum + q.count * q.marks, 0);

  return `You are an expert academic assessment creator. Generate a structured question paper following the format rules EXACTLY.

ASSIGNMENT TITLE: ${input.title}

QUESTION REQUIREMENTS:
${typesBreakdown}

TOTAL: ${totalQuestions} questions, ${totalMarks} marks

${input.additionalInstructions ? `ADDITIONAL INSTRUCTIONS:\n${input.additionalInstructions}\n` : ""}
${input.fileContent ? `REFERENCE MATERIAL:\n${input.fileContent.substring(0, 4000)}\n` : ""}

CRITICAL RULES:
- Create ONE section per question type. Section A = first type, Section B = second type, etc.
- Each section's "instruction" field MUST describe what format the questions take (e.g. "Choose the correct option for each question.", "Answer in 2-3 sentences.", "Draw and label clearly.", "Show all calculation steps.").
- Each question's "text" field MUST follow the format requirements for its type. Do NOT mix formats across types.
- For MCQ questions: the options must be embedded in the question text itself.
- For Numerical questions: every question must include actual numbers and units.
- For Diagram questions: every question must explicitly require drawing/labeling/interpreting visual content.
- Difficulty: distribute "easy", "moderate", "hard" reasonably across each section.
- Generate an answer key referencing question numbers (1, 2, 3...) in order across all sections.

Respond ONLY with valid JSON matching this exact schema:

{
  "sections": [
    {
      "title": "Section A",
      "instruction": "Choose the correct option for each question.",
      "questions": [
        { "text": "What is X? A) option1 B) option2 C) option3 D) option4", "difficulty": "easy", "marks": 2 }
      ]
    }
  ],
  "answerKey": "1. C\\n2. ...",
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