"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import Topbar from "@/components/Topbar";
import DifficultyBadge from "@/components/DifficultyBadge";
import GeneratingState from "@/components/GeneratingState";
import { getAssignment } from "@/lib/api";
import { getSocket, subscribeToJob } from "@/lib/socket";
import { useAssignmentStore } from "@/store/assignmentStore";
import type { Assignment } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AssignmentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const {
    setGenerationStatus,
    setGenerationProgress,
    setCurrentJobId,
    updatePaper,
    reset,
  } = useAssignmentStore();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch assignment
  const fetchAssignment = async () => {
    try {
      const data = await getAssignment(id);
      setAssignment(data);
      setLoading(false);
      if (data.status === "pending" || data.status === "processing") {
        setGenerationStatus(data.status);
        if (data.jobId) {
          setCurrentJobId(data.jobId);
          subscribeToJob(data.jobId);
        }
      }
    } catch (err) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignment();
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();

    const onProgress = (data: { status: string; progress: number }) => {
      setGenerationStatus(data.status as any);
      setGenerationProgress(data.progress);
    };

    const onComplete = (data: { assignmentId: string; paper: any }) => {
      if (data.assignmentId === id) {
        updatePaper(data.paper);
        fetchAssignment(); // refresh full assignment
      }
    };

    const onFailed = (data: { error: string }) => {
      setGenerationStatus("failed");
      alert(`Generation failed: ${data.error}`);
    };

    socket.on("job:progress", onProgress);
    socket.on("job:complete", onComplete);
    socket.on("job:failed", onFailed);

    return () => {
      socket.off("job:progress", onProgress);
      socket.off("job:complete", onComplete);
      socket.off("job:failed", onFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <>
        <Topbar title="Create New" />
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
      </>
    );
  }

  if (!assignment) {
    return (
      <>
        <Topbar title="Create New" />
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Assignment not found
        </div>
      </>
    );
  }

  // Show generating state if still processing
  if (assignment.status === "pending" || assignment.status === "processing") {
    return (
      <>
        <Topbar title="Create New" />
        <GeneratingState />
      </>
    );
  }

  if (assignment.status === "failed") {
    return (
      <>
        <Topbar title="Create New" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-red-600 mb-4">Generation failed. Please try again.</p>
          <button
            onClick={() => router.push("/assignments/new")}
            className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg text-sm"
          >
            Create new assignment
          </button>
        </div>
      </>
    );
  }

  const paper = assignment.generatedPaper!;

  return (
    <>
      <Topbar title="Create New" />
      <div className="flex-1 px-6 md:px-10 py-6 max-w-4xl mx-auto w-full">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/assignments")}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/assignments/new")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition"
            >
              <RefreshCw size={14} />
              Regenerate
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#1a1a1a] hover:bg-black rounded-lg transition">
              <Download size={14} />
              Download as PDF
            </button>
          </div>
        </div>

        {/* AI Intro */}
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Certainly!</span> Here&apos;s a customized question paper for <strong>{assignment.title}</strong>.
          </p>
        </div>

        {/* Paper */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 md:p-12">
          {/* School Header */}
          <div className="text-center mb-6 pb-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Delhi Public School, Sector-4, Bokaro</h1>
            <p className="text-sm text-gray-700">Subject: {assignment.title}</p>
            <p className="text-sm text-gray-700">Class: 8th</p>
          </div>

          {/* Time + Marks */}
          <div className="flex flex-wrap justify-between gap-2 text-sm text-gray-700 mb-4">
            <span>Time Allowed: 45 minutes</span>
            <span>Maximum Marks: {paper.totalMarks}</span>
          </div>

          <p className="text-sm text-gray-700 mb-4">All questions are compulsory unless stated otherwise.</p>

          {/* Student Info */}
          <div className="space-y-2 mb-8 text-sm text-gray-700">
            <p>Name: <span className="inline-block border-b border-gray-300 min-w-[200px] ml-2"></span></p>
            <p>Roll Number: <span className="inline-block border-b border-gray-300 min-w-[200px] ml-2"></span></p>
            <p>Class: 5th &nbsp;&nbsp; Section: <span className="inline-block border-b border-gray-300 min-w-[100px] ml-2"></span></p>
          </div>

          {/* Sections */}
          {paper.sections.map((section, sIdx) => (
            <div key={sIdx} className="mb-8">
              <h2 className="text-base font-bold text-gray-900 text-center mb-1">{section.title}</h2>
              <p className="text-xs text-gray-600 text-center italic mb-4">{section.instruction}</p>

              <ol className="space-y-3 list-decimal pl-6">
                {section.questions.map((q, qIdx) => (
                  <li key={qIdx} className="text-sm text-gray-800 leading-relaxed">
                    <div className="flex flex-wrap items-start gap-2">
                      <DifficultyBadge difficulty={q.difficulty} />
                      <span className="flex-1 min-w-[200px]">{q.text}</span>
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">[{q.marks} Marks]</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          <p className="text-sm font-medium text-gray-900 mb-6">End of Question Paper</p>

          {/* Answer Key */}
          {paper.answerKey && (
            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-bold text-gray-900 mb-3">Answer Key:</h3>
              <div className="text-sm text-gray-700 whitespace-pre-line">{paper.answerKey}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}