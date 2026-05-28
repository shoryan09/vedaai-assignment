"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FileText, Sparkles, Library, Settings, Plus, X } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/groups", label: "My Groups", icon: Users },
  { href: "/assignments", label: "Assignments", icon: FileText, badge: 12 },
  { href: "/toolkit", label: "AI Teacher's Toolkit", icon: Sparkles },
  { href: "/library", label: "My Library", icon: Library },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useUIStore();

  const handleNavClick = () => setMobileNavOpen(false);

  return (
    <>
      
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden fixed inset-0 bg-black/40 z-30"
        />
      )}

      <aside
        className={`
          fixed md:sticky top-0 left-0 z-40 md:z-0
          flex flex-col w-64 h-screen bg-white border-r border-gray-200
          transform transition-transform duration-200
          ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        
        <div className="px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">VedaAI</span>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="md:hidden p-1 hover:bg-gray-100 rounded"
            aria-label="Close menu"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <div className="px-4 mb-4">
          <Link
            href="/assignments/new"
            onClick={handleNavClick}
            className="flex items-center justify-center gap-2 w-full bg-[#1a1a1a] hover:bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} />
            Create Assignment
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-2">
          <Link
            href="/settings"
            onClick={handleNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
          >
            <Settings size={18} />
            <span>Settings</span>
          </Link>
        </div>

        <div className="p-4 m-3 bg-gray-50 rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-700 font-semibold text-sm">DP</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">Delhi Public School</p>
            <p className="text-xs text-gray-500 truncate">Bokaro Steel City</p>
          </div>
        </div>
      </aside>
    </>
  );
}