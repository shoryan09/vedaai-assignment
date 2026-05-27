"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Sparkles, Library } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/assignments", label: "Assignments", icon: FileText },
  { href: "/toolkit", label: "Toolkit", icon: Sparkles },
  { href: "/library", label: "Library", icon: Library },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              active ? "text-orange-600" : "text-gray-500"
            }`}
          >
            <Icon size={18} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}