export type Difficulty = "easy" | "moderate" | "hard";

export type AssignmentStatus = "pending" | "processing" | "completed" | "failed";

export interface Question {
  text: string;
  difficulty: Difficulty;
  marks: number;
  _id?: string;
}

export interface Section {
  title: string;
  instruction: string;
  questions: Question[];
  _id?: string;
}

export interface GeneratedPaper {
  sections: Section[];
  answerKey?: string;
  totalQuestions: number;
  totalMarks: number;
}

export interface QuestionType {
  type: string;
  count: number;
  marks: number;
}

export interface Assignment {
  _id: string;
  title: string;
  className?: string;
  dueDate: string;
  questionTypes: QuestionType[];
  additionalInstructions?: string;
  fileContent?: string;
  status: AssignmentStatus;
  jobId?: string;
  generatedPaper?: GeneratedPaper;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentInput {
  title: string;
  className?: string;
  dueDate: string;
  questionTypes: QuestionType[];
  additionalInstructions?: string;
  fileContent?: string;
}

export interface JobProgressEvent {
  status: AssignmentStatus;
  progress: number;
}

export interface JobCompleteEvent {
  assignmentId: string;
  paper: GeneratedPaper;
}