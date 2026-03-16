"use client";

import { AuthNav } from "./auth-nav";

export function NavBar() {
  return (
    <nav className="border-b border-[#e5e7eb] bg-white sticky top-0 z-50">
      <div className="mx-auto max-w-4xl px-6 h-14 flex items-center justify-between">
        <a
          href="/"
          className="text-[#1a1a2e] font-semibold tracking-tight shrink-0"
        >
          Rahul S. P.
        </a>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <a
            href="/"
            className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
          >
            Research
          </a>
          <a
            href="/signals"
            className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
          >
            Signals
          </a>
          <a
            href="/performance"
            className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
          >
            Performance
          </a>
          <a
            href="/vsn"
            className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
          >
            VSN Live
          </a>
          <a
            href="/about"
            className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
          >
            About
          </a>
          <div className="ml-2 pl-4 border-l border-[#e5e7eb]">
            <AuthNav />
          </div>
        </div>
        {/* Mobile nav - scrollable row */}
        <div className="flex md:hidden items-center gap-4 text-xs overflow-x-auto ml-4 no-scrollbar">
          <a
            href="/"
            className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap"
          >
            Research
          </a>
          <a
            href="/signals"
            className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap"
          >
            Signals
          </a>
          <a
            href="/performance"
            className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap"
          >
            Performance
          </a>
          <a
            href="/vsn"
            className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap"
          >
            VSN
          </a>
          <a
            href="/about"
            className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap"
          >
            About
          </a>
          <div className="pl-2 border-l border-[#e5e7eb]">
            <AuthNav />
          </div>
        </div>
      </div>
    </nav>
  );
}
