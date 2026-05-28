"use client";

import Link from "next/link";
import { Plus, SearchX } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-2xl bg-gray-100 flex items-center justify-center">
          <SearchX size={48} className="text-gray-400" strokeWidth={1.5} />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
          <span className="text-orange-500 text-xs">✨</span>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">No assignments yet</h2>
      <p className="text-sm text-gray-500 text-center max-w-md mb-8">
        Create your first assignment to start collecting and grading student submissions. You can set up
        rubrics, define marking criteria, and let AI assist with grading.
      </p>

      <Link
        href="/assignments/new"
        className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
      >
        <Plus size={16} />
        Create Your First Assignment
      </Link>
    </div>
  );
}