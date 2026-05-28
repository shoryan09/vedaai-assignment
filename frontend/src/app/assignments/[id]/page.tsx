"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Topbar from "@/components/Topbar";
import DifficultyBadge from "@/components/DifficultyBadge";
import GeneratingState from "@/components/GeneratingState";
import { getAssignment, requestPdf, getPdfDownloadUrl, regenerateAssignment } from "@/lib/api";
import { getSocket, subscribeToJob, subscribeToPdfJob } from "@/lib/socket";
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
    setGenerationStage,
    setCurrentJobId,
    updatePaper,
    reset,
  } = useAssignmentStore();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "pending" | "processing" | "ready" | "failed">("idle");
  const [regenerating, setRegenerating] = useState(false);

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

  useEffect(() => {
    const socket = getSocket();

    const onProgress = (data: { status: string; progress: number; stage?: string }) => {
      setGenerationStatus(data.status as any);
      setGenerationProgress(data.progress);
      if (data.stage) setGenerationStage(data.stage);
    };

    const onComplete = (data: { assignmentId: string; paper: any }) => {
      if (data.assignmentId === id) {
        updatePaper(data.paper);
        fetchAssignment();
        if (regenerating) {
          toast.success("Fresh questions generated");
        }
        setRegenerating(false);
      }
    };

    const onFailed = (data: { error: string }) => {
      setGenerationStatus("failed");
      setRegenerating(false);
      toast.error(`Generation failed: ${data.error}`);
    };

    const onPdfComplete = (data: { assignmentId: string; downloadUrl: string }) => {
      if (data.assignmentId === id) {
        setPdfStatus("ready");
        triggerBrowserDownload(getPdfDownloadUrl(id));
        toast.success("PDF downloaded successfully");
      }
    };

    const onPdfFailed = (data: { error: string }) => {
      setPdfStatus("failed");
      toast.error(`PDF generation failed: ${data.error}`);
    };

    socket.on("job:progress", onProgress);
    socket.on("job:complete", onComplete);
    socket.on("job:failed", onFailed);
    socket.on("pdf:complete", onPdfComplete);
    socket.on("pdf:failed", onPdfFailed);

    return () => {
      socket.off("job:progress", onProgress);
      socket.off("job:complete", onComplete);
      socket.off("job:failed", onFailed);
      socket.off("pdf:complete", onPdfComplete);
      socket.off("pdf:failed", onPdfFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const triggerBrowserDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${assignment?.title?.replace(/\s+/g, "_") || "paper"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRegenerate = async () => {
    if (!assignment) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      toast("Regenerate this paper?", {
        description: "This will replace the current questions with a fresh set.",
        action: {
          label: "Regenerate",
          onClick: () => resolve(true),
        },
        cancel: {
          label: "Cancel",
          onClick: () => resolve(false),
        },
        duration: 10000,
        onDismiss: () => resolve(false),
        onAutoClose: () => resolve(false),
      });
    });
    if (!confirmed) return;

    setRegenerating(true);
    try {
      const result = await regenerateAssignment(assignment._id);
      setCurrentJobId(result.jobId);
      setGenerationStatus("pending");
      subscribeToJob(result.jobId);

      setAssignment({
        ...assignment,
        status: "pending",
        generatedPaper: undefined,
        pdfStatus: "none" as any,
      } as Assignment);
    } catch (err) {
      console.error("Regenerate failed", err);
      toast.error("Failed to regenerate. Please try again.");
      setRegenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!assignment) return;
    setPdfStatus("pending");
    try {
      const result = await requestPdf(assignment._id);
      if (result.cached) {
        setPdfStatus("ready");
        triggerBrowserDownload(getPdfDownloadUrl(assignment._id));
        return;
      }
      if (result.pdfJobId) {
        subscribeToPdfJob(result.pdfJobId);
        setPdfStatus("processing");
      }
    } catch (err) {
      console.error("PDF request failed", err);
      setPdfStatus("failed");
      toast.error("Failed to start PDF generation.");
    }
  };

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
  const isPdfBusy = pdfStatus === "pending" || pdfStatus === "processing";
  const pdfButtonLabel =
    pdfStatus === "pending"
      ? "Queueing..."
      : pdfStatus === "processing"
      ? "Generating PDF..."
      : "Download as PDF";

  return (
    <>
      <Topbar title="Create New" />
      <div className="flex-1 px-4 md:px-10 py-4 md:py-6 max-w-4xl mx-auto w-full">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 md:mb-6">
          <button
            onClick={() => router.push("/assignments")}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition disabled:opacity-60"
            >
              <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
              {regenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              onClick={handleDownload}
              disabled={isPdfBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#1a1a1a] hover:bg-black rounded-lg transition disabled:opacity-60"
            >
              <Download size={14} />
              {pdfButtonLabel}
            </button>
          </div>
        </div>

        {/* AI Intro */}
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Certainly!</span> Here&apos;s a customized question paper for{" "}
            <strong>{assignment.title}</strong>.
          </p>
        </div>

        {/* Paper */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 md:p-12">
          {/* School Header */}
          <div className="text-center mb-6 pb-6 border-b border-gray-200">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 mb-1">Delhi Public School, Sector-4, Bokaro</h1>
            <p className="text-sm text-gray-700">Subject: {assignment.title}</p>
            {assignment.className && <p className="text-sm text-gray-700">Class: {assignment.className}</p>}
          </div>

          {/* Time + Marks */}
          <div className="flex flex-wrap justify-between gap-2 text-sm text-gray-700 mb-4">
            <span>Time Allowed: 45 minutes</span>
            <span>Maximum Marks: {paper.totalMarks}</span>
          </div>

          <p className="text-sm text-gray-700 mb-4">All questions are compulsory unless stated otherwise.</p>

          {/* Student Info */}
          <div className="space-y-2 mb-8 text-sm text-gray-700">
            <p>
              Name: <span className="inline-block border-b border-gray-300 min-w-[200px] ml-2"></span>
            </p>
            <p>
              Roll Number: <span className="inline-block border-b border-gray-300 min-w-[200px] ml-2"></span>
            </p>
            <p>
              Section:{" "}
              <span className="inline-block border-b border-gray-300 min-w-[100px] ml-2"></span>
            </p>
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
                      <span className="flex-1 min-w-[200px] whitespace-pre-line">{q.text}</span>
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                        [{q.marks} Marks]
                      </span>
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