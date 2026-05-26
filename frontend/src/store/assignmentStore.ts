import { create } from "zustand";
import type { Assignment, GeneratedPaper, AssignmentStatus } from "@/types";

interface AssignmentState {
  assignments: Assignment[];
  currentAssignment: Assignment | null;
  generationStatus: AssignmentStatus | "idle";
  generationProgress: number;
  currentJobId: string | null;

  setAssignments: (a: Assignment[]) => void;
  setCurrentAssignment: (a: Assignment | null) => void;
  setGenerationStatus: (s: AssignmentStatus | "idle") => void;
  setGenerationProgress: (p: number) => void;
  setCurrentJobId: (id: string | null) => void;
  updatePaper: (paper: GeneratedPaper) => void;
  reset: () => void;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
  assignments: [],
  currentAssignment: null,
  generationStatus: "idle",
  generationProgress: 0,
  currentJobId: null,

  setAssignments: (a) => set({ assignments: a }),
  setCurrentAssignment: (a) => set({ currentAssignment: a }),
  setGenerationStatus: (s) => set({ generationStatus: s }),
  setGenerationProgress: (p) => set({ generationProgress: p }),
  setCurrentJobId: (id) => set({ currentJobId: id }),
  updatePaper: (paper) =>
    set((state) => ({
      currentAssignment: state.currentAssignment
        ? { ...state.currentAssignment, generatedPaper: paper, status: "completed" }
        : null,
    })),
  reset: () =>
    set({
      currentAssignment: null,
      generationStatus: "idle",
      generationProgress: 0,
      currentJobId: null,
    }),
}));