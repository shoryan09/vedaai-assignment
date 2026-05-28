"use client";

import { Sparkles } from "lucide-react";
import { useAssignmentStore } from "@/store/assignmentStore";

export default function GeneratingState() {
  const { generationProgress, generationStage } = useAssignmentStore();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center animate-pulse">
          <Sparkles size={32} className="text-white" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-orange-200 animate-ping opacity-30"></div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">Generating your question paper</h2>
      <p className="text-sm text-gray-500 text-center max-w-md mb-6">
        Our AI is crafting questions based on your inputs. This usually takes 5-15 seconds.
      </p>

      <div className="w-full max-w-sm">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(generationProgress, 10)}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-3 text-center min-h-[16px]">
          {generationStage || "Queueing job..."}
        </p>
      </div>
    </div>
  );
}