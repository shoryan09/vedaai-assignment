"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter } from "lucide-react";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import AssignmentCard from "@/components/AssignmentCard";
import { getAssignments } from "@/lib/api";
import type { Assignment } from "@/types";

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAssignments()
      .then((data) => {
        setAssignments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <Topbar title="Assignment" />
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
      </>
    );
  }

  if (assignments.length === 0) {
    return (
      <>
        <Topbar title="Assignment" />
        <EmptyState />
      </>
    );
  }

  return (
    <>
      <Topbar title="Assignment" />
      <div className="flex-1 p-6 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Assignments</h2>
          <p className="text-sm text-gray-500">Manage and create assignments for your classes.</p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Filter size={14} />
              Filter By
            </button>
            <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg flex-1 max-w-md">
              <Search size={14} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assignment"
                className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <AssignmentCard key={a._id} assignment={a} />
          ))}
        </div>

        {/* Floating Create button (mobile) */}
        <Link
          href="/assignments/new"
          className="md:hidden fixed bottom-20 right-6 bg-[#1a1a1a] text-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={16} />
          Create Assignment
        </Link>
      </div>
    </>
  );
}