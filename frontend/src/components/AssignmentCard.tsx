"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreVertical, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { deleteAssignment } from "@/lib/api";
import type { Assignment } from "@/types";

interface Props {
  assignment: Assignment;
}

export default function AssignmentCard({ assignment }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this assignment?")) {
      await deleteAssignment(assignment._id);
      window.location.reload();
    }
  };

  return (
    <Link
      href={`/assignments/${assignment._id}`}
      className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 hover:shadow-sm transition relative"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
        <button
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen(!menuOpen);
          }}
          className="p-1 hover:bg-gray-100 rounded transition"
        >
          <MoreVertical size={16} className="text-gray-400" />
        </button>

        {menuOpen && (
          <div className="absolute top-12 right-4 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 w-40">
            <Link
              href={`/assignments/${assignment._id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Eye size={14} />
              View Assignment
            </Link>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-50 w-full text-left"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div>
          <span>Assigned on: </span>
          <span className="font-medium text-gray-700">
            {format(new Date(assignment.createdAt), "dd-MM-yyyy")}
          </span>
        </div>
        <div>
          <span>Due: </span>
          <span className="font-medium text-gray-700">
            {format(new Date(assignment.dueDate), "dd-MM-yyyy")}
          </span>
        </div>
      </div>
    </Link>
  );
}