"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, X, Upload, ChevronDown } from "lucide-react";
import Topbar from "@/components/Topbar";
import { createAssignment, uploadFile } from "@/lib/api";
import { subscribeToJob, getSocket } from "@/lib/socket";
import { useAssignmentStore } from "@/store/assignmentStore";
import { createAssignmentSchema, QUESTION_TYPES } from "@/lib/schemas";

interface QuestionTypeRow {
  type: string;
  count: number;
  marks: number;
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const { setCurrentJobId, setGenerationStatus } = useAssignmentStore();

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeRow[]>([
    { type: "Multiple Choice Questions", count: 5, marks: 2 },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const totalQuestions = questionTypes.reduce((s, q) => s + (q.count || 0), 0);
  const totalMarks = questionTypes.reduce((s, q) => s + (q.count || 0) * (q.marks || 0), 0);

  const updateRow = (index: number, field: keyof QuestionTypeRow, value: string | number) => {
    setQuestionTypes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRow = () => {
    setQuestionTypes((prev) => [...prev, { type: "Short Questions", count: 3, marks: 5 }]);
  };

  const removeRow = (index: number) => {
    setQuestionTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isTxt = file.type === "text/plain" || file.name.endsWith(".txt");
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

    if (!isTxt && !isPdf) {
      alert("Please upload a PDF or text file");
      return;
    }

    setUploadingFile(true);
    try {
      if (isTxt) {
        const text = await file.text();
        setFileContent(text.substring(0, 8000));
        setFileName(file.name);
      } else {
        const { text, filename } = await uploadFile(file);
        setFileContent(text);
        setFileName(filename);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse file. Please try a different file.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    const data = {
      title,
      dueDate,
      questionTypes,
      additionalInstructions: additionalInstructions || undefined,
      fileContent: fileContent || undefined,
    };

    const parsed = createAssignmentSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const result = await createAssignment(parsed.data);
      setCurrentJobId(result.jobId);
      setGenerationStatus("pending");

      getSocket();
      subscribeToJob(result.jobId);

      router.push(`/assignments/${result.assignmentId}`);
    } catch (err: any) {
      alert(`Failed to create assignment: ${err.message}`);
      setSubmitting(false);
    }
  };

  return (
    <>
      <Topbar title="Create Assignment" />
      <div className="flex-1 px-4 md:px-10 py-4 md:py-6 max-w-4xl mx-auto w-full">
        <div className="mb-5 md:mb-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Create Assignment</h2>
          <p className="text-sm text-gray-500">Set up a new assignment for your classes.</p>
        </div>

        {/* Assignment Details Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 mb-4 md:mb-6">
          <h3 className="font-semibold text-gray-900 mb-1">Assignment Details</h3>
          <p className="text-xs text-gray-500 mb-5">Basic information about your assignment.</p>

          {/* Title */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quiz on Electricity"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900 transition"
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          {/* File upload */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Upload Reference Material <span className="text-gray-400">(optional)</span>
            </label>
            <label className="flex flex-col items-center justify-center w-full py-6 md:py-8 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition bg-gray-50">
              <Upload size={20} className="text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-1 text-center">
                {uploadingFile ? (
                  <span className="text-gray-500">Extracting text from file...</span>
                ) : fileName ? (
                  <span className="font-medium text-gray-900 break-all">{fileName}</span>
                ) : (
                  <>Choose a file or drag &amp; drop it here</>
                )}
              </p>
              <p className="text-xs text-gray-400">PDF or .txt up to 10MB</p>
              <input
                type="file"
                accept=".pdf,.txt,text/plain,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="mt-3 text-xs text-gray-700 underline">Browse Files</span>
            </label>
          </div>

          {/* Due Date */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900 transition"
            />
            {errors.dueDate && <p className="text-xs text-red-600 mt-1">{errors.dueDate}</p>}
          </div>

          {/* Question Types Header (desktop only) */}
          <div className="hidden md:grid grid-cols-12 gap-3 mb-2 text-xs font-medium text-gray-500">
            <div className="col-span-6">Question Type</div>
            <div className="col-span-3">No. of Questions</div>
            <div className="col-span-2">Marks</div>
            <div className="col-span-1"></div>
          </div>

          {/* Question Type Rows */}
          {questionTypes.map((row, index) => (
            <div
              key={index}
              className="mb-4 md:mb-3 p-3 md:p-0 bg-gray-50 md:bg-transparent rounded-lg md:rounded-none"
            >
              {/* Desktop layout */}
              <div className="hidden md:grid grid-cols-12 gap-3 items-center">
                <div className="col-span-6 relative">
                  <select
                    value={row.type}
                    onChange={(e) => updateRow(index, "type", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900 appearance-none pr-8 bg-white"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                </div>
                <input
                  type="number"
                  min={1}
                  value={row.count}
                  onChange={(e) => updateRow(index, "count", parseInt(e.target.value) || 0)}
                  className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900"
                />
                <input
                  type="number"
                  min={1}
                  value={row.marks}
                  onChange={(e) => updateRow(index, "marks", parseInt(e.target.value) || 0)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900"
                />
                <button
                  onClick={() => removeRow(index)}
                  disabled={questionTypes.length === 1}
                  className="col-span-1 p-2 hover:bg-gray-100 rounded transition disabled:opacity-30 disabled:cursor-not-allowed flex justify-center"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              {/* Mobile layout */}
              <div className="md:hidden space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500">Question Type</label>
                  <button
                    onClick={() => removeRow(index)}
                    disabled={questionTypes.length === 1}
                    className="p-1 hover:bg-gray-200 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X size={14} className="text-gray-500" />
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={row.type}
                    onChange={(e) => updateRow(index, "type", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900 appearance-none pr-8 bg-white"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">No. of Questions</label>
                    <input
                      type="number"
                      min={1}
                      value={row.count}
                      onChange={(e) => updateRow(index, "count", parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Marks</label>
                    <input
                      type="number"
                      min={1}
                      value={row.marks}
                      onChange={(e) => updateRow(index, "marks", parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {errors.questionTypes && (
            <p className="text-xs text-red-600 mt-1">{errors.questionTypes}</p>
          )}

          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-black mt-2"
          >
            <Plus size={14} />
            Add Question Type
          </button>

          <div className="mt-5 pt-5 border-t border-gray-100 flex flex-col md:flex-row md:justify-end gap-1 md:gap-6 text-xs text-gray-600">
            <span>Total Questions: <strong className="text-gray-900">{totalQuestions}</strong></span>
            <span>Total Marks: <strong className="text-gray-900">{totalMarks}</strong></span>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 mb-4 md:mb-6">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Additional Information <span className="text-gray-400 font-normal">(For better output)</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            E.g. Generate a question paper for class 8 exam, Class 8 NCERT syllabus, etc.
          </p>
          <textarea
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            rows={4}
            placeholder="Class 8 CBSE level, NCERT syllabus..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900 resize-none"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={14} />
            Previous
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 md:px-5 py-2 bg-[#1a1a1a] hover:bg-black text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {submitting ? "Generating..." : "Next"}
            {!submitting && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </>
  );
}