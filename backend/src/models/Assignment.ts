import mongoose, { Schema, Document } from "mongoose";

export interface IQuestion {
  text: string;
  difficulty: "easy" | "moderate" | "hard";
  marks: number;
}

export interface ISection {
  title: string;
  instruction: string;
  questions: IQuestion[];
}

export type PdfStatus = "none" | "pending" | "processing" | "completed" | "failed";

export interface IAssignment extends Document {
  title: string;
  dueDate: Date;
  questionTypes: { type: string; count: number; marks: number }[];
  additionalInstructions?: string;
  fileContent?: string;
  status: "pending" | "processing" | "completed" | "failed";
  jobId?: string;
  pdfStatus: PdfStatus;
  pdfJobId?: string;
  pdfBuffer?: Buffer;
  pdfGeneratedAt?: Date;
  generatedPaper?: {
    sections: ISection[];
    answerKey?: string;
    totalMarks: number;
    totalQuestions: number;
  };
  createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  text: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "moderate", "hard"], required: true },
  marks: { type: Number, required: true },
});

const SectionSchema = new Schema<ISection>({
  title: { type: String, required: true },
  instruction: { type: String, required: true },
  questions: [QuestionSchema],
});

const AssignmentSchema = new Schema<IAssignment>(
  {
    title: { type: String, required: true },
    dueDate: { type: Date, required: true },
    questionTypes: [
      {
        type: { type: String, required: true },
        count: { type: Number, required: true, min: 1 },
        marks: { type: Number, required: true, min: 1 },
      },
    ],
    additionalInstructions: String,
    fileContent: String,
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    jobId: String,
    pdfStatus: {
      type: String,
      enum: ["none", "pending", "processing", "completed", "failed"],
      default: "none",
    },
    pdfJobId: String,
    pdfBuffer: Buffer,
    pdfGeneratedAt: Date,
    generatedPaper: {
      sections: [SectionSchema],
      answerKey: String,
      totalMarks: Number,
      totalQuestions: Number,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IAssignment>("Assignment", AssignmentSchema);