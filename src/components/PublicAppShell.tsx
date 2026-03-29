import type { ReactNode } from "react";
import Header from "@/components/Header";
import PublicBottomDock from "@/components/PublicBottomDock";

type PublicAppShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  showDock?: boolean;
};

export default function PublicAppShell({
  children,
  className = "",
  contentClassName = "",
  showDock = true,
}: PublicAppShellProps) {
  return (
    <main className={`relative min-h-screen overflow-x-hidden text-white ${className}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(213,228,0,0.18),transparent_55%)]" />
        <div className="absolute -left-20 top-28 h-64 w-64 rounded-full bg-[#d5e400]/10 blur-3xl" />
        <div className="absolute right-[-5rem] top-36 h-72 w-72 rounded-full bg-white/6 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-[#728f38]/8 blur-3xl" />
      </div>

      <Header />

      <div className={`relative z-10 ${showDock ? "pb-28 lg:pb-12" : "pb-12"} ${contentClassName}`}>
        {children}
      </div>

      {showDock ? <PublicBottomDock /> : null}
    </main>
  );
}
