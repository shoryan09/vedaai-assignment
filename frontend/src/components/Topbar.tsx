"use client";

import { Search, Bell, ChevronDown } from "lucide-react";

interface TopbarProps {
  title?: string;
  showSearch?: boolean;
}

export default function Topbar({ title = "Assignment", showSearch = false }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-medium text-gray-700">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {showSearch && (
          <div className="hidden md:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg w-64">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search assignment..."
              className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder:text-gray-400"
            />
          </div>
        )}

        <button className="relative p-2 hover:bg-gray-50 rounded-lg transition">
          <Bell size={18} className="text-gray-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full"></span>
        </button>

        <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-lg transition">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
            <span className="text-orange-700 text-xs font-semibold">JD</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <span className="text-sm font-medium text-gray-700">John Doe</span>
            <ChevronDown size={14} className="text-gray-500" />
          </div>
        </div>
      </div>
    </header>
  );
}