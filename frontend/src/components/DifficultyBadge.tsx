import type { Difficulty } from "@/types";

const styles: Record<Difficulty, string> = {
  easy: "bg-green-50 text-green-700 border-green-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  hard: "bg-red-50 text-red-700 border-red-200",
};

const labels: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Challenging",
};

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${styles[difficulty]}`}
    >
      {labels[difficulty]}
    </span>
  );
}