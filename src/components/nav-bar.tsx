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
            href="/money-flow"
            className="inline-flex items-center gap-1.5 font-medium text-[#1a1a2e] hover:text-[#1e40af] transition-colors"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2bd4b0]" aria-hidden />
            Money Flow
          </a>
          <a
            href="/tools"
            className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
          >
            Tools
          </a>
          <a
            href="/about"
            className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
          >
            About
          </a>
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
            href="/money-flow"
            className="inline-flex items-center gap-1 font-medium text-[#1a1a2e] hover:text-[#1e40af] whitespace-nowrap"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2bd4b0]" aria-hidden />
            Money Flow
          </a>
          <a
            href="/tools"
            className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap"
          >
            Tools
          </a>
          <a
            href="/about"
            className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap"
          >
            About
          </a>
        </div>
      </div>
    </nav>
  );
}
